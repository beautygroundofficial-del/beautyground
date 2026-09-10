-- 속 이야기 연결 — 마이페이지·오늘의 활동·새 소식·신고 관리 (2026-09-10)
-- 커뮤니티 로드맵 4-4 ②③④. board.sql 을 먼저 실행한 뒤 실행하세요.
-- 실행: Supabase 대시보드(beautyground-main, bjqtuklkskrqzbuxdwxm) → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1) 내가 쓴 속 이야기 (마이페이지 → 내 글 모아보기)
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_my_board_posts(
  p_limit  integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, nickname text, category text, content text, images text[],
  is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text, comment_count integer,
  status text
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         true, b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         null::text,
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.status
  from public.board_posts b
  where b.user_id = auth.uid()
  order by b.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_my_board_posts(integer, integer) from public;
grant execute on function public.get_my_board_posts(integer, integer) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2) 오늘의 활동에 속 이야기 반영 — 반환 컬럼이 늘어 drop 후 재생성
--    comment_count 는 하루 이야기 댓글 + 속 이야기 댓글 합
-- ────────────────────────────────────────────────────────────────
drop function if exists public.get_my_today_activity();

create function public.get_my_today_activity()
returns table (
  answered_question boolean,
  question_text      text,
  my_answer          text,
  diary_count        integer,
  latest_diary       text,
  reaction_count     integer,
  comment_count      integer,
  points_today       integer,
  phone_verified     boolean,
  board_count        integer,
  latest_board       text
)
language sql
security definer
set search_path = public
as $$
  with today as (
    select (now() at time zone 'Asia/Seoul')::date as d
  )
  select
    (a.id is not null),
    q.question,
    a.content,
    coalesce(dc.cnt, 0)::int,
    dl.content,
    coalesce(rc.cnt, 0)::int,
    (coalesce(cc.cnt, 0) + coalesce(bc.cnt, 0))::int,
    coalesce(pt.sum_amount, 0)::int,
    exists(select 1 from public.phone_verifications v where v.user_id = auth.uid()),
    coalesce(bcnt.cnt, 0)::int,
    bl.content
  from today
  left join public.daily_questions q
    on q.ask_date = today.d and q.status = 'published'
  left join public.daily_answers a
    on a.question_id = q.id and a.user_id = auth.uid() and a.status = 'visible'
  left join lateral (
    select count(*) as cnt from public.diaries d
    where d.user_id = auth.uid() and d.status = 'visible'
      and (d.created_at at time zone 'Asia/Seoul')::date = today.d
  ) dc on true
  left join lateral (
    select d.content from public.diaries d
    where d.user_id = auth.uid() and d.status = 'visible'
      and (d.created_at at time zone 'Asia/Seoul')::date = today.d
    order by d.created_at desc limit 1
  ) dl on true
  left join lateral (
    select count(*) as cnt from public.reactions r
    where r.user_id = auth.uid()
      and (r.created_at at time zone 'Asia/Seoul')::date = today.d
  ) rc on true
  left join lateral (
    select count(*) as cnt from public.diary_comments c
    where c.user_id = auth.uid() and c.status = 'visible'
      and (c.created_at at time zone 'Asia/Seoul')::date = today.d
  ) cc on true
  left join lateral (
    select count(*) as cnt from public.board_comments c
    where c.user_id = auth.uid() and c.status = 'visible'
      and (c.created_at at time zone 'Asia/Seoul')::date = today.d
  ) bc on true
  left join lateral (
    select count(*) as cnt from public.board_posts b
    where b.user_id = auth.uid() and b.status = 'visible'
      and (b.created_at at time zone 'Asia/Seoul')::date = today.d
  ) bcnt on true
  left join lateral (
    select b.content from public.board_posts b
    where b.user_id = auth.uid() and b.status = 'visible'
      and (b.created_at at time zone 'Asia/Seoul')::date = today.d
    order by b.created_at desc limit 1
  ) bl on true
  left join lateral (
    select sum(p.amount) as sum_amount from public.point_transactions p
    where p.user_id = auth.uid() and p.amount > 0
      and (p.created_at at time zone 'Asia/Seoul')::date = today.d
  ) pt on true;
