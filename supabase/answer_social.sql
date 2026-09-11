-- 오늘의 질문 답변에 하트·댓글·사진 — 2026-09-11 대표님 지시
-- "이런 커뮤니티 게시판에 모두 하트 말풍선 이미지 업로드 기능 넣어라"
--
-- 하루 이야기(diary_likes·diary_comments)·속 이야기(board_likes·board_comments)와 같은 구조를 답변(daily_answers)에도 붙인다.
--   · daily_answers.images — 사진(최대 2장, 화면에서 제한)
--   · answer_likes + toggle_answer_like — 하트(내 답엔 못 누름, 포인트 없음)
--   · answer_comments(+awards) + get/create_answer_comment — 댓글(남의 답에 5자 이상 첫 댓글만 comment_give 적립, 글당 평생 1회)
--   · answer_today_question(+p_images) / get_today_question(+my_images) / get_question_answers(+images·like_count·liked_by_me·comment_count)
-- ⚠️ 반환 컬럼이 늘어나는 함수 3개는 drop 후 재생성. 기존 데이터는 건드리지 않는다.
-- ⚠️ 실행 전 대표님 승인 필요(2026-09-11 방침). 실행: Supabase 대시보드(beautyground-main) → SQL Editor

-- 1) 사진
alter table public.daily_answers add column if not exists images text[] not null default '{}';

-- 2) 하트
create table if not exists public.answer_likes (
  answer_id  uuid not null references public.daily_answers(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);
create index if not exists idx_answer_likes_user on public.answer_likes (user_id);
alter table public.answer_likes enable row level security;
drop policy if exists answer_likes_read on public.answer_likes;
create policy answer_likes_read on public.answer_likes for select using (true);
drop policy if exists answer_likes_own_write on public.answer_likes;
create policy answer_likes_own_write on public.answer_likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.toggle_answer_like(p_answer_id uuid)
returns table (liked boolean, like_count integer)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
  v_count integer;
begin
  if v_uid is null then return query select false, 0; return; end if;
  if exists (select 1 from public.daily_answers a where a.id = p_answer_id and a.user_id = v_uid) then
    select count(*)::integer into v_count from public.answer_likes l where l.answer_id = p_answer_id;
    return query select false, v_count; return;
  end if;
  select exists(select 1 from public.answer_likes l where l.answer_id = p_answer_id and l.user_id = v_uid) into v_exists;
  if v_exists then
    delete from public.answer_likes where answer_id = p_answer_id and user_id = v_uid;
  else
    insert into public.answer_likes (answer_id, user_id) values (p_answer_id, v_uid) on conflict do nothing;
  end if;
  select count(*)::integer into v_count from public.answer_likes l where l.answer_id = p_answer_id;
  return query select (not v_exists), v_count;
end;
$$;
revoke all on function public.toggle_answer_like(uuid) from public;
grant execute on function public.toggle_answer_like(uuid) to authenticated;

-- 3) 댓글
create table if not exists public.answer_comments (
  id         uuid primary key default gen_random_uuid(),
  answer_id  uuid not null references public.daily_answers(id) on delete cascade,
  user_id    uuid not null,
  nickname   text,
  content    text not null,
  status     text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_answer_comments_feed on public.answer_comments (answer_id, status, created_at);
create index if not exists idx_answer_comments_user on public.answer_comments (user_id, created_at desc);

create table if not exists public.answer_comment_awards (
  user_id    uuid not null,
  answer_id  uuid not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, answer_id)
);

alter table public.answer_comments       enable row level security;
alter table public.answer_comment_awards enable row level security;
drop policy if exists answer_comments_public_read on public.answer_comments;
create policy answer_comments_public_read on public.answer_comments for select using (status = 'visible');
drop policy if exists answer_comments_own_all on public.answer_comments;
create policy answer_comments_own_all on public.answer_comments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists answer_comments_admin_all on public.answer_comments;
create policy answer_comments_admin_all on public.answer_comments
  for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists answer_comment_awards_own_read on public.answer_comment_awards;
create policy answer_comment_awards_own_read on public.answer_comment_awards for select using (auth.uid() = user_id);

create or replace function public.get_answer_comments(
  p_answer_id uuid,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (id uuid, nickname text, content text, created_at timestamptz, is_mine boolean)
language sql security definer set search_path = public as $$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid())
  from public.answer_comments c
  where c.answer_id = p_answer_id and c.status = 'visible'
  order by c.created_at asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_answer_comments(uuid, integer, integer) from public;
grant execute on function public.get_answer_comments(uuid, integer, integer) to anon, authenticated;

