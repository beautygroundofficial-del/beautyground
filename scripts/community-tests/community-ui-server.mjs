// Local UI bridge over isolated PGlite fixtures. No production connection or outbound request.
// POST /request -> { status, headers, body, fixtureKind }; outer HTTP status remains 200.
// /health reports real SQL functions versus explicitly empty auxiliary responses.
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createCommunityDb, IDS, REPO } from './community-db-harness.mjs'

const USER_IDS = new Set([IDS.A, IDS.B, IDS.C])
const COMMENT_TABLES = new Set(['diary_comments', 'board_comments', 'answer_comments'])
const EMPTY_AUXILIARY_RPCS = new Set([
  'get_monthly_best_diaries', 'get_today_question', 'get_member_count', 'get_my_missions',
  'get_active_missions', 'get_mission_progress', 'get_home_banners', 'get_my_points',
])
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
const quoteIdent = (value) => '"' + value.replaceAll('"', '""') + '"'
const result = (body, status = 200, fixtureKind = 'actual-sql') => ({ status, headers: JSON_HEADERS, body, fixtureKind })
const errorResult = (message, code = 'FIXTURE_ERROR', status = 400) => result({ code, message, details: null, hint: null }, status, 'error')

function sourceFunction(source, name) {
  const found = source.match(new RegExp('create(?: or replace)? function public\\.' + name + '\\([\\s\\S]*?\\$\\$;', 'i'))
  if (!found) throw new Error(`Source function missing: ${name}`)
  return found[0]
}

async function installSourceReader(fixture, filename, name, signature, publicRead) {
  const existing = await fixture.db.query('select to_regprocedure($1)::text as signature', [`public.${name}(${signature})`])
  if (existing.rows[0].signature) return false
  const source = await readFile(path.join(REPO, 'supabase', filename), 'utf8')
  await fixture.db.exec(sourceFunction(source, name))
  await fixture.db.exec(`revoke all on function public.${name}(${signature}) from public;
    grant execute on function public.${name}(${signature}) to authenticated${publicRead ? ', anon' : ''};`)
  return true
}

async function prepareFixture() {
  const fixture = await createCommunityDb()
  const sourceReaders = []
  for (const [file, name, signature, publicRead] of [
    ['people.sql', 'get_user_profile', 'uuid', true],
    ['people.sql', 'get_user_diary_feed', 'uuid,integer,integer', true],
    ['friends.sql', 'get_friend_statuses', 'uuid[]', false],
    ['friends.sql', 'get_my_friends', '', false],
    ['friends.sql', 'get_friend_requests', '', false],
    ['friends.sql', 'get_friend_request_count', '', false],
    ['friends.sql', 'get_friend_diary_feed', 'integer,integer', false],
    ['community_media_edit.sql', 'get_board_feed', 'text[],integer,integer', true],
    ['community_media_edit.sql', 'get_board_post', 'uuid', true],
  ]) {
    if (await installSourceReader(fixture, file, name, signature, publicRead)) sourceReaders.push(`${file}:${name}`)
  }

  // These are explicitly fixture policies, not a reproduction of all production RLS policies.
  // SELECT is needed by DELETE ... RETURNING id; both operations are restricted to the author.
  for (const table of COMMENT_TABLES) {
    await fixture.db.exec(`grant select, delete on public.${table} to authenticated;
      create policy fixture_comment_author_select on public.${table}
        for select to authenticated using (user_id = auth.uid());
      create policy fixture_comment_author_delete on public.${table}
        for delete to authenticated using (user_id = auth.uid());`)
  }
  await fixture.db.exec(`
    create table public.user_nicknames(user_id uuid primary key references auth.users(id), nickname text not null);
    alter table public.user_nicknames enable row level security;
    grant select on public.user_nicknames to authenticated;
    create policy fixture_nickname_own on public.user_nicknames for select to authenticated using (user_id = auth.uid());
    insert into public.user_nicknames(user_id, nickname)
      select id, coalesce(raw_user_meta_data->>'name', 'Fixture') from auth.users;
    alter table public.pets enable row level security;
    grant select on public.pets to anon, authenticated;
    create policy fixture_pet_public_read on public.pets for select to anon, authenticated using (true);
  `)
  return { ...fixture, sourceReaders }
}

async function rpcCandidates(fixture, name) {
  const found = await fixture.db.query(`
    select p.oid::text, p.proname, p.proretset, p.pronargs, p.pronargdefaults,
           p.prorettype::regtype::text as return_type, t.typtype as return_kind,
           coalesce((select jsonb_agg(jsonb_build_object(
             'name', p.proargnames[a.ordinality::integer],
             'type', format_type(a.type_oid, null)) order by a.ordinality)
             from unnest(p.proargtypes::oid[]) with ordinality as a(type_oid, ordinality)), '[]'::jsonb) as args
    from pg_proc p join pg_type t on t.oid = p.prorettype
    where p.pronamespace = 'public'::regnamespace and p.proname = $1`, [name])
  return found.rows
}

