const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const repo = path.resolve(process.env.COMMUNITY_TEST_REPO || path.join(__dirname, '../..'));
const ts = require(path.join(repo, 'node_modules/typescript'));
const compiled = ts.transpileModule(fs.readFileSync(path.join(repo, 'src/components/layout/AppHeader.tsx'), 'utf8'), {
  reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.equal((compiled.diagnostics ?? []).length, 0, 'TSX syntax diagnostics');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function user(id, metadata = { name: `member-${id}` }, email = `${id}@example.test`) {
  return { id, user_metadata: metadata, email };
}
function response(authUser, error = null) { return { data: { user: authUser }, error }; }
function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? textContent(node.props?.children) : String(node);
}
function find(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) { const found = find(child, predicate); if (found) return found; }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}

// Execute the actual TSX with deferred auth/RPC results and auth notifications.
// No DOM, browser, network, operational account, or database is used.
function harness() {
  let slots = [], cursor = 0, pending = [], dirty = true, mounted = true, tree;
  let inAuthCallback = false;
  const callbacks = new Set();
  const state = {
    getUser: () => Promise.resolve(response(user('A'))),
    getCount: () => Promise.resolve({ data: 7340, error: null }),
    userCalls: 0, rpcCalls: [], writesAfterUnmount: 0,
  };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const stubs = {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[i].value, value => {
          if (!mounted) state.writesAfterUnmount++;
          const next = typeof value === 'function' ? value(slots[i].value) : value;
          if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
        }];
      },
      useEffect(effect, deps) {
        const i = cursor++;
        if (!slots[i] || !same(slots[i].deps, deps)) {
          const old = slots[i]; slots[i] = { deps };
          pending.push(() => { old?.cleanup?.(); slots[i].cleanup = effect(); });
        }
      },
    },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-router-dom': { Link: 'Link' },
    '../common/Icon': { IconSearch: 'IconSearch', IconUser: 'IconUser' },
    '../../lib/supabase': { supabase: {
      auth: {
        getUser() {
          assert.equal(inAuthCallback, false, 'No auth request inside auth callback');
          state.userCalls++; return state.getUser();
        },
        onAuthStateChange(fn) {
          callbacks.add(fn);
          return { data: { subscription: { unsubscribe: () => callbacks.delete(fn) } } };
        },
      },
      rpc(name) {
        assert.equal(inAuthCallback, false, 'No RPC inside auth callback');
        assert.equal(name, 'get_member_count');
        state.rpcCalls.push(name); return state.getCount();
      },
    } },
  };
  const context = {
    exports: {},
    require(id) { assert.ok(id in stubs, `Unexpected import: ${id}`); return stubs[id]; },
  };
  vm.runInNewContext(compiled.outputText, context);
  function render() {
    if (!mounted || !dirty) return;
    dirty = false; cursor = 0; tree = context.exports.default({});
    const effects = pending; pending = []; effects.forEach(fn => fn());
  }
  return Object.assign(state, {
    async flush() {
      for (let i = 0; i < 4; i++) { render(); await new Promise(resolve => setImmediate(resolve)); }
      render();
    },
    auth(authUser, event = authUser ? 'SIGNED_IN' : 'SIGNED_OUT') {
      inAuthCallback = true;
      try { for (const callback of callbacks) callback(event, authUser ? { user: authUser } : null); }
      finally { inAuthCallback = false; }
      render();
    },
    text: () => textContent(tree),
    logo: () => find(tree, node => node.type === 'img' && node.props.alt === '뷰티그라운드'),
    subscriptionCount: () => callbacks.size,
    unmount() {
      mounted = false;
      for (const slot of slots) slot?.cleanup?.();
    },
  });
}

test('initial account name and member count render from their existing lookups', async t => {
  const h = harness(); t.after(() => h.unmount()); await h.flush();
  assert.match(h.text(), /환영합니다, member-A님/);
  assert.match(h.text(), /7,340명/);
  assert.equal(h.logo(), null); assert.equal(h.userCalls, 1);
  assert.deepEqual(h.rpcCalls, ['get_member_count']);
});

