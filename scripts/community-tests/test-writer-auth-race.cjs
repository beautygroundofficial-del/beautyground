const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(process.env.COMMUNITY_TEST_REPO || path.join(__dirname, '../..'));
const ts = require(path.join(repo, 'node_modules/typescript'));

// Run the actual writer TSX with a deferred initial auth lookup.
// All imports, storage, and auth events are local mocks; no browser or network.
async function reproduce(file, nextUser) {
  let resolveSession;
  const initialSession = new Promise(resolve => { resolveSession = resolve; });
  let slots = [], cursor = 0, effects = [], dirty = true, tree;
  const events = new Set(), loadedKeys = [], writes = [], navigations = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const old = slots[i]; slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  const isDiary = file.includes('Diary');
  const location = { pathname: isDiary ? '/app/diary/write' : '/app/board/write', search: '' };
  const params = new URLSearchParams();
  const navigate = (...args) => navigations.push(args);
  const stubs = {
    'react': hooks,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' },
    'react-router-dom': { useNavigate: () => navigate, useLocation: () => location, useSearchParams: () => [params] },
    '../components/layout/BackHeader': { default: 'BackHeader' },
    '../components/layout/AppFrame': { default: 'AppFrame' },
    '../components/community/PostComposer': {
      default: 'PostComposer',
      loadDraft(key) {
        loadedKeys.push(key);
        return { content: 'PRIVATE_DRAFT_OF_A', steps: '', petIds: [], category: 'daily' };
      },
      saveDraft(key, value) { writes.push({ key, value }); return true; },
      clearDraft() {},
    },
    '../components/community/StoryCardPicker': { default: 'StoryCardPicker' },
    '../lib/supabase': { supabase: { auth: {
      getSession: () => initialSession,
      onAuthStateChange(fn) {
        events.add(fn);
        return { data: { subscription: { unsubscribe: () => events.delete(fn) } } };
      },
    } } },
    '../lib/diaries': {},
    '../lib/pets': { getMyPets: async () => [], petEmoji: () => '' },
    '../hooks/useNicknameGate': {
      useNicknameGate: () => ({ modalOpen: false, ensureNickname() {}, handleDone() {}, closeModal() {} }),
    },
    '../components/community/NicknameModal': { default: 'NicknameModal' },
    '../lib/useIsAdmin': { useIsAdmin: () => ({ isAdmin: false, loading: false }) },
    '../lib/board': { BOARD_CATEGORIES: [{ key: 'daily', label: 'daily' }] },
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = {
    exports: {},
    require(id) { assert.ok(id in stubs, `Unexpected import: ${id}`); return stubs[id]; },
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout: () => 1,
  };
  vm.runInNewContext(code, context);
  async function flush() {
    for (let i = 0; i < 8; i++) {
      if (dirty) {
        dirty = false; cursor = 0; tree = context.exports.default();
        const pending = effects; effects = []; pending.forEach(fn => fn());
      }
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  function find(node, predicate) {
    if (Array.isArray(node)) {
      for (const child of node) { const hit = find(child, predicate); if (hit) return hit; }
      return null;
    }
    if (!node || typeof node !== 'object') return null;
    return predicate(node) ? node : find(node.props?.children, predicate);
  }

  await flush();
  for (const fn of events) fn(nextUser ? 'SIGNED_IN' : 'SIGNED_OUT', nextUser ? { user: { id: nextUser } } : null);
  resolveSession({ data: { session: { user: { id: 'A' } } } });
  await flush();

  const composer = find(tree, node => node.type === 'PostComposer');
  assert.deepEqual(loadedKeys, [], 'Obsolete account draft must not be read');
  assert.equal(composer?.props.content, '', 'Obsolete account draft must not appear');
  assert.equal(composer?.props.disabled, true, 'Writer must stay disabled');
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0][0], '/app/login');
  assert.equal(navigations[0][1].state.from, location.pathname);
  for (const slot of slots) slot?.cleanup?.();
}

(async () => {
  let passed = 0;
  for (const file of ['src/pages/AppDiaryWrite.tsx', 'src/pages/AppBoardWrite.tsx']) {
    for (const nextUser of ['B', null]) {
      await reproduce(file, nextUser);
      passed++;
      console.log(`PASS ${path.basename(file)} initial A session after ${nextUser ? 'B sign-in' : 'logout'}`);
    }
  }
  console.log(`${passed}/4 passed; TSX executed in memory; no browser/network/DB.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
