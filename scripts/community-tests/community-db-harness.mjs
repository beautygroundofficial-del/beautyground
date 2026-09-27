import { loadPGlite } from './load-pglite.mjs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PGlite = await loadPGlite()
export const REPO = process.env.COMMUNITY_TEST_REPO
  ? path.resolve(process.env.COMMUNITY_TEST_REPO) : fileURLToPath(new URL('../../', import.meta.url))
export const LIVE_DEFS = process.env.COMMUNITY_TEST_LIVE_DEFS
  ? path.resolve(process.env.COMMUNITY_TEST_LIVE_DEFS)
  : fileURLToPath(new URL('./fixtures/live-function-defs-20260927.json', import.meta.url))
export const IDS = {
  A: '11111111-1111-4111-8111-111111111111',
  B: '22222222-2222-4222-8222-222222222222',
  C: '33333333-3333-4333-8333-333333333333',
  absent: '99999999-9999-4999-8999-999999999999',
  diary: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  hiddenDiary: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  board: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  hiddenBoard: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  question: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  draftQuestion: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  answer: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
  hiddenAnswer: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  unpublishedAnswer: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
}

// Test-only environment. No network clients, real accounts, production URLs or keys.
// claim_mission is explicitly a 0-point stub: point-accounting behavior is out of scope.
const schema = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create function public.is_admin() returns boolean language sql stable as $$ select false; $$;
create function public.claim_mission(text, integer) returns table(awarded integer, message text)
  language sql as $$ select 0, ''::text; $$;
create table public.diaries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, nickname text,
  content text not null, images text[] not null default '{}', like_count integer not null default 0,
  status text not null default 'visible', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), steps integer, video_url text, pet_ids uuid[] default '{}'
);
create table public.board_posts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, nickname text,
  content text not null, category text not null default 'chat', images text[] not null default '{}',
  status text not null default 'visible', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), video_url text
);
create table public.daily_questions (
  id uuid primary key default gen_random_uuid(), ask_date date not null unique,
  question text not null, hint text, status text not null default 'published',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.daily_answers (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references public.daily_questions(id) on delete cascade,
  user_id uuid not null, nickname text, content text not null, images text[] not null default '{}',
  status text not null default 'visible', created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(question_id,user_id)
);
create table public.diary_comments (
  id uuid primary key default gen_random_uuid(), diary_id uuid not null references public.diaries(id) on delete cascade,
  user_id uuid not null, nickname text, content text not null, status text not null default 'visible',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  parent_comment_id uuid references public.diary_comments(id) on delete cascade
);
create table public.board_comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.board_posts(id) on delete cascade,
  user_id uuid not null, nickname text, content text not null, status text not null default 'visible',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.answer_comments (
  id uuid primary key default gen_random_uuid(), answer_id uuid not null references public.daily_answers(id) on delete cascade,
  user_id uuid not null, nickname text, content text not null, status text not null default 'visible',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.comment_awards (user_id uuid, diary_id uuid, awarded_at timestamptz default now(), primary key(user_id,diary_id));
create table public.board_comment_awards (user_id uuid, post_id uuid, awarded_at timestamptz default now(), primary key(user_id,post_id));
create table public.answer_comment_awards (user_id uuid, answer_id uuid, awarded_at timestamptz default now(), primary key(user_id,answer_id));
create table public.diary_likes (diary_id uuid references public.diaries(id) on delete cascade, user_id uuid, created_at timestamptz default now(), primary key(diary_id,user_id));
create table public.board_likes (post_id uuid references public.board_posts(id) on delete cascade, user_id uuid, created_at timestamptz default now(), primary key(post_id,user_id));
create table public.answer_likes (answer_id uuid references public.daily_answers(id) on delete cascade, user_id uuid, created_at timestamptz default now(), primary key(answer_id,user_id));
create table public.reactions (target_type text, target_id uuid, user_id uuid, kind text, created_at timestamptz default now(), primary key(target_type,target_id,user_id));
create table public.news_seen (user_id uuid primary key, seen_at timestamptz not null default now());
create table public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted')),
  created_at timestamptz not null default now(), responded_at timestamptz,
  primary key(requester_id,addressee_id), check(requester_id <> addressee_id)
);
create table public.pets (id uuid primary key default gen_random_uuid(), user_id uuid, name text, kind text, photo_url text, created_at timestamptz default now());
`

function completeSourceFunction(source, name) {
  const pattern = new RegExp('create(?: or replace)? function public\\.' + name + '\\([\\s\\S]*?\\$\\$;', 'i')
  const match = source.match(pattern)
  if (!match) throw new Error(`Source function missing: ${name}`)
  return match[0]
}

export async function createCommunityDb({ applyNew = true } = {}) {
  const db = new PGlite()
  await db.exec(schema)
  const friendsSource = await readFile(path.join(REPO, 'supabase/friends.sql'), 'utf8')
  for (const name of ['are_friends', 'display_name_of']) await db.exec(completeSourceFunction(friendsSource, name))
  const defs = JSON.parse(await readFile(LIVE_DEFS, 'utf8'))
  for (const def of defs) await db.exec(def.definition)
  // Reproduce the existing SQL-file EXECUTE grants, which pg_get_functiondef does not export.
  const publicRead = new Set(['get_answer_comments','get_board_comments','get_diary_comments','get_diary_feed','get_question_answers'])
  for (const def of defs) {
    const types = def.args ? def.args.split(',').map(s=>s.trim().split(/\s+/).slice(1).join(' ')).join(',') : ''
    const signature = `public.${def.proname}(${types})`
    await db.exec(`revoke all on function ${signature} from public; grant execute on function ${signature} to authenticated${publicRead.has(def.proname) ? ', anon' : ''};`)
  }
  // Minimal genuine role isolation: clients cannot read auth.users or write through tables.
  for (const table of ['diaries','board_posts','daily_answers','diary_comments','board_comments','answer_comments','friendships','news_seen']) {
    await db.exec(`alter table public.${table} enable row level security;`)
  }
  await seedCommunityDb(db)
  const loaded = []
  if (applyNew) {
    for (const file of ['community_conversation_integration.sql','community_friend_request_lock.sql']) {
      const full = path.join(REPO,'supabase',file)
      await db.exec(await readFile(full,'utf8'))
      loaded.push(file)
    }
  }
  return { db, loaded, queryAs: (uid, sql, args = [], role = uid ? 'authenticated' : 'anon') => queryAs(db, uid, sql, args, role) }
}

const roleQueues = new WeakMap()
export async function queryAs(db, uid, sql, args = [], role = uid ? 'authenticated' : 'anon') {
  if (!['authenticated','anon'].includes(role)) throw new Error('Unsupported fixture role')
  // Serialize complete role/claim scopes, including HTTP callers, and reset by transaction end.
  const previous = roleQueues.get(db) || Promise.resolve()
  const next = previous.catch(() => {}).then(() => db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`)
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid || ''])
    return tx.query(sql, args)
  }))
  roleQueues.set(db, next)
  return next
}