test('A to B account switch immediately replaces the old greeting', async t => {
  const h = harness(); t.after(() => h.unmount()); await h.flush();
  h.auth(user('B'));
  assert.match(h.text(), /member-B님/); assert.doesNotMatch(h.text(), /member-A/);
  assert.equal(h.userCalls, 1); assert.equal(h.rpcCalls.length, 1);
});

test('logout immediately restores the logo instead of the old greeting', async t => {
  const h = harness(); t.after(() => h.unmount()); await h.flush();
  h.auth(null);
  assert.doesNotMatch(h.text(), /member-A/); assert.ok(h.logo());
});

test('late initial A response cannot replace a newer B account', async t => {
  const h = harness(); t.after(() => h.unmount()); const initial = deferred();
  h.getUser = () => initial.promise; await h.flush();
  h.auth(user('B')); initial.resolve(response(user('A'))); await h.flush();
  assert.match(h.text(), /member-B님/); assert.doesNotMatch(h.text(), /member-A/);
});

test('late initial A response cannot restore the greeting after logout', async t => {
  const h = harness(); t.after(() => h.unmount()); const initial = deferred();
  h.getUser = () => initial.promise; await h.flush();
  h.auth(null); initial.resolve(response(user('A'))); await h.flush();
  assert.doesNotMatch(h.text(), /member-A/); assert.ok(h.logo());
});

test('same-account metadata updates change the greeting', async t => {
  const h = harness(); t.after(() => h.unmount()); await h.flush();
  h.auth(user('A', { name: 'updated-name' }), 'USER_UPDATED');
  assert.match(h.text(), /updated-name님/); assert.doesNotMatch(h.text(), /member-A/);
});

test('missing names use the existing email fallback or the logo', async t => {
  const h = harness(); t.after(() => h.unmount()); await h.flush();
  h.auth(user('B', {}, 'fallback@example.test'));
  assert.match(h.text(), /fallback님/); assert.doesNotMatch(h.text(), /member-A/);
  h.auth({ id: 'C', user_metadata: {} });
  assert.ok(h.logo()); assert.doesNotMatch(h.text(), /fallback/);
});

test('failed initial lookup does not display its unusable user data', async t => {
  const h = harness(); t.after(() => h.unmount());
  h.getUser = () => Promise.resolve(response(user('A'), new Error('auth failed')));
  await h.flush(); assert.ok(h.logo()); assert.doesNotMatch(h.text(), /member-A/);
});

test('rejected initial lookup is handled and retains the logo', async t => {
  const h = harness(); t.after(() => h.unmount());
  h.getUser = () => Promise.reject(new Error('auth request rejected'));
  await h.flush(); assert.ok(h.logo());
  h.auth(user('B')); assert.match(h.text(), /member-B님/);
});

test('late initial rejection cannot erase a newer B greeting', async t => {
  const h = harness(); t.after(() => h.unmount()); const initial = deferred();
  h.getUser = () => initial.promise; await h.flush();
  h.auth(user('B')); initial.reject(new Error('obsolete auth request rejected')); await h.flush();
  assert.match(h.text(), /member-B님/); assert.equal(h.logo(), null);
});

test('unmount removes the auth subscription and blocks deferred state writes', async () => {
  const h = harness(), initial = deferred(), count = deferred();
  h.getUser = () => initial.promise; h.getCount = () => count.promise;
  await h.flush(); assert.equal(h.subscriptionCount(), 1);
  assert.match(h.text(), /7,321명/);
  h.unmount(); assert.equal(h.subscriptionCount(), 0);
  h.auth(user('B')); initial.resolve(response(user('A'))); count.resolve({ data: 7340, error: null });
  await h.flush(); assert.equal(h.writesAfterUnmount, 0);
});
