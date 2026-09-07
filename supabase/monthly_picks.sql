-- 월간 선정(이달의 이야기 · 이달의 토닥이) — 2026-09-07
--
-- 대표님 지시: "조회수 참여도 좋아요 댓글 등 지수가 높은 월 1회 선정하여 포인트 주는 것"
--             "히로인즈와 차별화로 가야 해"
--
-- ⚠️ daily_questions.sql → diary_comments.sql 을 먼저 실행한 뒤 이 파일을 실행하세요.
--
-- ── 왜 이렇게 만들었나 ─────────────────────────────────────────────────────
-- ① 조회수는 지수에서 뺐다. 새로고침·다중계정으로 가장 쉽게 조작되고, 조회수가 점수가 되면
--    자극적인 제목을 쓰게 된다. 우리는 조회수를 아예 세지 않는다.
-- ② 받은 쪽 지수는 '반응 개수'가 아니라 **서로 다른 사람 수**다. reactions 는 (대상,사람)이
--    기본키라 한 사람이 여러 번 눌러도 1로만 잡힌다. 댓글도 사람 단위로 센다(한 명이 열 개를
--    달아도 1). 연타·품앗이로 순위를 못 만든다.
-- ③ 히로인스와의 차별화 — 그들은 '잘 쓴 사람/많이 산 사람'에게 보상한다(검증단 자격 = 활동 실적).
--    우리는 **남을 많이 토닥인 사람**(이달의 토닥이)도 함께 뽑는다. 받은 사람만 뽑으면 인기투표가
--    되지만, 준 사람을 뽑으면 커뮤니티가 따뜻해지는 쪽으로 굴러간다.
-- ④ 자동 지급이 아니다. 이 SQL은 **후보와 지수를 계산해 보여줄 뿐**이고, 실제 지급은 관리자가
--    화면에서 확인하고 누를 때 일어난다. 지수만 믿고 자동 지급하면 어뷰징이 뚫렸을 때
--    되돌릴 수 없다.
--
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1) monthly_picks — 확정된 선정 기록(중복 지급 방지 + 이력)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.monthly_picks (
  id          uuid primary key default gen_random_uuid(),
  period      date not null,                      -- 그 달의 1일 (예: 2026-09-01)
  kind        text not null
              check (kind in ('story', 'comforter')), -- story=이달의 이야기, comforter=이달의 토닥이
  user_id     uuid not null,
  nickname    text,
  diary_id    uuid references public.diaries(id) on delete set null, -- story 일 때만
  score       integer not null default 0,         -- 확정 시점의 지수(나중에 근거를 볼 수 있게 남긴다)
  points      integer not null default 0,         -- 실제 지급한 포인트
  note        text,
  created_at  timestamptz not null default now(),
  unique (period, kind, user_id)                  -- 같은 달·같은 부문에 한 사람 한 번
);

comment on table public.monthly_picks is '월간 선정 이력 — 관리자가 후보를 보고 확정한 것만 들어간다(자동 지급 아님)';

create index if not exists idx_monthly_picks_period on public.monthly_picks (period desc, kind);

alter table public.monthly_picks enable row level security;

-- 선정 결과는 누구나 볼 수 있어야 한다(나중에 화면에 '이달의 토닥이'를 띄우기 위해).
drop policy if exists monthly_picks_public_read on public.monthly_picks;
create policy monthly_picks_public_read on public.monthly_picks
  for select using (true);

drop policy if exists monthly_picks_admin_all on public.monthly_picks;
create policy monthly_picks_admin_all on public.monthly_picks
  for all using (public.is_admin()) with check (public.is_admin());

-- ────────────────────────────────────────────────────────────────
-- 2) 이달의 이야기 후보 — 서로 다른 사람에게 얼마나 가닿았나
--    p_period 를 비우면 이번 달. 지난달을 뽑으려면 '2026-08-01' 처럼 넣는다.
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_monthly_story_candidates(
  p_period date default null,
  p_limit  integer default 20
)
returns table (
  diary_id uuid, user_id uuid, nickname text, content text, images text[],
  reactor_count integer,      -- 공감한 사람 수(1인 1표)
  commenter_count integer,    -- 댓글을 남긴 사람 수(1인 1표)
  score integer,              -- 공감 1점 + 댓글 2점 (댓글이 더 큰 마음이라 가중)
  created_at timestamptz,
  already_picked boolean
)
language sql
security definer
set search_path = public
as $$
  with p as (
    select coalesce(p_period, date_trunc('month', now() at time zone 'Asia/Seoul')::date) as start_date
  ),
  base as (
    select d.id, d.user_id, d.nickname, d.content, d.images, d.created_at,
           (select count(distinct r.user_id)::integer from public.reactions r
             where r.target_type = 'diary' and r.target_id = d.id) as reactors,
           (select count(distinct c.user_id)::integer from public.diary_comments c
             where c.diary_id = d.id and c.status = 'visible' and c.user_id <> d.user_id) as commenters
    from public.diaries d, p
    -- ⚠️ security definer 라서 관리자 확인을 함수 안에서 직접 한다.
    --    이 결과에는 회원 user_id 가 들어 있어 일반 로그인 사용자에게 열면 안 된다.
    where public.is_admin()
      and d.status = 'visible'
      and d.created_at >= p.start_date
      and d.created_at <  (p.start_date + interval '1 month')
  )
  select b.id, b.user_id, b.nickname, b.content, b.images,
         b.reactors, b.commenters,
         (b.reactors + b.commenters * 2),
         b.created_at,
         exists (select 1 from public.monthly_picks mp, p
                  where mp.period = p.start_date and mp.kind = 'story' and mp.diary_id = b.id)
  from base b
  where (b.reactors + b.commenters) > 0
  order by (b.reactors + b.commenters * 2) desc, b.created_at asc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.get_monthly_story_candidates(date, integer) from public;
