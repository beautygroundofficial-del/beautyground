-- 커뮤니티 사용자 차단 + 금칙어 가리기 (2026-09-28)
-- 목적: 앱 심사 조건 — Apple 1.2 User-Generated Content(필터·신고·차단·연락처 4종) / Google Play 사용자 생성 콘텐츠 정책.
-- 신고(report_board_post)·연락처는 이미 있음. 여기서 ①차단(user_blocks) ②금칙어 가리기(banned_words + 트리거)를 추가한다.
-- 아래 get_* 함수들은 2026-09-28 운영 DB의 pg_get_functiondef 원문에 "차단한 사람 제외" 조건 한 줄씩만 끼운 것이다(스크립트 생성).
-- 실행: 대표님 승인 후 scripts/db_query.mjs 로 1회. 재실행 안전.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1) 차단
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists idx_user_blocks_blocked on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
drop policy if exists user_blocks_own on public.user_blocks;
create policy user_blocks_own on public.user_blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

-- "내가 이 사람을 차단했나" — 피드·댓글·소식 함수에서 공통으로 쓴다. 비로그인(auth.uid() null)은 항상 false.
create or replace function public.is_blocked_by_me(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and p_user_id is not null and exists (
    select 1 from public.user_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_user_id
  );
$$;
grant execute on function public.is_blocked_by_me(uuid) to anon, authenticated;

-- 차단: 기록 + 친구 관계·친구 신청은 양방향 모두 끊는다
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception '자기 자신은 차단할 수 없습니다.'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id)
  on conflict do nothing;
  delete from public.friendships f
  where (f.requester_id = auth.uid() and f.addressee_id = p_user_id)
     or (f.requester_id = p_user_id and f.addressee_id = auth.uid());
end;
$$;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user_id;
$$;
revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

