-- 오늘의 질문 + 토닥토닥 반응 — 2026-09-07
--
-- 대표님 지시: "소비자가 우리 커뮤니티에서 놀 수 있는 곳, 휴식을 취하는 곳으로."
--
-- 왜 만드는가 —
--  ① 지금 커뮤니티는 '글 쓰는 사람'만을 위한 곳이라 글이 0건인 채로 멈춰 있다. 포인트가 적어서가
--     아니라 쓸 말이 없어서다. 하루 한 개의 질문에 '한 줄'만 답하면 되는 자리를 만들면,
--     글을 못 쓰는 사람도 참여가 되고 매일 들어올 이유가 생긴다.
--  ② 좋아요는 '평가'라 잘 쓴 글에만 몰리고 등수가 생긴다. 감정 반응(토닥토닥·나도 그래요·
--     응원해요)으로 바꾸면 평가가 아니라 공감이 된다.
--
-- ⚠️ 재촉 장치는 넣지 않는다 — 마감 타이머·당일 소멸·N명 남음 없음(히로인스는 체류시간을 광고로
--    파는 구조라 재촉이 필수지만, 우리는 상품 판매 수수료로 벌기 때문에 붙잡아둘 이유가 없다).
--
-- 포인트 (2026-09-07 대표님 지시 "공감·댓글 남겼을 때도 포인트, 점수는 나중에 설정") —
--   question_answer : 오늘의 질문에 답하면
--   reaction_give   : 남의 글/답에 공감을 남기면
-- 둘 다 claim_mission 을 부르므로 점수·하루 상한(max_per_day)은 /admin/missions 에서 정한다.
-- ⚠️ 미션을 등록하지 않으면 0P — 이 SQL을 실행해도 포인트는 한 푼도 나가지 않는다.
-- ⚠️ 어뷰징 방지: 자기 글에는 적립하지 않고, 이미 누른 것을 취소했다 다시 눌러도 재적립하지 않는다
--    (처음 누를 때만 적립). 화면에서는 포인트를 앞세우지 않는다 — 앞세우면 거래 게시판이 된다.
--
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1) daily_questions — 관리자가 등록하는 하루 한 개의 질문
-- ────────────────────────────────────────────────────────────────
create table if not exists public.daily_questions (
  id         uuid primary key default gen_random_uuid(),
  ask_date   date not null unique,                      -- 이 질문이 걸리는 날(KST 기준). 하루 한 개.
  question   text not null,
  hint       text,                                      -- 답을 어렵게 느끼지 않도록 곁들이는 한 줄(선택)
  status     text not null default 'published'
             check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.daily_questions is '오늘의 질문 — 하루 한 개, 한 줄로 답하는 커뮤니티 놀거리';

create index if not exists idx_daily_questions_date on public.daily_questions (status, ask_date desc);

-- ────────────────────────────────────────────────────────────────
-- 2) daily_answers — 한 사람당 한 질문에 한 줄
-- ────────────────────────────────────────────────────────────────
create table if not exists public.daily_answers (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.daily_questions(id) on delete cascade,
  user_id     uuid not null,
  nickname    text,                                     -- 작성 시점 표시 이름(스냅샷) — diaries 와 같은 방식
  content     text not null,
  status      text not null default 'visible'
              check (status in ('visible', 'hidden')),  -- 신고·운영상 숨김
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (question_id, user_id)                         -- 고쳐 쓸 수는 있어도 여러 번 답하지는 않는다
);

create index if not exists idx_daily_answers_feed on public.daily_answers (question_id, status, created_at desc);
create index if not exists idx_daily_answers_user on public.daily_answers (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────
-- 3) reactions — 토닥토닥 / 나도 그래요 / 응원해요
--    일기(diary)와 오늘의 답(answer) 양쪽에 같은 방식으로 붙는다.
--    한 사람이 한 대상에 하나만 — 다른 걸 누르면 바뀌고, 같은 걸 다시 누르면 취소된다.
-- ────────────────────────────────────────────────────────────────
create table if not exists public.reactions (
  target_type text not null check (target_type in ('diary', 'answer')),
  target_id   uuid not null,
  user_id     uuid not null,
  kind        text not null check (kind in ('pat', 'same', 'cheer')),
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);