export async function createUiBridge() {
  let fixture = await prepareFixture()
  let queue = Promise.resolve()
  const usedFallbacks = new Set()
  const calls = []
  const serialized = (work) => {
    const next = queue.catch(() => {}).then(work)
    queue = next
    return next
  }

  async function executeRpc(uid, name, args) {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) return errorResult('Invalid RPC name')
    if (name === 'get_my_nickname') {
      if (!uid) return result(null, 200, 'nickname-fixture')
      const query = await fixture.queryAs(uid, 'select nickname from public.user_nicknames where user_id = auth.uid()')
      return result(query.rows[0]?.nickname ?? null, 200, 'nickname-fixture')
    }
    const candidates = await rpcCandidates(fixture, name)
    if (!candidates.length && EMPTY_AUXILIARY_RPCS.has(name)) {
      usedFallbacks.add(name)
      return result([], 200, 'explicit-empty-auxiliary')
    }
    const keys = Object.keys(args)
    const match = candidates.find((candidate) => keys.every(key => candidate.args.some(a => a.name === key))
      && candidate.args.slice(0, candidate.pronargs - candidate.pronargdefaults).every(a => Object.hasOwn(args, a.name)))
    if (!match) return errorResult(`No fixture function matches public.${name}(${keys.join(',')})`, 'PGRST202', 404)

    const values = []
    const named = match.args.filter(arg => Object.hasOwn(args, arg.name)).map(arg => {
      const value = args[arg.name]
      let expression
      if (arg.type.endsWith('[]') && Array.isArray(value)) {
        values.push(JSON.stringify(value))
        expression = `ARRAY(select jsonb_array_elements_text($${values.length}::jsonb))::${arg.type}`
      } else {
        values.push(value !== null && typeof value === 'object' ? JSON.stringify(value) : value)
        expression = `$${values.length}::${arg.type}`
      }
      return `${quoteIdent(arg.name)} => ${expression}`
    }).join(', ')
    const call = `public.${quoteIdent(name)}(${named})`
    const query = await fixture.queryAs(uid, match.proretset || match.return_type === 'record'
      ? `select * from ${call}` : `select ${call} as value`, values)
    if (match.proretset) return result(match.return_kind === 'b' ? query.rows.map(row => Object.values(row)[0]) : query.rows)
    if (match.return_type === 'record') return result(query.rows)
    return result(match.return_type === 'void' ? null : query.rows[0]?.value ?? null)
  }

  async function request(input) {
    const uid = input.uid || null
    if (uid && !USER_IDS.has(uid)) return errorResult('Only fixture users A/B/C are allowed', 'FIXTURE_AUTH', 401)
    const method = String(input.method || 'POST').toUpperCase()
    if (typeof input.path !== 'string' || !input.path.startsWith('/') || input.path.startsWith('//')) return errorResult('A local path is required')
    const url = new URL(input.path, 'http://127.0.0.1')
    const headers = Object.fromEntries(Object.entries(input.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]))
    let body = input.body ?? {}
    if (typeof body === 'string') body = body.trim() ? JSON.parse(body) : {}
    calls.push({ uid, method, path: url.pathname })
    if (calls.length > 1000) calls.shift()
    try {
      if (url.pathname.startsWith('/rest/v1/rpc/') && ['POST', 'GET'].includes(method)) {
        if (method === 'GET') body = Object.fromEntries(url.searchParams)
        if (body === null || Array.isArray(body) || typeof body !== 'object') return errorResult('RPC arguments must be an object')
        return await executeRpc(uid, decodeURIComponent(url.pathname.slice('/rest/v1/rpc/'.length)), body)
      }
      if (url.pathname === '/auth/v1/user' && method === 'GET') {
        if (!uid) return errorResult('No fixture session', 'FIXTURE_AUTH', 401)
        const data = await fixture.db.query('select id,email,raw_user_meta_data from auth.users where id=$1::uuid', [uid])
        const user = data.rows[0]
        return result({ id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email,
          app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: user.raw_user_meta_data,
          created_at: '2026-09-01T00:00:00Z' }, 200, 'fixture-auth-user')
      }
      const tableMatch = url.pathname.match(/^\/rest\/v1\/([a-z_][a-z0-9_]*)$/)
      const table = tableMatch?.[1]
      if (table && COMMENT_TABLES.has(table) && method === 'DELETE') {
        const filter = url.searchParams.get('id') || ''
        if (!filter.startsWith('eq.')) return errorResult('Fixture deletes require id=eq.UUID')
        const deleted = await fixture.queryAs(uid, `delete from public.${quoteIdent(table)} where id=$1::uuid returning id`, [filter.slice(3)])
        return result(deleted.rows, 200, 'actual-sql-with-fixture-delete-policy')
      }
      if (table === 'user_nicknames' && method === 'GET') {
        const filteredId = url.searchParams.get('user_id')?.replace(/^eq\./, '') || uid
        const query = await fixture.queryAs(uid, 'select nickname from public.user_nicknames where user_id=$1::uuid', [filteredId])
        const single = headers.accept?.includes('application/vnd.pgrst.object+json')
        return result(single ? query.rows[0] ?? null : query.rows, 200, 'nickname-fixture')
      }
      if (table === 'pets' && method === 'GET') {
        const filteredId = url.searchParams.get('user_id')?.replace(/^eq\./, '') || uid
        const query = await fixture.queryAs(uid, 'select id,user_id,name,kind,photo_url,created_at from public.pets where user_id=$1::uuid order by created_at', [filteredId])
        return result(query.rows, 200, 'actual-sql-with-fixture-pet-policy')
      }
      if (table && method === 'GET') {
        usedFallbacks.add(`GET:${table}`)
        return result(headers.accept?.includes('application/vnd.pgrst.object+json') ? null : [], 200, 'explicit-empty-auxiliary')
      }
      return errorResult('This fixture endpoint is not implemented', 'FIXTURE_NOT_IMPLEMENTED', 404)
    } catch (error) {
      const status = error.code === '42501' ? (uid ? 403 : 401) : 400
      return errorResult(error.message, error.code || 'FIXTURE_SQL_ERROR', status)
    }
  }

  async function seed(options = {}) {
    const count = Number(options.comments ?? 51)
    if (!Number.isInteger(count) || count < 0 || count > 2000) throw new Error('comments must be 0..2000')
    const target = options.target || 'diary'
    const mapping = { diary: ['diary_comments', 'diary_id', IDS.diary], board: ['board_comments', 'post_id', IDS.board], answer: ['answer_comments', 'answer_id', IDS.answer] }
    const selected = mapping[target]
    if (!selected) throw new Error('target must be diary, board, or answer')
    const author = options.author || 'B'
    const uid = IDS[author] || author
    if (!USER_IDS.has(uid)) throw new Error('author must identify fixture A/B/C')
    const created = await fixture.db.query(`insert into public.${selected[0]}(${selected[1]},user_id,nickname,content,created_at)
      select $1::uuid,$2::uuid,$3::text,'Fixture comment '||i::text,now()-interval '2 hours'+i*interval '1 second'
      from generate_series(1,$4::integer) i returning id,content`, [selected[2], uid, `Fixture ${author}`, count])
    return { ids: IDS, target, comments: created.rows, fixtureSetupOnly: true }
  }

  return {
    request: (input) => serialized(() => request(input)),
    reset: () => serialized(async () => { await fixture.db.close(); fixture = await prepareFixture(); usedFallbacks.clear(); calls.length = 0; return { ids: IDS, loaded: fixture.loaded, sourceReaders: fixture.sourceReaders } }),
    seed: (options) => serialized(() => seed(options)),
    health: () => ({ ready: true, ids: IDS, loaded: fixture.loaded, sourceReaders: fixture.sourceReaders,
      usedFallbacks: [...usedFallbacks], calls: calls.slice(-100), boundary: 'Isolated SQL plus explicit auxiliary/auth fixtures; production auth and RLS equivalence are not claimed.' }),
    close: () => serialized(() => fixture.db.close()),
  }
}