export async function seedCommunityDb(db) {
  for (const [label, id] of Object.entries({A:IDS.A,B:IDS.B,C:IDS.C})) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id,`fixture-${label.toLowerCase()}@invalid.example`,JSON.stringify({name:`Fixture ${label}`})])
  }
  await db.query("insert into diaries(id,user_id,nickname,content,created_at) values($1,$2,'Fixture A','Older public diary', now()-interval '200 days')",[IDS.diary,IDS.A])
  await db.query("insert into diaries(id,user_id,nickname,content,status) values($1,$2,'Fixture A','Hidden diary','hidden')",[IDS.hiddenDiary,IDS.A])
  await db.query("insert into board_posts(id,user_id,nickname,content) values($1,$2,'Fixture A','Public board')",[IDS.board,IDS.A])
  await db.query("insert into board_posts(id,user_id,nickname,content,status) values($1,$2,'Fixture A','Hidden board','hidden')",[IDS.hiddenBoard,IDS.A])
  await db.query("insert into daily_questions(id,ask_date,question) values($1,current_date-100,'Old published question')",[IDS.question])
  await db.query("insert into daily_questions(id,ask_date,question,status) values($1,current_date-101,'Unpublished question','draft')",[IDS.draftQuestion])
  await db.query("insert into daily_answers(id,question_id,user_id,nickname,content,created_at) values($1,$2,$3,'Fixture A','Old answer',now()-interval '100 days')",[IDS.answer,IDS.question,IDS.A])
  await db.query("insert into daily_answers(id,question_id,user_id,nickname,content,status) values($1,$2,$3,'Fixture B','Hidden answer','hidden')",[IDS.hiddenAnswer,IDS.question,IDS.B])
  await db.query("insert into daily_answers(id,question_id,user_id,nickname,content) values($1,$2,$3,'Fixture A','Answer in draft question')",[IDS.unpublishedAnswer,IDS.draftQuestion,IDS.A])
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const fixture = await createCommunityDb({ applyNew: !process.argv.includes('--baseline') })
  const role = await fixture.queryAs(IDS.A,'select current_user as role, auth.uid() as uid')
  const functions = await fixture.db.query("select proname from pg_proc where pronamespace='public'::regnamespace order by proname")
  console.log(JSON.stringify({loaded:fixture.loaded,role:role.rows[0],functionCount:functions.rows.length},null,2))
  await fixture.db.close()
}
