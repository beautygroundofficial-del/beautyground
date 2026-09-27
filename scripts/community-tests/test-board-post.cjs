const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(process.env.COMMUNITY_TEST_REPO || path.join(__dirname, '../..'));
const ts = require(path.join(repo, 'node_modules/typescript'));
function compile(file) {
  const result = ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal((result.diagnostics ?? []).length, 0);
  return result.outputText;
}
const pageSource = compile('src/pages/AppBoardPost.tsx');
const librarySource = compile('src/lib/board.ts');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function post(id) {
  return { id, content: `story-${id}`, images: [], category: 'chat', nickname: 'member',
    created_at: '2026-09-28T00:00:00Z', is_mine: false, comment_count: 1 };
}
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

// Execute the actual library and page in memory. No browser, network, or DB writes.
function harness() {
  let slots = [], cursor = 0, effects = [], dirty = true, tree, alive = true;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const state = {
    id: 'A', calls: [],
    location: { search: '?comments=1&comment=comment-A', state: null },
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'reader' } } }, error: null }),
    reply: id => Promise.resolve({ data: [post(id)], error: null }),
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, next => {
        assert.ok(alive, 'state must not be written after unmount');
        next = typeof next === 'function' ? next(slots[i].value) : next;
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
        const old = slots[i]; slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  const supabase = {
    auth: { getSession: () => state.getSession() },
    rpc(name, params) {
      assert.equal(name, 'get_board_post');
      state.calls.push(params.p_id);
      return state.reply(params.p_id);
    },
  };
  const library = { exports: {}, require(id) { assert.equal(id, './supabase'); return { supabase }; } };
  vm.runInNewContext(librarySource, library);
  const stubs = {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-router-dom': { useNavigate: () => () => {}, useLocation: () => state.location, useParams: () => ({ id: state.id }) },
    '../lib/supabase': { supabase },
    '../lib/board': library.exports,
    '../lib/useIsAdmin': { useIsAdmin: () => ({ isAdmin: false }) },
    '../components/community/DiaryComments': { CommentToggle: 'CommentToggle' },
  };
  for (const name of ['layout/BackHeader', 'layout/AppFrame', 'community/ReactionBar', 'community/ReactionSummary',
    'community/BoardComments', 'community/Lightbox', 'community/LikeButton']) {
    stubs[`../components/${name}`] = { default: name.split('/').pop() };
  }
  const context = {
    exports: {}, URLSearchParams, Date, setTimeout: () => 0, clearTimeout() {},
    window: { history: { replaceState() {} }, confirm: () => true },
    require(id) { assert.ok(id in stubs, `Unexpected import ${id}`); return stubs[id]; },
  };
  vm.runInNewContext(pageSource, context);
  function render() {
    if (!dirty || !alive) return;
    dirty = false; cursor = 0; tree = context.exports.default();
    const pending = effects; effects = []; pending.forEach(fn => fn());
  }
  return Object.assign(state, {
    library: library.exports,
    async flush() {
      for (let i = 0; i < 12; i++) { render(); await new Promise(resolve => setImmediate(resolve)); }
      render();
    },
    route(id) { state.id = id; state.location = { search: `?comments=1&comment=comment-${id}`, state: null }; dirty = true; },
    retry() { return walk(tree, node => node.type === 'button' && /다시 불러오기/.test(textContent(node))); },
    comments() { return walk(tree, node => node.type === 'BoardComments'); },
    text() { return textContent(tree); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); alive = false; },
  });
}

const cases = [];
const test = (name, run) => cases.push({ name, run });
for (const status of [403, 503]) test(`${status} is a retriable lookup error, not a deleted story`, async () => {
  const h = harness();
  h.reply = () => Promise.resolve({ data: null, error: { status, message: `HTTP ${status}` } });
  await h.flush();
  assert.match(h.text(), /불러오지 못했어요/);
  assert.doesNotMatch(h.text(), /지워진|삭제되었/);
  assert.ok(h.retry());
  h.reply = id => Promise.resolve({ data: [post(id)], error: null });
  h.retry().props.onClick(); await h.flush();
  assert.match(h.text(), /story-A/);
  assert.equal(h.comments().props.focusCommentId, 'comment-A');
  assert.deepEqual(h.calls, ['A', 'A']);
  h.unmount();
});
test('successful zero-row response shows absence without a lookup error', async () => {
  const h = harness(); h.reply = () => Promise.resolve({ data: [], error: null }); await h.flush();
  assert.match(h.text(), /지워진|삭제되었|볼 수 없/);
  assert.doesNotMatch(h.text(), /불러오지 못했어요/); assert.equal(h.retry(), null); h.unmount();
});
test('route change clears old story while the new story is pending', async () => {
  const h = harness(); await h.flush(); assert.match(h.text(), /story-A/);
  const pending = deferred(); h.reply = () => pending.promise; h.route('B'); await h.flush();
  assert.doesNotMatch(h.text(), /story-A/); assert.match(h.text(), /불러오는 중/);
  pending.resolve({ data: [post('B')], error: null }); await h.flush();
  assert.match(h.text(), /story-B/); assert.equal(h.comments().props.focusCommentId, 'comment-B'); h.unmount();
});
for (const outcome of ['success', 'error']) test(`late old-route ${outcome} cannot replace the new story`, async () => {
  const h = harness(); const old = deferred();
  h.reply = id => id === 'A' ? old.promise : Promise.resolve({ data: [post(id)], error: null });
  await h.flush(); h.route('B'); await h.flush(); assert.match(h.text(), /story-B/);
  old.resolve(outcome === 'success' ? { data: [post('A')], error: null } : { data: null, error: { status: 503 } });
  await h.flush(); assert.match(h.text(), /story-B/); assert.doesNotMatch(h.text(), /story-A|불러오지 못했어요/); h.unmount();
});
test('auth failure can be retried without falsely reporting a deleted story', async () => {
  const h = harness(); h.getSession = () => Promise.reject(new Error('auth unavailable'));
  await h.flush(); assert.match(h.text(), /불러오지 못했어요/); assert.ok(h.retry()); assert.deepEqual(h.calls, []); h.unmount();
});
test('late lookup after unmount does not update the page', async () => {
  const h = harness(); const pending = deferred(); h.reply = () => pending.promise;
  await h.flush(); h.unmount(); pending.resolve({ data: [post('A')], error: null }); await h.flush();
});
test('legacy library callers keep their null-on-error contract', async () => {
  const h = harness(); h.reply = () => Promise.resolve({ data: null, error: { status: 503 } });
  assert.equal(await h.library.getBoardPost('A'), null); h.unmount();
});

(async () => {
  let passed = 0;
  for (const item of cases) {
    try { await item.run(); passed++; console.log(`PASS ${item.name}`); }
    catch (error) { console.error(`FAIL ${item.name}\n${error.stack}`); }
  }
  console.log(`${passed}/${cases.length} passed`);
  if (passed !== cases.length) process.exitCode = 1;
})();