$$;

revoke all on function public.get_my_today_activity() from public;
grant execute on function public.get_my_today_activity() to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3) 새 소식 — 내 글(하루 이야기·속 이야기)에 달린 댓글·공감
--    재촉하지 않는다: 뱃지는 개수만, 읽으면 사라진다. 푸시는 안 보낸다(라이브 팔로우 푸시와 별개).
-- ────────────────────────────────────────────────────────────────
create table if not exists public.news_seen (
  user_id uuid primary key,
  seen_at timestamptz not null default now()
);
alter table public.news_seen enable row level security;
drop policy if exists news_seen_own on public.news_seen;
create policy news_seen_own on public.news_seen
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.get_my_news(p_limit integer default 30)
returns table (
  kind text,            -- board_comment | board_reaction | diary_comment | diary_reaction
  target_type text,     -- board | diary
  target_id uuid,
  actor_nickname text,  -- 공감은 닉네임이 없어 null → 화면에서 "누군가"
  excerpt text,         -- 내 글 앞부분
  comment_text text,
  reaction_kind text,
  created_at timestamptz,
  is_new boolean
)
language sql
security definer
set search_path = public
as $$
  with seen as (
    select coalesce((select s.seen_at from public.news_seen s where s.user_id = auth.uid()), 'epoch'::timestamptz) as at
  ),
  items as (
    select 'board_comment'::text as kind, 'board'::text as target_type, b.id as target_id,
           c.nickname as actor_nickname, left(b.content, 60) as excerpt, c.content as comment_text,
           null::text as reaction_kind, c.created_at
    from public.board_comments c
    join public.board_posts b on b.id = c.post_id
    where b.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'board_reaction', 'board', b.id, null, left(b.content, 60), null, r.kind, r.created_at
    from public.reactions r
    join public.board_posts b on r.target_type = 'board' and b.id = r.target_id
    where b.user_id = auth.uid() and r.user_id <> auth.uid()
    union all
    select 'diary_comment', 'diary', d.id, c.nickname, left(d.content, 60), c.content, null, c.created_at
    from public.diary_comments c
    join public.diaries d on d.id = c.diary_id
    where d.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'diary_reaction', 'diary', d.id, null, left(d.content, 60), null, r.kind, r.created_at
    from public.reactions r
    join public.diaries d on r.target_type = 'diary' and d.id = r.target_id
    where d.user_id = auth.uid() and r.user_id <> auth.uid()
  )
  select i.kind, i.target_type, i.target_id, i.actor_nickname, i.excerpt, i.comment_text, i.reaction_kind,
         i.created_at, (i.created_at > seen.at)
  from items i, seen
  order by i.created_at desc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.get_my_news(integer) from public;
grant execute on function public.get_my_news(integer) to authenticated;

create or replace function public.get_my_news_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.get_my_news(100) n where n.is_new;
$$;

revoke all on function public.get_my_news_count() from public;
grant execute on function public.get_my_news_count() to authenticated;

create or replace function public.mark_news_seen()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.news_seen (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = now();
$$;

revoke all on function public.mark_news_seen() from public;
grant execute on function public.mark_news_seen() to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4) 신고 관리 — 관리자만. 신고된 글 목록(신고 수·사유 모음). 숨김/복구는 board_posts 를 직접 update(관리자 RLS).
-- ────────────────────────────────────────────────────────────────
create or replace function public.admin_board_reports()
returns table (
  post_id uuid, category text, content text, nickname text, status text, post_created_at timestamptz,
  report_count integer, last_reported_at timestamptz, reasons text
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.category, b.content, b.nickname, b.status, b.created_at,
         count(r.*)::integer, max(r.created_at),
         string_agg(nullif(btrim(r.reason), ''), ' / ' order by r.created_at desc)
  from public.board_reports r
  join public.board_posts b on b.id = r.post_id
  where public.is_admin()
  group by b.id, b.category, b.content, b.nickname, b.status, b.created_at
  order by max(r.created_at) desc;
$$;

revoke all on function public.admin_board_reports() from public;
grant execute on function public.admin_board_reports() to authenticated;

notify pgrst, 'reload schema';
