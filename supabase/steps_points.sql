
-- 걷기 포인트(걸음수 자동 연동) — 2026-10-13
-- 설계: 구간 1천보 5P / 5천보 10P / 1만보 15P, 하루 최대 30P (missions.walk_daily, 문서: 걷기 캠페인 실행 전략·리뷰체험단 개발 로드맵 2-2).
-- 핵심: 걸음수는 "클라이언트가 보낸 값"이라 그대로 믿으면 콘솔에서 rpc 한 줄로 매일 30P를 받아간다.
--       그래서 ① 적립 경로를 report_steps() 하나로 좁히고(claim_mission은 steps·diary_post 차단)
--       ② 출처(healthkit/health_connect)·하루 상한·증가 속도를 서버가 검증하고 ③ 모든 보고를 step_reports에 남겨 추적·회수 가능하게 한다.
-- missions.walk_daily 는 active=false 로 둔 채 배포한다 — 앱 업데이트가 나간 뒤 관리자 화면에서 켠다(그 전엔 기록만 쌓임).

-- 1) 보고 이력(감사용). 클라이언트는 직접 읽지도 쓰지도 못한다(RLS 켜고 정책 없음).
create table if not exists public.step_reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,
  steps       integer not null,
  source      text,
  platform    text,
  accepted    boolean not null,
  reason      text,
  reported_at timestamptz not null default now()
);
create index if not exists step_reports_user_day_idx on public.step_reports (user_id, day, reported_at desc);
alter table public.step_reports enable row level security;