async function readJson(req) {
  let buffer = ''
  for await (const chunk of req) {
    buffer += chunk
    if (buffer.length > 1_000_000) throw new Error('Request body too large')
  }
  return buffer.trim() ? JSON.parse(buffer) : {}
}

export async function startUiServer(port = Number(process.env.PORT ?? 5201)) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1..65535')
  const bridge = await createUiBridge()
  const server = http.createServer(async (req, res) => {
    res.setHeader('content-type', JSON_HEADERS['content-type'])
    res.setHeader('cache-control', 'no-store')
    try {
      let output
      if (req.method === 'GET' && req.url === '/health') output = bridge.health()
      else if (req.method === 'POST' && req.url === '/request') output = await bridge.request(await readJson(req))
      else if (req.method === 'POST' && req.url === '/reset') output = await bridge.reset()
      else if (req.method === 'POST' && req.url === '/seed') output = await bridge.seed(await readJson(req))
      else { res.statusCode = 404; output = { error: 'Unknown local fixture route' } }
      res.end(JSON.stringify(output))
    } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: error.message })) }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  return { server, bridge }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { server, bridge } = await startUiServer()
  console.log(JSON.stringify({ listening: `http://127.0.0.1:${server.address().port}`, ...bridge.health() }))
  const stop = () => server.close(() => { void bridge.close().finally(() => process.exit(0)) })
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}
