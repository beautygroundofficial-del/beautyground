import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadPGlite } from './load-pglite.mjs'

// Isolated PostgreSQL-compatible runtime; no network, credentials or real members.
const PGlite = await loadPGlite()
const db = new PGlite()
const checks = []
const check = async (name, run) => { await run(); checks.push(name) }
const count = async () => (await db.query('select public.get_member_count() as n')).rows[0].n
const asRole = async (role, run) => {
  assert(['anon', 'authenticated', 'count_unprivileged'].includes(role))
  await db.exec(`set role ${role}`)
  try { return await run() } finally { await db.exec('reset role') }
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role count_unprivileged nologin;
    create schema auth;
    create table auth.users (id integer primary key, created_at timestamptz not null);
    grant usage on schema public to anon, authenticated, count_unprivileged;
  `)
  const sql = await readFile(new URL('../../supabase/member_count.sql', import.meta.url), 'utf8')
  await db.exec(sql)
  await check('empty fixture retains the existing display baseline', async () => {
    assert.equal(await count(), 7321)
  })
  await db.exec(`insert into auth.users values
    (1, '2026-09-12T14:59:59+00:00'),
    (2, '2026-09-12T15:00:00+00:00'),
    (3, '2026-09-13T10:00:00+09:00');`)
  await check('Korean midnight boundary includes exactly the two qualifying rows', async () => {
    assert.equal(await count(), 7323)
  })
  await check('session timezone does not change the boundary', async () => {
    await db.exec("set timezone='America/Los_Angeles'")
    assert.equal(await count(), 7323)
    await db.exec("set timezone='Asia/Seoul'")
    assert.equal(await count(), 7323)
  })
  for (const role of ['anon', 'authenticated']) {
    await check(`${role} can read the scalar count but cannot read the member table`, () => asRole(role, async () => {
      assert.equal(await count(), 7323)
      await assert.rejects(db.query('select * from auth.users'), error => error.code === '42501')
    }))
  }
  await check('unrelated roles do not inherit function execution from PUBLIC', () => asRole('count_unprivileged', async () => {
    await assert.rejects(db.query('select public.get_member_count()'), error => error.code === '42501')
  }))
  await check('definition is stable, uses definer privileges, and has an empty search path', async () => {
    const row = (await db.query(`select prosecdef, provolatile, proconfig
      from pg_proc where oid='public.get_member_count()'::regprocedure`)).rows[0]
    assert.equal(row.prosecdef, true)
    assert.equal(row.provolatile, 's')
    assert.deepEqual(row.proconfig, ['search_path=""'])
  })
  await check('reapplying the definition preserves the result, restrictions and member rows', async () => {
    await db.exec(sql)
    assert.equal(await count(), 7323)
    assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n, 3)
    await asRole('count_unprivileged', async () => {
      await assert.rejects(db.query('select public.get_member_count()'), error => error.code === '42501')
    })
  })
  console.log(JSON.stringify({ passed: checks.length, checks, scope: 'isolated PGlite only; not deployed' }, null, 2))
} finally {
  await db.close()
}
