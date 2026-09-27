const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const repo = path.resolve(process.env.COMMUNITY_TEST_REPO || path.join(__dirname, '../..'));
const ts = require(path.join(repo, 'node_modules/typescript'));
const source = fs.readFileSync(path.join(repo, 'src/pages/AppNews.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.equal((compiled.diagnostics ?? []).length, 0, 'TSX syntax diagnostics');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function news(user, isNew = true) {
  return [{
    kind: 'board_comment', target_type: 'board', target_id: `post-${user}`,
    actor_nickname: 'someone', actor_user_id: null,
    excerpt: `story-${user}`, comment_text: `comment-${user}`, reaction_kind: null,
    created_at: user === 'A' ? '2026-09-28T09:00:00Z' : '2026-09-27T09:00:00Z',
    is_new: isNew,
  }];
}
function session(user) { return { data: { session: user ? { user: { id: user } } : null }, error: null }; }
function walk(node, predicate) {
  if (Array.isArray(node)) {
    for (const child of node) { const hit = walk(child, predicate); if (hit) return hit; }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  return walk(node.props?.children, predicate);
}
function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join(' ');
  if (node == null || typeof node === 'boolean') return '';
  return typeof node === 'object' ? textContent(node.props?.children) : String(node);
}

// Execute the actual TSX with controllable hooks, auth, timers, and RPC promises.
// This harness uses no DOM, browser, network, production data, or project writes.
function harness(initialUser = 'A') {
  let slots = [], cursor = 0, pending = [], dirty = true, tree;
  let inAuthCallback = false, timerId = 0;
  const authCallbacks = new Set(), listeners = new Map(), timers = new Map();
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const state = {
    user: initialUser, writes: [], newsCalls: [], sessionCalls: 0,
    getSession: () => Promise.resolve(session(state.user)),
    getNews: user => Promise.resolve(news(user)),
    mark: () => Promise.resolve(),
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => {
        const next = typeof value === 'function' ? value(slots[i].value) : value;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const old = slots[i]; slots[i] = { deps, effect: fn };
        pending.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  const stubs = {
    'react': react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-router-dom': { useNavigate: () => () => {} },
    '@tabler/icons-react': {},
    '../components/layout/BackHeader': { default: 'BackHeader' },
    '../components/layout/AppFrame': { default: 'AppFrame' },
    '../lib/supabase': { supabase: { auth: {
      getSession() {
        assert.equal(inAuthCallback, false, 'getSession must not run inside auth callback');
        state.sessionCalls++; return state.getSession();
      },
      onAuthStateChange(fn) {
        authCallbacks.add(fn);
        return { data: { subscription: { unsubscribe() { authCallbacks.delete(fn); } } } };
      },
    } } },
    '../lib/dailyQuestion': { REACTION_META: [] },
    '../lib/friends': { FRIENDS_CHANGED_EVENT: 'bg:friends-changed' },
    '../lib/communityConversations': {
      getConversationNews(limit) {
        assert.equal(inAuthCallback, false, 'news RPC must not run inside auth callback');
        state.newsCalls.push({ user: state.user, limit }); return state.getNews(state.user, limit);
      },
      markConversationNewsSeen(seenAt) {
        assert.equal(inAuthCallback, false, 'mark RPC must not run inside auth callback');
        state.writes.push({ user: state.user, seenAt }); return state.mark(seenAt);
      },
      conversationNewsPath: item => `/app/board/${item.target_id}`,
    },
  };
  const context = {
    exports: {}, Date,
    require(id) { assert.ok(id in stubs, `Unexpected import: ${id}`); return stubs[id]; },
    window: {
      addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
      removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
      setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  };
  vm.runInNewContext(compiled.outputText, context);
  function render() {
    if (dirty) { dirty = false; cursor = 0; tree = context.exports.default(); const effects = pending; pending = []; effects.forEach(fn => fn()); }
  }
  async function flush({ runTimers = true } = {}) {
    for (let i = 0; i < 12; i++) {
      render();
      await new Promise(resolve => setImmediate(resolve));
      if (runTimers && timers.size) { const ready = [...timers.values()]; timers.clear(); ready.forEach(fn => fn()); }
    }
    render();
  }
  return Object.assign(state, {
    flush,
    auth(user) {
      state.user = user; inAuthCallback = true;
      try { for (const fn of authCallbacks) fn(user ? 'SIGNED_IN' : 'SIGNED_OUT', session(user).data.session); }
      finally { inAuthCallback = false; }
    },
    focus() { for (const fn of listeners.get('focus') ?? []) fn(); },
    markButton() { return walk(tree, node => node.type === 'button' && String(node.props.onClick).includes('markSeen')); },
    text() { return textContent(tree); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    subscriptionCount() { return authCallbacks.size; },
  });
}

const cases = [];
function test(name, run) { cases.push({ name, run }); }

test('A -> B failed lookup removes A immediately and blocks stale mark handler', async () => {
  const h = harness(); await h.flush();
  assert.match(h.text(), /comment-A/); assert.equal(h.subscriptionCount(), 1);
  const staleMark = h.markButton().props.onClick;
  h.getNews = user => user === 'B' ? Promise.reject(new Error('B lookup failed')) : Promise.resolve(news(user));
  h.auth('B'); await h.flush({ runTimers: false });
  assert.doesNotMatch(h.text(), /comment-A/); assert.equal(h.markButton(), null);
  await h.flush(); staleMark(); await h.flush();
  assert.doesNotMatch(h.text(), /comment-A/); assert.equal(h.writes.length, 0);
  h.unmount(); assert.equal(h.subscriptionCount(), 0);
});

test('logout clears visible A and ignores A refresh arriving after logout', async () => {
  const h = harness(); await h.flush();
  const old = deferred(); h.getNews = () => old.promise;
  h.focus(); await h.flush(); h.auth(null); await h.flush({ runTimers: false });
  assert.doesNotMatch(h.text(), /comment-A/); assert.equal(h.markButton(), null);
  old.resolve(news('A')); await h.flush();
  assert.doesNotMatch(h.text(), /comment-A/); assert.equal(h.writes.length, 0); h.unmount();
});

test('late A response cannot replace successful B list', async () => {
  const h = harness(); await h.flush();
  const old = deferred(); h.getNews = user => user === 'A' ? old.promise : Promise.resolve(news('B'));
  h.focus(); await h.flush(); h.auth('B'); await h.flush();
  assert.match(h.text(), /comment-B/);
  old.resolve(news('A')); await h.flush();
  assert.match(h.text(), /comment-B/); assert.doesNotMatch(h.text(), /comment-A/); h.unmount();
});

test('normal current-account mark writes its own timestamp then reloads', async () => {
  const h = harness(); await h.flush();
  h.getNews = user => Promise.resolve(news(user, h.writes.length === 0));
  h.markButton().props.onClick(); await h.flush();
  assert.deepEqual(h.writes, [{ user: 'A', seenAt: news('A')[0].created_at }]);
  assert.equal(h.markButton(), null); assert.equal(h.newsCalls.length, 2); h.unmount();
});

test('mark preflight detects account change even before auth notification', async () => {
  const h = harness(); await h.flush();
  h.user = 'B'; h.getNews = () => Promise.reject(new Error('B lookup failed'));
  h.markButton().props.onClick(); await h.flush();
  assert.equal(h.writes.length, 0); assert.doesNotMatch(h.text(), /comment-A/); h.unmount();
});

test('failed same-account refresh invalidates a previously successful list', async () => {
  const h = harness(); await h.flush(); const staleMark = h.markButton().props.onClick;
  h.getNews = () => Promise.reject(new Error('lookup failed')); h.focus(); await h.flush();
  staleMark(); await h.flush();
  assert.equal(h.writes.length, 0); assert.equal(h.markButton(), null); h.unmount();
});

test('account change during pending mark preflight suppresses old write', async () => {
  const h = harness(); await h.flush(); const preflight = deferred();
  h.getSession = () => preflight.promise; h.markButton().props.onClick(); await h.flush();
  h.getSession = () => Promise.resolve(session(h.user)); h.auth('B'); await h.flush();
  preflight.resolve(session('A')); await h.flush();
  assert.equal(h.writes.length, 0); assert.match(h.text(), /comment-B/); h.unmount();
});

test('late initial session cannot undo a newer authenticated account', async () => {
  const h = harness(); const initial = deferred(); h.getSession = () => initial.promise;
  await h.flush(); h.getSession = () => Promise.resolve(session(h.user)); h.auth('B'); await h.flush();
  initial.resolve(session('A')); await h.flush();
  assert.match(h.text(), /comment-B/); assert.doesNotMatch(h.text(), /comment-A/); h.unmount();
});

(async () => {
  let passed = 0;
  for (const { name, run } of cases) { await run(); passed++; console.log(`PASS ${name}`); }
  console.log(`${passed}/${cases.length} passed; TSX executed in memory; no browser/network/DB.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
