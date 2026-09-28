-- 커뮤니티 댓글: 속 이야기(board)에도 답글 지원 + 댓글 좋아요 전체 추가 — 2026-09-29
--
-- 배경: 대표님 지시 "커뮤니티 글을 썼을 때 댓글단 곳에 다시 댓글을 달게 해서 무한 소통" + "좋아요도 추가".
-- diary_comments는 이미 2026-09-16에 답글(parent_comment_id)이 붙어 있고, 실제 화면(get_diary_comment_thread,
-- community_conversation_integration.sql)도 그걸 쓰는 중이다. 이 파일은 두 가지를 한다:
--   1) board_comments(속 이야기)에도 같은 방식으로 답글을 붙인다 — 지금까지 diary만 됐고 board는 없었음.
--   2) 댓글 자체에 좋아요(하트)를 새로 만든다 — diary_comments·board_comments 둘 다, 답글도 포함.
--      좋아요는 diary_likes/board_likes(게시글 좋아요)와 별개의 새 테이블(댓글 전용)이고,
--      점수 적립은 없다(댓글 작성 자체에 이미 comment_give 미션이 있어 좋아요까지 적립하면 중복 유인).
--
-- ⚠️ 실행 대상 함수 확인(2026-09-29 라이브 DB 조회로 확정): 화면이 실제로 부르는 건 get_diary_comments가
--    아니라 get_diary_comment_thread(community_conversation_integration.sql, user_id 포함 버전)다.
--    get_diary_comments는 그 함수가 아직 배포 전일 때 쓰는 폴백이라 안전을 위해 같이 갱신은 하되,
--    실제 갱신 대상은 get_diary_comment_thread다.
-- ⚠️ 실행 순서: diary_comments.sql → diary_comments_replies.sql → board.sql →
--    community_conversation_integration.sql 이 먼저 실행돼 있어야 함(전부 이미 배포 완료 상태 확인함).
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1) board_comments 답글 — diary와 동일하게 1단계만(답글의 답글 없음)
-- ────────────────────────────────────────────────────────────────
alter table public.board_comments
  add column if not exists parent_comment_id uuid references public.board_comments(id) on delete cascade;

create index if not exists idx_board_comments_parent on public.board_comments (parent_comment_id);

