import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { test } from 'node:test'
import ts from 'typescript'

// 실제 서비스 모듈을 transpile해서 RPC 계약만 검사한다. 네트워크·운영 DB에는 접속하지 않는다.
function loadService(file, rpcResults = [], deletedRows = []) {
  const calls = []
  const supabase = {
    async rpc(name, args) {
      calls.push({ name, args })
      assert.ok(rpcResults.length, `Unexpected RPC: ${name}`)
      return rpcResults.shift()
    },
    from(table) {
      return {
        delete() {
          return {
            eq(column, value) {
              return {
                async select(projection) {
                  calls.push({ table, column, value, projection })
                  return { data: deletedRows, error: null }
                },
              }
            },
          }
        },
      }
    },
  }
  const source = readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const exports = {}
  runInContext(compiled, createContext({ exports, require: () => ({ supabase }) }))
  return { service: exports, calls, remaining: rpcResults }
}
const plain = (value) => JSON.parse(JSON.stringify(value))

test('diary thread forwards pagination and preserves the public profile ID', async () => {
  const row = { id: 'comment-51', user_id: 'writer', parent_comment_id: 'parent' }
  const { service, calls } = loadService('diaries', [{ data: [row], error: null }])
  assert.deepEqual(plain(await service.getDiaryComments('diary', 50, 50)), [row])
  assert.deepEqual(plain(calls), [{ name: 'get_diary_comment_thread', args: { p_diary_id: 'diary', p_limit: 50, p_offset: 50 } }])
})

for (const code of ['PGRST202', '42883']) {
  test(`missing diary thread RPC (${code}) falls back without losing pagination`, async () => {
    const { service, calls } = loadService('diaries', [
      { data: null, error: { code } }, { data: [], error: null },
    ])
    assert.deepEqual(plain(await service.getDiaryComments('diary', 20, 40)), [])
    assert.deepEqual(plain(calls[1]), { name: 'get_diary_comments', args: { p_diary_id: 'diary', p_limit: 20, p_offset: 40 } })
  })
}

test('permission and connection errors do not fall back or masquerade as an empty diary', async () => {
  const { service, calls } = loadService('diaries', [{ data: null, error: { code: '42501' } }])
  assert.equal(await service.getDiaryComments('diary'), null)
  assert.equal(calls.length, 1)
})

for (const [file, getter, rpc, argument] of [
  ['board', 'getBoardComments', 'get_board_comments', 'p_post_id'],
  ['dailyQuestion', 'getAnswerComments', 'get_answer_comments', 'p_answer_id'],
]) {
  test(`${file}: empty, failed, and subsequent pages remain distinguishable`, async () => {
    const { service, calls } = loadService(file, [
      { data: [], error: null }, { data: null, error: { code: 'network' } },
      { data: [{ id: 'later-comment' }], error: null },
    ])
    assert.deepEqual(plain(await service[getter]('target')), [])
    assert.equal(await service[getter]('target'), null)
    assert.deepEqual(plain(await service[getter]('target', 50, 100)), [{ id: 'later-comment' }])
    assert.deepEqual(plain(calls[2]), { name: rpc, args: { [argument]: 'target', p_limit: 50, p_offset: 100 } })
  })
}

test('diary replies retain the selected parent and server result', async () => {
  const result = { comment_id: 'new-reply', awarded: 0, message: '' }
  const { service, calls } = loadService('diaries', [{ data: [result], error: null }])
  assert.deepEqual(plain(await service.createDiaryComment('diary', 'reply text', 'nickname', 'parent-A')), result)
  assert.deepEqual(plain(calls[0]), {
    name: 'create_diary_comment', args: { p_diary_id: 'diary', p_content: 'reply text', p_nickname: 'nickname', p_parent_comment_id: 'parent-A' },
  })
})

for (const [file, remove, table] of [
  ['diaries', 'deleteDiaryComment', 'diary_comments'],
  ['board', 'deleteBoardComment', 'board_comments'],
  ['dailyQuestion', 'deleteAnswerComment', 'answer_comments'],
]) {
  test(`${file}: deleting zero rows is not reported as success`, async () => {
    const failed = loadService(file)
    assert.equal(await failed.service[remove]('mine'), false)
    const deleted = loadService(file, [], [{ id: 'mine' }])
    assert.equal(await deleted.service[remove]('mine'), true)
    assert.deepEqual(plain(deleted.calls), [{ table, column: 'id', value: 'mine', projection: 'id' }])
    const other = loadService(file, [], [{ id: 'someone-else' }])
    assert.equal(await other.service[remove]('mine'), false)
  })
}
