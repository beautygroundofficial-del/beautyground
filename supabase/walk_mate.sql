-- 이달의 산책 메이트 — 2026-09-12 (커뮤니티 로드맵 4-10 B5)
-- 대표님 "펫과 같이 걷고 이미지 올리길 장려" → 월간 선정에 세 번째 부문. 기존 방식 그대로:
--   · 자동 지급 아님 — 관리자가 후보를 보고 확정할 때만 포인트(confirm_monthly_pick)
--   · 지수 = 같이 걸은 날 수 × 3 + 산책 글 수 + 그 글에 마음을 남긴 서로 다른 사람 수
--     (사진 + 펫 태그가 모두 있는 하루 이야기만 센다. 하루 몰아 올리기로는 못 올라간다.)
--   · 등수·지수는 손님에게 안 보인다(관리자 화면만).
-- ✅ 2026-09-12 대표님 '진행해' 지시로 db_query.mjs 실행 완료(첫 실행은 배열 비교 오류로 롤백 → 고쳐 재실행). 관리자 화면에서 후보 계산 확인.

-- 1) 부문 추가
alter table public.monthly_picks drop constraint if exists monthly_picks_kind_check;
alter table public.monthly_picks add constraint monthly_picks_kind_check
  check (kind in ('story', 'comforter', 'walkmate'));

-- 2) 후보
create or replace function public.get_monthly_walkmate_candidates(
  p_period date default null,
  p_limit  integer default 20
)
returns table (
  user_id uuid, nickname text,
  walk_days integer,       -- 같이 걸은 날 수
  walk_posts integer,      -- 산책 글 수(사진+펫)
  reactor_count integer,   -- 그 글들에 마음(공감·댓글)을 남긴 서로 다른 사람 수
  pet_names text,          -- 함께한 친구 이름
  score integer,
  already_picked boolean
)
language sql security definer set search_path = public as $$
  with p as (
    select coalesce(p_period, date_trunc('month', now() at time zone 'Asia/Seoul')::date) as start_date
  ),
  walks as (
    select d.id, d.user_id, d.created_at, d.pet_ids
    from public.diaries d cross join p
    where public.is_admin()
      and d.status = 'visible'
      and coalesce(array_length(d.pet_ids, 1), 0) > 0
      and coalesce(array_length(d.images, 1), 0) > 0
      and d.created_at >= p.start_date
      and d.created_at <  (p.start_date + interval '1 month')
  ),
  agg as (
    select w.user_id,
           count(distinct (w.created_at at time zone 'Asia/Seoul')::date)::integer as days,
           count(*)::integer as posts,
           (select count(distinct x.who)::integer from (
              select r.user_id as who from public.reactions r join walks w2 on r.target_type = 'diary' and r.target_id = w2.id and w2.user_id = w.user_id where r.user_id <> w.user_id
              union
              select c.user_id from public.diary_comments c join walks w3 on c.diary_id = w3.id and w3.user_id = w.user_id where c.user_id <> w.user_id and c.status = 'visible'
            ) x) as reactors,
           (select string_agg(distinct pt.name, '·') from public.pets pt
              where pt.user_id = w.user_id
                and pt.id in (select e from walks w4, unnest(w4.pet_ids) e where w4.user_id = w.user_id)) as pet_names
    from walks w
    group by w.user_id
  )
  select g.user_id,
         (select d.nickname from public.diaries d where d.user_id = g.user_id order by d.created_at desc limit 1),
         g.days, g.posts, g.reactors, g.pet_names,
         (g.days * 3 + g.posts + g.reactors),
         exists (select 1 from public.monthly_picks mp, p
                  where mp.period = p.start_date and mp.kind = 'walkmate' and mp.user_id = g.user_id)
  from agg g
  order by (g.days * 3 + g.posts + g.reactors) desc, g.days desc
  limit greatest(p_limit, 1);
$$;
revoke all on function public.get_monthly_walkmate_candidates(date, integer) from public;
grant execute on function public.get_monthly_walkmate_candidates(date, integer) to authenticated;

-- 3) 확정 — 'walkmate' 허용 + 지급 사유
create or replace function public.confirm_monthly_pick(
  p_period   date,
  p_kind     text,
  p_user_id  uuid,
  p_points   integer,
  p_diary_id uuid default null,
  p_note     text default null
)
returns table (pick_id uuid, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_id       uuid;
  v_nickname text;
begin
  if not public.is_admin() then
    return query select null::uuid, '권한이 없습니다'::text; return;
  end if;
  if p_kind not in ('story', 'comforter', 'walkmate') then
    return query select null::uuid, '부문이 올바르지 않습니다'::text; return;
  end if;
  if p_points < 0 then
    return query select null::uuid, '포인트는 0 이상이어야 합니다'::text; return;
  end if;
  if exists (select 1 from public.monthly_picks where period = p_period and kind = p_kind and user_id = p_user_id) then
    return query select null::uuid, '이미 이 달에 선정된 분입니다'::text; return;
  end if;

  select d.nickname into v_nickname from public.diaries d where d.user_id = p_user_id order by d.created_at desc limit 1;

  insert into public.monthly_picks (period, kind, user_id, nickname, diary_id, points, note)
  values (p_period, p_kind, p_user_id, v_nickname, p_diary_id, p_points, p_note)
  returning id into v_id;

  if p_points > 0 then
    insert into public.point_transactions (user_id, amount, reason, expires_at)
    values (
      p_user_id, p_points,
      case p_kind when 'story' then '이달의 이야기 선정' when 'comforter' then '이달의 토닥이 선정' else '이달의 산책 메이트 선정' end,
      now() + interval '90 days'
    );
  end if;

  return query select v_id, ''::text;
end;
$$;
revoke all on function public.confirm_monthly_pick(date, text, uuid, integer, uuid, text) from public;
grant execute on function public.confirm_monthly_pick(date, text, uuid, integer, uuid, text) to authenticated;

notify pgrst, 'reload schema';