grant execute on function public.get_monthly_story_candidates(date, integer) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3) 이달의 토닥이 후보 — 남에게 마음을 얼마나 나눠줬나 (우리만의 부문)
--    ⚠️ 하루에 몰아서 백 개를 누른 사람이 이기면 안 되므로 **활동한 날 수**를 함께 본다.
--       지수 = 공감한 글 수 + 댓글 단 글 수 × 2 + 활동한 날 수 × 3
--       (자기 글에 남긴 것은 전부 제외)
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_monthly_comforter_candidates(
  p_period date default null,
  p_limit  integer default 20
)
returns table (
  user_id uuid, nickname text,
  given_reactions integer,   -- 남의 글에 공감한 수(글 단위)
  given_comments integer,    -- 남의 글에 댓글 단 수(글 단위)
  active_days integer,       -- 활동한 날 수 — 하루 몰아치기로는 못 올라간다
  score integer,
  already_picked boolean
)
language sql
security definer
set search_path = public
as $$
  with p as (
    select coalesce(p_period, date_trunc('month', now() at time zone 'Asia/Seoul')::date) as start_date
  ),
  -- 남의 일기·남의 답에 남긴 공감만 모은다
  react as (
    select r.user_id, r.created_at,
           coalesce(d.id::text, a.id::text) as target_key
    from public.reactions r
    cross join p
    left join public.diaries d
      on r.target_type = 'diary'  and d.id = r.target_id and d.user_id <> r.user_id
    left join public.daily_answers a
      on r.target_type = 'answer' and a.id = r.target_id and a.user_id <> r.user_id
    -- ⚠️ 관리자 확인 — 이 결과에도 회원 user_id 가 들어 있다(위 story 후보와 같은 이유).
    where public.is_admin()
      and r.created_at >= p.start_date
      and r.created_at <  (p.start_date + interval '1 month')
      and (d.id is not null or a.id is not null)
  ),
  cmt as (
    select c.user_id, c.created_at, c.diary_id
    from public.diary_comments c
    join public.diaries d on d.id = c.diary_id and d.user_id <> c.user_id
    cross join p
    where public.is_admin()
      and c.status = 'visible'
      and c.created_at >= p.start_date
      and c.created_at <  (p.start_date + interval '1 month')
  ),
  agg as (
    select u.user_id,
           (select count(distinct x.target_key)::integer from react x where x.user_id = u.user_id) as gr,
           (select count(distinct y.diary_id)::integer  from cmt   y where y.user_id = u.user_id) as gc,
           (select count(distinct dt)::integer from (
              select (x.created_at at time zone 'Asia/Seoul')::date as dt from react x where x.user_id = u.user_id
              union
              select (y.created_at at time zone 'Asia/Seoul')::date     from cmt   y where y.user_id = u.user_id
            ) days) as ad
    from (select user_id from react union select user_id from cmt) u
  )
  select g.user_id,
         (select d.nickname from public.diaries d
           where d.user_id = g.user_id order by d.created_at desc limit 1),
         g.gr, g.gc, g.ad,
         (g.gr + g.gc * 2 + g.ad * 3),
         exists (select 1 from public.monthly_picks mp, p
                  where mp.period = p.start_date and mp.kind = 'comforter' and mp.user_id = g.user_id)
  from agg g
  order by (g.gr + g.gc * 2 + g.ad * 3) desc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.get_monthly_comforter_candidates(date, integer) from public;
grant execute on function public.get_monthly_comforter_candidates(date, integer) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 4) 선정 확정 + 포인트 지급 (관리자 전용)
--    포인트는 point_transactions 원장에 직접 넣는다 — 미션이 아니라 운영자가 주는 상이라
--    claim_mission(하루 상한·중복방지)의 대상이 아니다.
--    같은 달·같은 부문·같은 사람은 unique 제약으로 두 번 지급되지 않는다.
-- ────────────────────────────────────────────────────────────────
create or replace function public.confirm_monthly_pick(
  p_period   date,
  p_kind     text,
  p_user_id  uuid,
  p_points   integer,
  p_diary_id uuid default null,
  p_note     text default null
)
returns table (pick_id uuid, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_nickname text;
begin
  if not public.is_admin() then
    return query select null::uuid, '권한이 없습니다'::text; return;
  end if;
  if p_kind not in ('story', 'comforter') then
    return query select null::uuid, '부문이 올바르지 않습니다'::text; return;
  end if;
  if p_points < 0 then
    return query select null::uuid, '포인트는 0 이상이어야 합니다'::text; return;
  end if;
  if exists (select 1 from public.monthly_picks
              where period = p_period and kind = p_kind and user_id = p_user_id) then
    return query select null::uuid, '이미 이 달에 선정된 분입니다'::text; return;
  end if;

  select d.nickname into v_nickname from public.diaries d
   where d.user_id = p_user_id order by d.created_at desc limit 1;

  insert into public.monthly_picks (period, kind, user_id, nickname, diary_id, points, note)
  values (p_period, p_kind, p_user_id, v_nickname, p_diary_id, p_points, p_note)
  returning id into v_id;

  if p_points > 0 then
    insert into public.point_transactions (user_id, amount, reason, expires_at)
    values (
      p_user_id, p_points,
      case when p_kind = 'story' then '이달의 이야기 선정' else '이달의 토닥이 선정' end,
      now() + interval '90 days'
    );
  end if;

  return query select v_id, ''::text;
end;
$$;

revoke all on function public.confirm_monthly_pick(date, text, uuid, integer, uuid, text) from public;
grant execute on function public.confirm_monthly_pick(date, text, uuid, integer, uuid, text) to authenticated;

notify pgrst, 'reload schema';
