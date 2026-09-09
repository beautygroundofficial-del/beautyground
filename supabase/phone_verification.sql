-- 전화번호 인증 — 가입이 아니라 "포인트를 처음 받을 때" 요구한다 (2026-09-09)
--
-- 대표님 지시:
--   "예전엔 휴대전화번호를 어뷰징 방지(중복가입 차단)용으로 필수로 걸어뒀는데,
--    이건 회원가입 이후에 어뷰징이니 장치를 따로 만들면 되지. 회원가입에서는
--    복잡할 필요가 없어. 커뮤니티에서의 어뷰징 문제 발생 방지를 위한 것이니
--    회원가입 후 서비스 사용 시점에 전번을 추가하면 될 것 같은데?"
--
-- 그래서 signup_bonus_v3.sql 의 "전화번호 중복가입 차단" 트리거(on_auth_user_block_dup_phone)는
-- 이제 죽은 코드다 — 네이버 로그인권한에서 휴대전화번호를 뺐으니(2026-09-09) 애초에 phone 메타가
-- 안 들어오고, 이 트리거는 항상 통과만 시킨다. 지운다.
--
-- 대신 이 파일이 하는 일:
--   ① 글쓰기·공감·댓글은 그대로 완전히 프리(막지 않는다)
--   ② 그 행동으로 포인트를 받는 순간(claim_mission)에만 "전화번호 인증됐는지"를 본다
--   ③ 인증 안 됐으면 0P + 안내 메시지만 준다(기존 "하루 상한 걸리면 0P" 패턴과 동일하게,
--      에러로 막지 않는다 — 이미 daily_questions.sql 등에서 검증된 UX)
--   ④ 실제 SMS 인증(6자리 코드)이라 전화번호 하나는 평생 한 계정에만 묶인다
--      (phone_verifications.phone 에 유니크 인덱스) — 이게 진짜 다중계정 방어선이다
--
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor 에 붙여넣고 Run
-- ⚠️ 실제 SMS 발송은 api/auth-naver.ts(action=phone-request/phone-verify)에서 처리한다.
--    Solapi 계정을 만들어 SOLAPI_API_KEY/SOLAPI_API_SECRET/SOLAPI_SENDER 를 Vercel 환경변수에
--    넣기 전까지는 발송이 안 되고 관리자에게만 로그로 남는다 — 그 전까지는 이 기능 자체가
--    "아무도 인증 못 함 = 아무도 포인트 못 받음" 상태가 된다(에러는 아니고, 안전한 기본값이다).

-- ────────────────────────────────────────────────────────────────
-- 0) 죽은 트리거 정리 — 네이버에서 휴대전화번호를 안 받게 됐으니 항상 v_phone is null 이라
--    아무 일도 안 하는 트리거다. 지운다(함수는 남겨도 되지만 헷갈리니 같이 지운다).
-- ────────────────────────────────────────────────────────────────
drop trigger if exists on_auth_user_block_dup_phone on auth.users;
drop function if exists public.block_duplicate_phone_signup();

-- ────────────────────────────────────────────────────────────────
-- 1) phone_verifications — "이 전화번호는 이 사람 것"이라는 평생 기록.
--    phone 유니크 인덱스가 실제 다중계정 방어(같은 번호로 두 번째 계정은 인증 자체가 안 됨).
-- ────────────────────────────────────────────────────────────────
create table if not exists public.phone_verifications (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  phone       text not null,
  verified_at timestamptz not null default now()
);

comment on table public.phone_verifications is '전화번호 인증 완료 기록 — 포인트 지급 조건이자 다중계정 방어선(phone 유니크)';

create unique index if not exists idx_phone_verifications_phone on public.phone_verifications (phone);

alter table public.phone_verifications enable row level security;

drop policy if exists phone_verifications_own_read on public.phone_verifications;
create policy phone_verifications_own_read on public.phone_verifications
  for select using (auth.uid() = user_id);
-- insert/update는 열지 않는다 — service role(서버)만 기록한다.

-- ────────────────────────────────────────────────────────────────
-- 2) phone_otp_codes — 임시 인증코드. 클라이언트는 이 테이블에 직접 못 붙는다
--    (RLS로 전부 막고, service role로만 서버에서 읽고 쓴다).
-- ────────────────────────────────────────────────────────────────
create table if not exists public.phone_otp_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  phone       text not null,
  code_hash   text not null,          -- 평문 저장 금지 — sha256(code)
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.phone_otp_codes is 'SMS 인증코드 — 평문 코드는 저장하지 않는다(sha256 해시만)';

create index if not exists idx_phone_otp_user on public.phone_otp_codes (user_id, created_at desc);

alter table public.phone_otp_codes enable row level security;
-- 어떤 role에도 정책을 열지 않는다 — service role은 RLS를 우회하므로 서버 API만 접근 가능.

-- ────────────────────────────────────────────────────────────────
-- 3) claim_mission — 포인트 지급 직전에 전화인증 여부를 본다.
--    글쓰기·공감·댓글 자체(diary_comments.sql·daily_questions.sql 등)는 이 함수를 거치되
--    "행동"은 이미 그쪽 함수에서 먼저 끝낸 뒤 마지막에 포인트만 이 함수로 청구하는 구조라,
--    여기서 0P를 주는 건 글/댓글/공감 자체를 막는 게 아니라 포인트만 안 나가는 것이다.
-- ────────────────────────────────────────────────────────────────
create or replace function public.claim_mission(p_key text, p_value integer default 1)
returns table (awarded integer, total_awarded integer, balance integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
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

  -- 전화인증 전이면 포인트는 0P — 안내만 하고 에러로 막지 않는다(하루상한 0P와 같은 패턴).
  if not exists (select 1 from public.phone_verifications where user_id = v_uid) then
    return query select 0, 0, public.get_my_point_balance(), '전화번호 인증 후 포인트를 받을 수 있어요'::text; return;
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
$$;

-- ────────────────────────────────────────────────────────────────
-- 4) 내 인증 상태 확인용 — 프론트에서 배너 보여줄지 판단
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_my_phone_verified()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from public.phone_verifications where user_id = auth.uid());
$$;

revoke all on function public.get_my_phone_verified() from public;
grant execute on function public.get_my_phone_verified() to authenticated;

notify pgrst, 'reload schema';