comment on table public.reactions is 'pat=토닥토닥, same=나도 그래요, cheer=응원해요 — 좋아요(평가) 대신 쓰는 공감 반응';

create index if not exists idx_reactions_target on public.reactions (target_type, target_id);

-- ────────────────────────────────────────────────────────────────
-- 3-1) reaction_awards — "이 대상으로는 이미 적립받았다"는 영구 기록 (어뷰징 방지)
--
--   reactions 는 취소하면 행이 지워진다. 그래서 적립 여부를 reactions 로 판정하면
--   눌렀다 취소하기를 반복해 같은 글에서 포인트를 무한히 긁을 수 있다.
--   이 표는 지우지 않는다 — 한 대상당 평생 한 번만 적립된다.
--   (하루 총량은 missions.max_per_day 가 따로 막는다 — 이중 방어)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.reaction_awards (
  user_id     uuid not null,
  target_type text not null check (target_type in ('diary', 'answer')),
  target_id   uuid not null,
  awarded_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

comment on table public.reaction_awards is '공감 적립 이력 — 취소·재클릭으로 반복 적립되는 것을 막기 위해 지우지 않는다';

-- ────────────────────────────────────────────────────────────────
-- 4) RLS
-- ────────────────────────────────────────────────────────────────
alter table public.daily_questions enable row level security;
alter table public.daily_answers   enable row level security;
alter table public.reactions       enable row level security;
alter table public.reaction_awards enable row level security;

-- 적립 이력은 본인 것만 읽기, 쓰기는 아무에게도 열지 않는다 —
-- set_reaction(security definer) 만 기록한다. 유저가 직접 지우면 반복 적립이 뚫린다.
drop policy if exists reaction_awards_own_read on public.reaction_awards;
create policy reaction_awards_own_read on public.reaction_awards
  for select using (auth.uid() = user_id);

-- 질문: 발행된 것은 누구나(비로그인 포함) 읽기, 쓰기는 관리자만
drop policy if exists daily_questions_public_read on public.daily_questions;
create policy daily_questions_public_read on public.daily_questions
  for select using (status = 'published');

drop policy if exists daily_questions_admin_all on public.daily_questions;
create policy daily_questions_admin_all on public.daily_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- 답: 공개된 답은 누구나 읽기(비로그인도 남들 답을 볼 수 있어야 들어올 이유가 생긴다)
drop policy if exists daily_answers_public_read on public.daily_answers;
create policy daily_answers_public_read on public.daily_answers
  for select using (status = 'visible');

drop policy if exists daily_answers_own_all on public.daily_answers;
create policy daily_answers_own_all on public.daily_answers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists daily_answers_admin_all on public.daily_answers;
create policy daily_answers_admin_all on public.daily_answers
  for all using (public.is_admin()) with check (public.is_admin());

-- 반응: 읽기는 공개(개수 표시용), 쓰기는 본인 것만
drop policy if exists reactions_public_read on public.reactions;
create policy reactions_public_read on public.reactions
  for select using (true);

drop policy if exists reactions_own_write on public.reactions;
create policy reactions_own_write on public.reactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- 5) 오늘의 질문 가져오기
--    오늘 걸린 질문이 없으면 아무것도 돌려주지 않는다(화면에서 카드 자체를 감춘다) —
--    빈 카드를 띄워 "오늘은 질문이 없어요"라고 말하면 그것도 재촉처럼 읽힌다.
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_today_question()
returns table (
  id uuid, ask_date date, question text, hint text,
  answer_count integer, my_answer text
)
language sql
security definer
set search_path = public
as $$
  select q.id, q.ask_date, q.question, q.hint,
         (select count(*)::integer from public.daily_answers a
           where a.question_id = q.id and a.status = 'visible'),
         (select a.content from public.daily_answers a
           where a.question_id = q.id and a.user_id = auth.uid())
  from public.daily_questions q
  where q.status = 'published'
    and q.ask_date = (now() at time zone 'Asia/Seoul')::date
  limit 1;
$$;