create or replace function public.create_answer_comment(
  p_answer_id uuid,
  p_content   text,
  p_nickname  text default null
)
returns table (comment_id uuid, awarded integer, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_author  uuid;
  v_len     integer;
  v_claim   record;
  v_awarded integer := 0;
begin
  if v_uid is null then return query select null::uuid, 0, '로그인이 필요합니다'::text; return; end if;
  v_len := length(btrim(coalesce(p_content, '')));
  if v_len = 0 then return query select null::uuid, 0, '댓글을 입력해 주세요'::text; return; end if;
  if v_len > 500 then return query select null::uuid, 0, '500자 안으로 적어주세요'::text; return; end if;

  select a.user_id into v_author from public.daily_answers a where a.id = p_answer_id and a.status = 'visible';
  if v_author is null then return query select null::uuid, 0, '이미 지워진 답이에요'::text; return; end if;

  insert into public.answer_comments (answer_id, user_id, nickname, content)
  values (p_answer_id, v_uid, p_nickname, btrim(p_content))
  returning id into v_id;

  if v_author <> v_uid and v_len >= 5
     and not exists (select 1 from public.answer_comment_awards w where w.user_id = v_uid and w.answer_id = p_answer_id)
  then
    select * into v_claim from public.claim_mission('comment_give', 1);
    v_awarded := coalesce(v_claim.awarded, 0);
    if v_awarded > 0 then
      insert into public.answer_comment_awards (user_id, answer_id) values (v_uid, p_answer_id) on conflict do nothing;
    end if;
  end if;

  return query select v_id, v_awarded, ''::text;
end;
$$;
revoke all on function public.create_answer_comment(uuid, text, text) from public;
grant execute on function public.create_answer_comment(uuid, text, text) to authenticated;

-- 4) 답하기 — 사진 받기(사진만 있고 글이 없어도 된다)
drop function if exists public.answer_today_question(uuid, text, text);
create function public.answer_today_question(
  p_question_id uuid,
  p_content     text,
  p_nickname    text default null,
  p_images      text[] default null
)
returns table (answer_id uuid, awarded integer, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_id     uuid;
  v_first  boolean;
  v_claim  record;
  v_text   text := btrim(coalesce(p_content, ''));
  v_images text[] := coalesce(p_images, '{}');
begin
  if v_uid is null then return query select null::uuid, 0, '로그인이 필요합니다'::text; return; end if;
  if length(v_text) = 0 and coalesce(array_length(v_images, 1), 0) = 0 then
    return query select null::uuid, 0, '한 줄만 적어주세요'::text; return;
  end if;
  if length(v_text) > 300 then return query select null::uuid, 0, '너무 길어요. 300자 안으로 적어주세요'::text; return; end if;
  if coalesce(array_length(v_images, 1), 0) > 2 then return query select null::uuid, 0, '사진은 2장까지 올릴 수 있어요'::text; return; end if;
  if not exists (select 1 from public.daily_questions q where q.id = p_question_id and q.status = 'published') then
    return query select null::uuid, 0, '지금은 답할 수 없는 질문이에요'::text; return;
  end if;

  select not exists (select 1 from public.daily_answers a where a.question_id = p_question_id and a.user_id = v_uid) into v_first;

  insert into public.daily_answers (question_id, user_id, nickname, content, images)
  values (p_question_id, v_uid, p_nickname, v_text, v_images)
  on conflict (question_id, user_id) do update
    set content    = excluded.content,
        images     = excluded.images,
        nickname   = coalesce(excluded.nickname, public.daily_answers.nickname),
        updated_at = now()
  returning id into v_id;

  if v_first then
    select * into v_claim from public.claim_mission('question_answer', 1);
  end if;

  return query select v_id, coalesce(v_claim.awarded, 0), ''::text;
end;
$$;
revoke all on function public.answer_today_question(uuid, text, text, text[]) from public;
grant execute on function public.answer_today_question(uuid, text, text, text[]) to authenticated;

-- 5) 오늘의 질문 — 내 답 사진도 같이
drop function if exists public.get_today_question();
create function public.get_today_question()
returns table (
  id uuid, ask_date date, question text, hint text,
  answer_count integer, my_answer text, my_answer_id uuid, my_images text[]
)
language sql security definer set search_path = public as $$
  select q.id, q.ask_date, q.question, q.hint,
         (select count(*)::integer from public.daily_answers a where a.question_id = q.id and a.status = 'visible'),
         (select a.content from public.daily_answers a where a.question_id = q.id and a.user_id = auth.uid()),
         (select a.id from public.daily_answers a where a.question_id = q.id and a.user_id = auth.uid()),
         (select a.images from public.daily_answers a where a.question_id = q.id and a.user_id = auth.uid())
  from public.daily_questions q
  where q.status = 'published'
    and q.ask_date = (now() at time zone 'Asia/Seoul')::date
  limit 1;
$$;
revoke all on function public.get_today_question() from public;
grant execute on function public.get_today_question() to anon, authenticated;

-- 6) 답 목록 — 사진·하트·댓글 수
drop function if exists public.get_question_answers(uuid, integer, integer);
create function public.get_question_answers(
  p_question_id uuid,
  p_limit  integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid, nickname text, content text, created_at timestamptz, is_mine boolean,
  pat integer, same integer, cheer integer, my_kind text,
  images text[], like_count integer, liked_by_me boolean, comment_count integer
)
language sql security definer set search_path = public as $$
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
  order by (a.user_id = auth.uid()) desc, a.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_question_answers(uuid, integer, integer) from public;
grant execute on function public.get_question_answers(uuid, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
