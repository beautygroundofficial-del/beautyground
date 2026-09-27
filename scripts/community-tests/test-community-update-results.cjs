const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.resolve(process.env.COMMUNITY_TEST_REPO || path.join(__dirname, '../..'));
const ts = require(path.join(repo, 'node_modules/typescript'));

// Execute the actual update functions against controlled return values.
// The query builder is a mock and never connects to Supabase.
async function check(file, method) {
  let result, selected;
  const query = {
    update() { return this; },
    eq() { return this; },
    select(columns) { selected = columns; return Promise.resolve(result); },
  };
  const context = {
    exports: {}, Date,
    require(id) {
      if (id === './supabase') return { supabase: { from: () => query } };
      if (id === './reactions') return {};
      throw new Error(`Unexpected runtime import: ${id}`);
    },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(repo, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);

  const cases = [
    ['zero rows', [], null, false],
    ['matching row', [{ id: 'wanted' }], null, true],
    ['wrong row', [{ id: 'other' }], null, false],
    ['server error', null, { message: 'failed' }, false],
  ];
  for (const [label, data, error, expected] of cases) {
    result = { data, error };
    selected = undefined;
    assert.equal(await context.exports[method]('wanted', {}), expected);
    assert.equal(selected, 'id');
    console.log(`PASS ${method} ${label}`);
  }
  return cases.length;
}

(async () => {
  const diaryPassed = await check('src/lib/diaries.ts', 'updateDiary');
  const boardPassed = await check('src/lib/board.ts', 'updateBoardPost');
  console.log(`${diaryPassed + boardPassed}/8 passed; source executed in memory; no browser/network/DB.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