-- 내 차단 목록(마이페이지 > 차단 관리)
create or replace function public.get_my_blocks()
returns table (user_id uuid, nickname text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, public.display_name_of(b.blocked_id), b.created_at
  from public.user_blocks b
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;
revoke all on function public.get_my_blocks() from public;
grant execute on function public.get_my_blocks() to authenticated;

-- 차단한 사람은 내 글에 댓글을 못 남긴다(역방향). 댓글 insert 트리거로 막는다.
create or replace function public.community_guard_blocked_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'board_comments' then
    select user_id into v_owner from public.board_posts where id = new.post_id;
  elsif tg_table_name = 'diary_comments' then
    select user_id into v_owner from public.diaries where id = new.diary_id;
  elsif tg_table_name = 'answer_comments' then
    select user_id into v_owner from public.daily_answers where id = new.answer_id;
  end if;
  if v_owner is not null and exists (select 1 from public.user_blocks b where b.blocker_id = v_owner and b.blocked_id = auth.uid()) then
    raise exception '이 글에는 댓글을 남길 수 없어요.';
  end if;
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['board_comments','diary_comments','answer_comments'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_blocked', t);
    execute format('create trigger %I before insert on public.%I for each row execute function public.community_guard_blocked_actor()', t || '_guard_blocked', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 2) 금칙어 가리기 — 글·댓글·닉네임 저장 시 욕설·비하 표현을 ***로 바꾼다(글 자체는 막지 않음, 오탐 시 글이 사라지지 않게)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.banned_words (
  word text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table public.banned_words enable row level security;
drop policy if exists banned_words_admin on public.banned_words;
create policy banned_words_admin on public.banned_words for all using (public.is_admin()) with check (public.is_admin());

insert into public.banned_words (word, note) values
  ('시발','욕설'),('씨발','욕설'),('씨팔','욕설'),('시팔','욕설'),('ㅅㅂ','욕설'),('ㅆㅂ','욕설'),
  ('병신','비하'),('ㅂㅅ','비하'),('븅신','비하'),('빙신','비하'),
  ('개새끼','욕설'),('개새키','욕설'),('개세끼','욕설'),('새끼야','욕설'),('ㄱㅅㄲ','욕설'),
  ('좆','욕설'),('존나','욕설'),('ㅈㄴ','욕설'),('졸라','욕설'),
  ('미친년','비하'),('미친놈','비하'),('썅년','비하'),('썅놈','비하'),('걸레년','비하'),
  ('지랄','욕설'),('ㅈㄹ','욕설'),('염병','욕설'),('엿먹','욕설'),('꺼져','욕설'),
  ('느금마','비하'),('니미','욕설'),('닥쳐','욕설'),('창녀','비하'),('보지','성적'),('자지','성적'),
  ('장애인새끼','비하'),('틀딱','비하'),('한남충','비하'),('김치녀','비하'),('맘충','비하'),
  ('죽여버','위협'),('죽일','위협'),('자살해','위협')
on conflict (word) do nothing;

create or replace function public.mask_banned_words(p_text text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text := p_text;
  w record;
begin
  if v is null or v = '' then return v; end if;
  for w in select word from public.banned_words loop
    -- 공백·점·별표를 끼워 넣은 변형(시.발, 시 발)도 같이 잡는다
    v := regexp_replace(v, regexp_replace(w.word, '(.)', '\1[[:space:].*_-]*', 'g'), repeat('*', length(w.word)), 'gi');
  end loop;
  return v;
end;
$$;
grant execute on function public.mask_banned_words(text) to anon, authenticated;

create or replace function public.community_mask_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;
  new.content := public.mask_banned_words(new.content);
  new.nickname := public.mask_banned_words(new.nickname);
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['board_posts','board_comments','diaries','diary_comments','answer_comments','daily_answers'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_mask_content', t);
    execute format('create trigger %I before insert or update of content, nickname on public.%I for each row execute function public.community_mask_content()', t || '_mask_content', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 3) 피드·댓글·소식·프로필 함수에 "차단한 사람 제외" 한 줄씩 (운영 원문 기반 자동 생성)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_board_feed(p_categories text[] DEFAULT '{}'::text[], p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, user_id uuid, nickname text, category text, content text, images text[], is_mine boolean, created_at timestamp with time zone, pat integer, same integer, cheer integer, my_kind text, comment_count integer, video_url text, like_count integer, liked_by_me boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()), b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.video_url,
         (select count(*)::integer from public.board_likes l where l.post_id = b.id),
         exists(select 1 from public.board_likes l where l.post_id = b.id and l.user_id = auth.uid())
  from public.board_posts b
  where b.status = 'visible'
    and not public.is_blocked_by_me(b.user_id)
    and (coalesce(array_length(p_categories, 1), 0) = 0 or b.category = any(p_categories))
  order by b.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_board_post(p_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, nickname text, category text, content text, images text[], is_mine boolean, created_at timestamp with time zone, pat integer, same integer, cheer integer, my_kind text, comment_count integer, video_url text, like_count integer, liked_by_me boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()), b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.video_url,
         (select count(*)::integer from public.board_likes l where l.post_id = b.id),
         exists(select 1 from public.board_likes l where l.post_id = b.id and l.user_id = auth.uid())
  from public.board_posts b
  where b.id = p_id
    and not public.is_blocked_by_me(b.user_id)
    and (b.status = 'visible' or b.user_id = auth.uid() or public.is_admin());
$function$;

CREATE OR REPLACE FUNCTION public.get_board_comments(p_post_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid())
  from public.board_comments c
  where c.post_id = p_post_id and c.status = 'visible'
    and not public.is_blocked_by_me(c.user_id)
    and exists (select 1 from public.board_posts d where d.id = c.post_id and d.status = 'visible')
  order by c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_diary_feed(p_sort text DEFAULT 'recent'::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, user_id uuid, nickname text, content text, images text[], like_count integer, liked_by_me boolean, is_mine boolean, created_at timestamp with time zone, pat integer, same integer, cheer integer, my_kind text, comment_count integer, steps integer, video_url text, pets jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.user_id, d.nickname, d.content, d.images,
         d.like_count,
         exists(select 1 from public.diary_likes l where l.diary_id = d.id and l.user_id = auth.uid()),
         (d.user_id = auth.uid()),
         d.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.diary_comments c where c.diary_id = d.id and c.status = 'visible'),
         d.steps,
         d.video_url,
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'photo_url', p.photo_url) order by p.created_at)
                   from public.pets p where p.id = any(d.pet_ids)), '[]'::jsonb)
  from public.diaries d
  where d.status = 'visible'
    and not public.is_blocked_by_me(d.user_id)
    and (p_sort <> 'walk' or coalesce(array_length(d.pet_ids, 1), 0) > 0)
  order by
    case when p_sort = 'popular'
      then (select count(*) from public.reactions r where r.target_type = 'diary' and r.target_id = d.id)
    end desc nulls last,
    d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_friend_diary_feed(p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, user_id uuid, nickname text, content text, images text[], like_count integer, liked_by_me boolean, is_mine boolean, created_at timestamp with time zone, pat integer, same integer, cheer integer, my_kind text, comment_count integer, steps integer, video_url text, pets jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.user_id, d.nickname, d.content, d.images,
         d.like_count,
         exists(select 1 from public.diary_likes l where l.diary_id = d.id and l.user_id = auth.uid()),
         (d.user_id = auth.uid()),
         d.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.diary_comments c where c.diary_id = d.id and c.status = 'visible'),
         d.steps,
         d.video_url,
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'photo_url', p.photo_url) order by p.created_at)
                   from public.pets p where p.id = any(d.pet_ids)), '[]'::jsonb)
  from public.diaries d
  where d.status = 'visible'
    and not public.is_blocked_by_me(d.user_id)
    and auth.uid() is not null
    and (d.user_id = auth.uid() or public.are_friends(auth.uid(), d.user_id))
  order by d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_diary_comments(p_diary_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean, parent_comment_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
    and not public.is_blocked_by_me(c.user_id)
    and exists (select 1 from public.diaries d where d.id = c.diary_id and d.status = 'visible')
    and (c.parent_comment_id is null or exists (select 1 from public.diary_comments parent where parent.id = c.parent_comment_id and parent.diary_id = c.diary_id and parent.status = 'visible'))
  order by
    coalesce(
      (select p.created_at from public.diary_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_answer_comments(p_answer_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid())
  from public.answer_comments c
  where c.answer_id = p_answer_id and c.status = 'visible'
    and not public.is_blocked_by_me(c.user_id)
    and exists (select 1 from public.daily_answers d where d.id = c.answer_id and d.status = 'visible' and exists (select 1 from public.daily_questions q where q.id = d.question_id and q.status = 'published'))
  order by c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_question_answers(p_question_id uuid, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean, pat integer, same integer, cheer integer, my_kind text, images text[], like_count integer, liked_by_me boolean, comment_count integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.nickname, a.content, a.created_at,
         (a.user_id = auth.uid()),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.user_id = auth.uid()),
         a.images,
         (select count(*)::integer from public.answer_likes l where l.answer_id = a.id),
         exists(select 1 from public.answer_likes l where l.answer_id = a.id and l.user_id = auth.uid()),
         (select count(*)::integer from public.answer_comments c where c.answer_id = a.id and c.status = 'visible')
  from public.daily_answers a
  where a.question_id = p_question_id and a.status = 'visible'
    and not public.is_blocked_by_me(a.user_id)
  order by (a.user_id = auth.uid()) desc, a.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_community_answer(p_answer_id uuid)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean, pat integer, same integer, cheer integer, my_kind text, images text[], like_count integer, liked_by_me boolean, comment_count integer, question_id uuid, question text, hint text, ask_date date)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.nickname, a.content, a.created_at,
         (a.user_id = auth.uid()),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.user_id = auth.uid()),
         a.images,
         (select count(*)::integer from public.answer_likes l where l.answer_id = a.id),
         exists(select 1 from public.answer_likes l where l.answer_id = a.id and l.user_id = auth.uid()),
         (select count(*)::integer from public.answer_comments c where c.answer_id = a.id and c.status = 'visible'),
         q.id, q.question, q.hint, q.ask_date
  from public.daily_answers a join public.daily_questions q on q.id = a.question_id
  where a.id = p_answer_id and a.status = 'visible' and not public.is_blocked_by_me(a.user_id) and q.status = 'published';
$function$;

CREATE OR REPLACE FUNCTION public.get_user_diary_feed(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, user_id uuid, nickname text, content text, images text[], like_count integer, liked_by_me boolean, is_mine boolean, created_at timestamp with time zone, pat integer, same integer, cheer integer, my_kind text, comment_count integer, steps integer, video_url text, pets jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.user_id, d.nickname, d.content, d.images,
         d.like_count,
         exists(select 1 from public.diary_likes l where l.diary_id = d.id and l.user_id = auth.uid()),
         (d.user_id = auth.uid()),
         d.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.diary_comments c where c.diary_id = d.id and c.status = 'visible'),
         d.steps,
         d.video_url,
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'photo_url', p.photo_url) order by p.created_at)
                   from public.pets p where p.id = any(d.pet_ids)), '[]'::jsonb)
  from public.diaries d
  where d.status = 'visible' and d.user_id = p_user_id
    and not public.is_blocked_by_me(d.user_id)
  order by d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_news(p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, target_type text, target_id uuid, actor_nickname text, actor_user_id uuid, excerpt text, comment_text text, reaction_kind text, created_at timestamp with time zone, is_new boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select n.kind,n.target_type,n.target_id,n.actor_nickname,n.actor_user_id,n.excerpt,n.comment_text,n.reaction_kind,n.created_at,n.is_new
 from public.get_community_news(p_limit) n
 where not public.is_blocked_by_me(n.actor_user_id);
$function$;

commit;