-- ────────────────────────────────────────────────────────────────
-- 2) 댓글 좋아요 테이블 — diary/board 각각, 댓글 1개당 유저 1표
-- ────────────────────────────────────────────────────────────────
create table if not exists public.diary_comment_likes (
  comment_id uuid not null references public.diary_comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.diary_comment_likes enable row level security;

create table if not exists public.board_comment_likes (
  comment_id uuid not null references public.board_comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.board_comment_likes enable row level security;
-- RLS는 diary_likes와 동일하게 정책 없이 켜기만 함 — 클라이언트 직접 접근 차단,
-- 아래 SECURITY DEFINER 함수(toggle_*)로만 쓰고, 개수는 get_*_comment(s|_thread)가 읽어 반환한다.

-- ────────────────────────────────────────────────────────────────
-- 3) 댓글 좋아요 토글 — diary_likes의 toggle_diary_like와 같은 패턴
-- ────────────────────────────────────────────────────────────────
create or replace function public.toggle_diary_comment_like(p_comment_id uuid)
returns table (liked boolean, like_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
  v_count integer;
begin
  if v_uid is null then
    return query select false, 0; return;
  end if;

  select exists(select 1 from public.diary_comment_likes where comment_id = p_comment_id and user_id = v_uid)
    into v_exists;

  if v_exists then
    delete from public.diary_comment_likes where comment_id = p_comment_id and user_id = v_uid;
  else
    if not exists (select 1 from public.diary_comments where id = p_comment_id and status = 'visible') then
      return query select false, 0; return;
    end if;
    insert into public.diary_comment_likes (comment_id, user_id) values (p_comment_id, v_uid)
    on conflict do nothing;
  end if;

  select count(*)::integer into v_count from public.diary_comment_likes where comment_id = p_comment_id;
  return query select (not v_exists), v_count;
end;
$$;

revoke all on function public.toggle_diary_comment_like(uuid) from public;
grant execute on function public.toggle_diary_comment_like(uuid) to authenticated;

create or replace function public.toggle_board_comment_like(p_comment_id uuid)
returns table (liked boolean, like_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
  v_count integer;
begin
  if v_uid is null then
    return query select false, 0; return;
  end if;

  select exists(select 1 from public.board_comment_likes where comment_id = p_comment_id and user_id = v_uid)
    into v_exists;

  if v_exists then
    delete from public.board_comment_likes where comment_id = p_comment_id and user_id = v_uid;
  else
    if not exists (select 1 from public.board_comments where id = p_comment_id and status = 'visible') then
      return query select false, 0; return;
    end if;
    insert into public.board_comment_likes (comment_id, user_id) values (p_comment_id, v_uid)
    on conflict do nothing;
  end if;

  select count(*)::integer into v_count from public.board_comment_likes where comment_id = p_comment_id;
  return query select (not v_exists), v_count;
end;
$$;

revoke all on function public.toggle_board_comment_like(uuid) from public;
grant execute on function public.toggle_board_comment_like(uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4) get_diary_comment_thread — 화면이 실제로 쓰는 함수. like_count·liked_by_me만 추가(나머지 동일)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.get_diary_comment_thread(uuid, integer, integer);

create function public.get_diary_comment_thread(p_diary_id uuid, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, nickname text, content text, created_at timestamptz, is_mine boolean,
  parent_comment_id uuid, user_id uuid, like_count integer, liked_by_me boolean
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id, c.user_id,
         (select count(*)::integer from public.diary_comment_likes l where l.comment_id = c.id),
         exists(select 1 from public.diary_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid())
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
    and exists (select 1 from public.diaries d where d.id = c.diary_id and d.status = 'visible')
    and (c.parent_comment_id is null or exists (select 1 from public.diary_comments parent where parent.id = c.parent_comment_id and parent.diary_id = c.diary_id and parent.status = 'visible'))
  order by
    coalesce(
      (select p.created_at from public.diary_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_diary_comment_thread(uuid, integer, integer) from public;
grant execute on function public.get_diary_comment_thread(uuid, integer, integer) to anon, authenticated;

-- 폴백용 get_diary_comments도 형태를 맞춰 갱신(정상 배포 상태에서는 클라이언트가 호출하지 않음)
drop function if exists public.get_diary_comments(uuid, integer, integer);

create function public.get_diary_comments(
  p_diary_id uuid,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, nickname text, content text, created_at timestamptz, is_mine boolean,
  parent_comment_id uuid, user_id uuid, like_count integer, liked_by_me boolean
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id, c.user_id,
         (select count(*)::integer from public.diary_comment_likes l where l.comment_id = c.id),
         exists(select 1 from public.diary_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid())
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
  order by
    coalesce(
      (select p.created_at from public.diary_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_diary_comments(uuid, integer, integer) from public;
grant execute on function public.get_diary_comments(uuid, integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5) get_board_comments — parent_comment_id·user_id·like_count·liked_by_me 추가(답글 정렬 포함)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.get_board_comments(uuid, integer, integer);

create function public.get_board_comments(p_post_id uuid, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid, nickname text, content text, created_at timestamptz, is_mine boolean,
  parent_comment_id uuid, user_id uuid, like_count integer, liked_by_me boolean
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id, c.user_id,
         (select count(*)::integer from public.board_comment_likes l where l.comment_id = c.id),
         exists(select 1 from public.board_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid())
  from public.board_comments c
  where c.post_id = p_post_id and c.status = 'visible'
    and exists (select 1 from public.board_posts d where d.id = c.post_id and d.status = 'visible')
    and (c.parent_comment_id is null or exists (select 1 from public.board_comments parent where parent.id = c.parent_comment_id and parent.post_id = c.post_id and parent.status = 'visible'))
  order by
    coalesce(
      (select p.created_at from public.board_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_board_comments(uuid, integer, integer) from public;
grant execute on function public.get_board_comments(uuid, integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6) create_board_comment — p_parent_comment_id 추가(create_diary_comment와 동일한 1단계 제한 로직)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.create_board_comment(uuid, text, text);

create function public.create_board_comment(
  p_post_id uuid,
  p_content text,
  p_nickname text default null,
  p_parent_comment_id uuid default null
)
returns table (comment_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_author  uuid;
  v_len     integer;
  v_claim   record;
  v_awarded integer := 0;
  v_parent  public.board_comments%rowtype;
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;

  v_len := length(btrim(coalesce(p_content, '')));
  if v_len = 0 then
    return query select null::uuid, 0, '댓글을 입력해 주세요'::text; return;
  end if;
  if v_len > 500 then
    return query select null::uuid, 0, '500자 안으로 적어주세요'::text; return;
  end if;

  select b.user_id into v_author from public.board_posts b
   where b.id = p_post_id and b.status = 'visible';
  if v_author is null then
    return query select null::uuid, 0, '이미 지워진 이야기예요'::text; return;
  end if;

  if p_parent_comment_id is not null then
    select * into v_parent from public.board_comments p
     where p.id = p_parent_comment_id and p.post_id = p_post_id and p.status = 'visible';
    if v_parent.id is null then
      return query select null::uuid, 0, '이미 지워진 댓글이에요'::text; return;
    end if;
    if v_parent.parent_comment_id is not null then
      return query select null::uuid, 0, '답글에는 답글을 달 수 없어요'::text; return;
    end if;
  end if;

  insert into public.board_comments (post_id, user_id, nickname, content, parent_comment_id)
  values (p_post_id, v_uid, p_nickname, btrim(p_content), p_parent_comment_id)
  returning id into v_id;

  if v_author <> v_uid and v_len >= 5
     and not exists (
       select 1 from public.board_comment_awards w
       where w.user_id = v_uid and w.post_id = p_post_id
     )
  then
    select * into v_claim from public.claim_mission('comment_give', 1);
    v_awarded := coalesce(v_claim.awarded, 0);
    if v_awarded > 0 then
      insert into public.board_comment_awards (user_id, post_id) values (v_uid, p_post_id)
      on conflict do nothing;
    end if;
  end if;

  return query select v_id, v_awarded, ''::text;
end;
$$;

revoke all on function public.create_board_comment(uuid, text, text, uuid) from public;
grant execute on function public.create_board_comment(uuid, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