-- 2) 내부 적립 함수 (라이브 claim_mission 본문을 그대로 옮기고 사용자만 인자로 받음) — 클라이언트에 노출 금지
CREATE OR REPLACE FUNCTION public._claim_mission_for(p_uid uuid, p_key text, p_value integer DEFAULT 1)
 RETURNS TABLE(awarded integer, total_awarded integer, balance integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid        uuid := p_uid;
  v_m          public.missions%rowtype;
  v_today      date := (now() at time zone 'Asia/Seoul')::date;
  v_prog       public.mission_progress%rowtype;
  v_new_value  integer;
  v_award      integer := 0;
  v_ms_count   integer;
  v_limit      integer;
  v_prev_award integer;
begin
  if v_uid is null then
    return query select 0, 0, 0, '로그인이 필요합니다'::text; return;
  end if;

  select * into v_m from public.missions
   where key = p_key and active = true
     and (starts_at is null or starts_at <= now())
     and (ends_at   is null or ends_at   >= now());
  if not found then
    return query select 0, 0, public.get_my_point_balance(), '진행 중인 미션이 아닙니다'::text; return;
  end if;

  insert into public.mission_progress (mission_id, user_id, progress_date)
  values (v_m.id, v_uid, v_today)
  on conflict (mission_id, user_id, progress_date) do nothing;

  select * into v_prog from public.mission_progress
   where mission_id = v_m.id and user_id = v_uid and progress_date = v_today
   for update;

  -- 구간이 있으면 최소 구간 개수만큼은 받을 수 있어야 한다.
  v_ms_count := jsonb_array_length(coalesce(v_m.milestones, '[]'::jsonb));
  v_limit := case when v_ms_count > 0 then greatest(v_m.max_per_day, v_ms_count)
                  else v_m.max_per_day end;

  if v_prog.claim_count >= v_limit then
    return query select 0, v_prog.awarded_points, public.get_my_point_balance(), '오늘은 모두 받았어요'::text; return;
  end if;

  if v_m.cooldown_sec > 0 and v_prog.last_claim_at is not null
     and v_prog.last_claim_at > now() - make_interval(secs => v_m.cooldown_sec) then
    return query select 0, v_prog.awarded_points, public.get_my_point_balance(), '조금 뒤에 다시 받을 수 있어요'::text; return;
  end if;

  -- 누적형(걸음·시청분)은 보고값을 최대치로, 1회형은 +1
  if v_m.metric in ('steps', 'live_minutes') then
    v_new_value := greatest(coalesce(v_prog.current_value, 0), p_value);
  else
    v_new_value := coalesce(v_prog.current_value, 0) + greatest(p_value, 1);
  end if;

  if v_ms_count > 0 then
    select coalesce(sum((e->>'points')::int), 0) into v_award
      from jsonb_array_elements(v_m.milestones) e
     where (e->>'value')::int <= v_new_value;

    select coalesce(sum((e->>'points')::int), 0) into v_prev_award
      from jsonb_array_elements(v_m.milestones) e
     where (e->>'value')::int <= coalesce(v_prog.current_value, 0);

    v_award := greatest(v_award - v_prev_award, 0);
  else
    if v_new_value >= v_m.target_value and coalesce(v_prog.current_value, 0) < v_m.target_value then
      v_award := v_m.reward_points;
    else
      v_award := 0;
    end if;
  end if;

  update public.mission_progress
     set current_value  = v_new_value,
         claim_count    = claim_count + (case when v_award > 0 then 1 else 0 end),
         awarded_points = awarded_points + v_award,
         last_claim_at  = case when v_award > 0 then now() else last_claim_at end,
         completed_at   = case when v_new_value >= v_m.target_value and completed_at is null
                               then now() else completed_at end
   where id = v_prog.id;

  if v_award > 0 then
    insert into public.point_transactions (user_id, amount, reason, expires_at)
    values (v_uid, v_award, 'mission:' || v_m.key,
            now() + make_interval(days => v_m.point_expire_days));
  end if;

  return query
    select v_award,
           (select awarded_points from public.mission_progress where id = v_prog.id),
           public.get_my_point_balance(),
           (case when v_award > 0 then '포인트를 받았어요' else '아직 목표에 도달하지 않았어요' end)::text;
end;
$function$;

revoke all on function public._claim_mission_for(uuid, text, integer) from public, anon, authenticated;

-- 3) 클라이언트용 claim_mission: 서버가 직접 검증하는 미션은 여기서 못 받게 막고, 나머지는 기존과 동일하게 동작
create or replace function public.claim_mission(p_key text, p_value integer default 1)
returns table (awarded integer, total_awarded integer, balance integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metric text;
begin
  select metric into v_metric from public.missions where key = p_key;
  if v_metric in ('steps', 'diary_post') then
    return query select 0, 0, public.get_my_point_balance(), '이 미션은 활동하면 자동으로 적립돼요'::text;
    return;
  end if;
  return query select * from public._claim_mission_for(auth.uid(), p_key, p_value);
end;
$$;
revoke all on function public.claim_mission(text, integer) from public;
grant execute on function public.claim_mission(text, integer) to authenticated;

-- 4) 걸음수 보고 + 검증 + 적립
create or replace function public.report_steps(p_steps integer, p_source text, p_platform text default null)
returns table (accepted boolean, steps integer, awarded integer, total_awarded integer, balance integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_day     date := (now() at time zone 'Asia/Seoul')::date;
  v_last    public.step_reports%rowtype;
  v_has     boolean := false;
  v_prev    integer := 0;
  v_minutes numeric;
  v_max     integer;
  v_why     text := null;
  v_res     record;
  c_day_cap constant integer := 40000;  -- 하루 최대 인정 걸음(사람이 하루에 이보다 걷기는 어려움)
  c_rate    constant integer := 250;    -- 분당 최대 증가 걸음(달리기 수준) — 이보다 빨리 늘면 조작으로 본다
  c_slack   constant integer := 300;    -- 보고 시차·센서 반영 지연 여유
begin
  if v_uid is null then
    return query select false, 0, 0, 0, 0, '로그인이 필요합니다'::text; return;
  end if;

  if p_source is null or p_source not in ('healthkit', 'health_connect') then
    v_why := 'bad_source';
  elsif p_steps is null or p_steps < 0 then
    v_why := 'bad_value';
  elsif p_steps > c_day_cap then
    v_why := 'over_day_cap';
  end if;

  select * into v_last from public.step_reports r
   where r.user_id = v_uid and r.day = v_day and r.accepted
   order by r.reported_at desc limit 1;
  v_has := found;
  if v_has then v_prev := v_last.steps; end if;

  if v_why is null and v_has then
    if p_steps < v_prev then
      v_why := 'lower_than_prev';   -- 센서 지연으로 줄어 보일 수 있음 — 오류가 아니라 무시
    else
      v_minutes := greatest(extract(epoch from (now() - v_last.reported_at)) / 60.0, 0);
      v_max := ceil(v_minutes * c_rate)::integer + c_slack;
      if p_steps - v_prev > v_max then v_why := 'too_fast'; end if;
    end if;
  end if;

  if v_why is not null then
    insert into public.step_reports (user_id, day, steps, source, platform, accepted, reason)
    values (v_uid, v_day, coalesce(p_steps, 0), p_source, p_platform, false, v_why);
    return query select false, v_prev, 0, 0, public.get_my_point_balance(),
      (case v_why when 'lower_than_prev' then '걸음수를 갱신했어요'
                  when 'too_fast' then '걸음수를 확인하는 중이에요'
                  else '걸음수를 확인할 수 없어요' end)::text;
    return;
  end if;

  insert into public.step_reports (user_id, day, steps, source, platform, accepted)
  values (v_uid, v_day, p_steps, p_source, p_platform, true);

  select * into v_res from public._claim_mission_for(v_uid, 'walk_daily', p_steps);
  return query select true, p_steps, coalesce(v_res.awarded, 0), coalesce(v_res.total_awarded, 0),
                      coalesce(v_res.balance, public.get_my_point_balance()), coalesce(v_res.message, '')::text;
end;
$$;
revoke all on function public.report_steps(integer, text, text) from public;
grant execute on function public.report_steps(integer, text, text) to authenticated;

-- 5) 오늘 내 걸음수(화면 표시용) — 마지막으로 인정된 값
create or replace function public.get_my_steps_today()
returns table (steps integer, reported_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select r.steps, r.reported_at from public.step_reports r
   where r.user_id = auth.uid() and r.accepted
     and r.day = (now() at time zone 'Asia/Seoul')::date
   order by r.reported_at desc limit 1;
$$;
revoke all on function public.get_my_steps_today() from public;
grant execute on function public.get_my_steps_today() to authenticated;

-- 로그인 안 한 호출은 아예 막는다(함수 안에서도 auth.uid() null 이면 거절하지만 이중으로)
revoke execute on function public.report_steps(integer, text, text) from anon;
revoke execute on function public.get_my_steps_today() from anon;
