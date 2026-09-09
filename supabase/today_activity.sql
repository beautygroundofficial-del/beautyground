-- 오늘의 활동 — "내가 오늘 뭘 했나" 개인 요약 (2026-09-09)
--
-- 로드맵 4-2 "다음" 목록에 있던 유일한 미구축 화면. 커뮤니티 로드맵을 따라
-- 점진적으로 확장하기로 한 방향(대표님 지시)의 첫 번째 페이지.
--
-- 등수·경쟁 요소 없음(설계 원칙 4가지 중 "반응: 등수 없음, 숫자 최소 노출"과 동일선상) —
-- 그냥 "오늘 이만큼 했다"는 조용한 확인용. 다른 사람과 비교하는 지표가 아니다.
--
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor 에 붙여넣고 Run

create or replace function public.get_my_today_activity()
returns table (
  answered_question boolean,
  question_text      text,
  my_answer          text,
  diary_count        integer,
  latest_diary       text,
  reaction_count      integer,
  comment_count       integer,
  points_today        integer,
  phone_verified      boolean
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
    coalesce(cc.cnt, 0)::int,
    coalesce(pt.sum_amount, 0)::int,
    exists(select 1 from public.phone_verifications v where v.user_id = auth.uid())
  from today
  left join public.daily_questions q
    on q.ask_date = today.d and q.status = 'published'
  left join public.daily_answers a
    on a.question_id = q.id and a.user_id = auth.uid() and a.status = 'visible'
  left join lateral (
    select count(*) as cnt
    from public.diaries d
    where d.user_id = auth.uid() and d.status = 'visible'
      and (d.created_at at time zone 'Asia/Seoul')::date = today.d
  ) dc on true
  left join lateral (
    select d.content
    from public.diaries d
    where d.user_id = auth.uid() and d.status = 'visible'
      and (d.created_at at time zone 'Asia/Seoul')::date = today.d
    order by d.created_at desc
    limit 1
  ) dl on true
  left join lateral (
    select count(*) as cnt
    from public.reactions r
    where r.user_id = auth.uid()
      and (r.created_at at time zone 'Asia/Seoul')::date = today.d
  ) rc on true
  left join lateral (
    select count(*) as cnt
    from public.diary_comments c
    where c.user_id = auth.uid() and c.status = 'visible'
      and (c.created_at at time zone 'Asia/Seoul')::date = today.d
  ) cc on true
  left join lateral (
    select sum(p.amount) as sum_amount
    from public.point_transactions p
    where p.user_id = auth.uid() and p.amount > 0
      and (p.created_at at time zone 'Asia/Seoul')::date = today.d
  ) pt on true;
$$;

revoke all on function public.get_my_today_activity() from public;
grant execute on function public.get_my_today_activity() to authenticated;

notify pgrst, 'reload schema';