revoke all on function public.get_today_question() from public;
grant execute on function public.get_today_question() to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6) 답하기 (고쳐 쓰기 포함)
-- ────────────────────────────────────────────────────────────────
create or replace function public.answer_today_question(
  p_question_id uuid,
  p_content     text,
  p_nickname    text default null
)
returns table (answer_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_first boolean;
  v_claim record;
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;
  if p_content is null or length(btrim(p_content)) = 0 then
    return query select null::uuid, 0, '한 줄만 적어주세요'::text; return;
  end if;
  if length(btrim(p_content)) > 300 then
    return query select null::uuid, 0, '너무 길어요. 300자 안으로 적어주세요'::text; return;
  end if;
  if not exists (
    select 1 from public.daily_questions q
    where q.id = p_question_id and q.status = 'published'
  ) then
    return query select null::uuid, 0, '지금은 답할 수 없는 질문이에요'::text; return;
  end if;

  -- 처음 답하는 경우에만 적립한다 — 고쳐 쓰기로 반복 적립되면 안 된다.
  select not exists (
    select 1 from public.daily_answers a
    where a.question_id = p_question_id and a.user_id = v_uid
  ) into v_first;

  insert into public.daily_answers (question_id, user_id, nickname, content)
  values (p_question_id, v_uid, p_nickname, btrim(p_content))
  on conflict (question_id, user_id) do update
    set content    = excluded.content,
        nickname   = coalesce(excluded.nickname, public.daily_answers.nickname),
        updated_at = now()
  returning id into v_id;

  if v_first then
    select * into v_claim from public.claim_mission('question_answer', 1);
  end if;

  return query select v_id, coalesce(v_claim.awarded, 0), ''::text;
end;
$$;

revoke all on function public.answer_today_question(uuid, text, text) from public;
grant execute on function public.answer_today_question(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 7) 답 목록 — 반응 개수와 내가 누른 것 포함
--    내 답이 있으면 맨 위로 올린다(내가 뭘 썼는지 찾아 헤매지 않게).
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_question_answers(
  p_question_id uuid,
  p_limit  integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid, nickname text, content text, created_at timestamptz, is_mine boolean,
  pat integer, same integer, cheer integer, my_kind text
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.nickname, a.content, a.created_at,
         (a.user_id = auth.uid()),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r
           where r.target_type = 'answer' and r.target_id = a.id and r.user_id = auth.uid())
  from public.daily_answers a
  where a.question_id = p_question_id and a.status = 'visible'
  order by (a.user_id = auth.uid()) desc, a.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_question_answers(uuid, integer, integer) from public;
grant execute on function public.get_question_answers(uuid, integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 8) 반응 누르기 — 같은 걸 다시 누르면 취소, 다른 걸 누르면 바뀜
-- ────────────────────────────────────────────────────────────────
create or replace function public.set_reaction(
  p_target_type text,
  p_target_id   uuid,
  p_kind        text
)
returns table (my_kind text, pat integer, same integer, cheer integer, awarded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_cur    text;
  v_author uuid;
  v_claim  record;
begin
  if v_uid is null then
    return query select null::text, 0, 0, 0, 0; return;
  end if;
  if p_target_type not in ('diary', 'answer') or p_kind not in ('pat', 'same', 'cheer') then
    return query select null::text, 0, 0, 0, 0; return;
  end if;

  select r.kind into v_cur from public.reactions r
   where r.target_type = p_target_type and r.target_id = p_target_id and r.user_id = v_uid;

  if v_cur = p_kind then
    delete from public.reactions
     where target_type = p_target_type and target_id = p_target_id and user_id = v_uid;
  else
    insert into public.reactions (target_type, target_id, user_id, kind)
    values (p_target_type, p_target_id, v_uid, p_kind)
    on conflict (target_type, target_id, user_id) do update set kind = excluded.kind;

    -- 적립 — 어뷰징 방지 3중 장치
    --  ① 자기 글에는 안 준다        ② 이 대상으로 이미 받았으면 안 준다(reaction_awards)
    --  ③ 하루 총량은 missions.max_per_day 가 막는다
    if p_target_type = 'diary' then
      select d.user_id into v_author from public.diaries d where d.id = p_target_id;
    else
      select a.user_id into v_author from public.daily_answers a where a.id = p_target_id;
    end if;

    if v_author is not null and v_author <> v_uid
       and not exists (
         select 1 from public.reaction_awards w
         where w.user_id = v_uid and w.target_type = p_target_type and w.target_id = p_target_id
       )
    then
      select * into v_claim from public.claim_mission('reaction_give', 1);
      -- 적립을 실제로 받았을 때만 기록한다 — 하루 상한에 걸려 0P였다면 내일 다시 받을 수 있어야 한다.
      if coalesce(v_claim.awarded, 0) > 0 then
        insert into public.reaction_awards (user_id, target_type, target_id)
        values (v_uid, p_target_type, p_target_id)
        on conflict do nothing;
      end if;
    end if;
  end if;

  return query
    select (select r.kind from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.user_id = v_uid),
           (select count(*)::integer from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.kind = 'pat'),
           (select count(*)::integer from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.kind = 'same'),
           (select count(*)::integer from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.kind = 'cheer'),
           coalesce(v_claim.awarded, 0);
end;
$$;

revoke all on function public.set_reaction(text, uuid, text) from public;
grant execute on function public.set_reaction(text, uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 9) 일기 피드에 반응 개수 얹기
--    ⚠️ 반환 컬럼이 늘어나므로 create or replace 로는 안 되고 drop 후 재생성해야 한다
--       ("cannot change return type of existing function").
--    ⚠️ 기존 like_count / liked_by_me 컬럼은 남겨둔다 — 화면은 반응으로 바꾸지만
--       좋아요 데이터·함수를 지우는 것은 삭제 전 보고 원칙에 따라 승인 후에.
-- ────────────────────────────────────────────────────────────────
drop function if exists public.get_diary_feed(text, integer, integer);

create function public.get_diary_feed(
  p_sort text default 'recent',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, nickname text, content text, images text[],
  like_count integer, liked_by_me boolean, is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text
)
language sql
security definer
set search_path = public
as $$
  select d.id, d.user_id, d.nickname, d.content, d.images,
         d.like_count,
         exists(select 1 from public.diary_likes l where l.diary_id = d.id and l.user_id = auth.uid()),
         (d.user_id = auth.uid()),
         d.created_at,
         (select count(*)::integer from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.user_id = auth.uid())
  from public.diaries d
  where d.status = 'visible'
  -- '인기' 정렬도 좋아요가 아니라 공감한 사람 수 기준으로 바꾼다(like_count 는 더 이상 늘지 않는다).
  order by
    case when p_sort = 'popular'
      then (select count(*) from public.reactions r
             where r.target_type = 'diary' and r.target_id = d.id)
    end desc nulls last,
    d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_diary_feed(text, integer, integer) from public;
grant execute on function public.get_diary_feed(text, integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 10) 이달의 이야기 — 기준을 좋아요 수에서 '공감한 사람 수'로 바꾼다
--
--   화면에서 좋아요를 걷어냈으므로 like_count 는 더 이상 늘지 않는다. 그대로 두면
--   이달의 이야기가 전부 0으로 남아 정렬이 죽는다.
--   ⚠️ 기준은 '반응 개수'가 아니라 '서로 다른 사람 수'다 — reactions 는 (대상,사람)이 기본키라
--      한 사람이 여러 번 눌러도 1로만 잡힌다(1인 1표). 품앗이·연타로 순위를 못 만든다.
-- ────────────────────────────────────────────────────────────────
drop function if exists public.get_monthly_best_diaries(integer);

create function public.get_monthly_best_diaries(p_limit integer default 3)
returns table (
  id uuid, nickname text, content text, images text[],
  reaction_count integer, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select d.id, d.nickname, d.content, d.images,
         (select count(*)::integer from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id),
         d.created_at
  from public.diaries d
  where d.status = 'visible'
    and d.created_at >= date_trunc('month', now() at time zone 'Asia/Seoul')
  order by (select count(*) from public.reactions r
             where r.target_type = 'diary' and r.target_id = d.id) desc,
           d.created_at desc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.get_monthly_best_diaries(integer) from public;
grant execute on function public.get_monthly_best_diaries(integer) to anon, authenticated;

notify pgrst, 'reload schema';
