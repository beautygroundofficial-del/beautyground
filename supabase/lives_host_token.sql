-- 진행자 로그인 없는 "링크 하나로 방송 송출" 기능(2026-08-20).
-- 매번 진행자 계정을 만드는 대신, 방송(live)마다 고유 토큰을 발급해 그 링크(/host/go/:token)로
-- 들어오면 로그인 없이 송출 채널(RTMPS·WebRTC) 정보를 볼 수 있게 한다.
-- 토큰 자체가 비밀번호 역할이라 host_token 컬럼은 공개 select 정책에 절대 포함시키지 않고,
-- 아래 SECURITY DEFINER 함수를 통해서만(토큰을 정확히 아는 사람만) 조회 가능하게 한다.
-- 실행: Supabase 대시보드(beautyground-main) → SQL Editor 에서 Run

-- with schema public 명시 필수: 생략하면 Supabase가 extensions 스키마에 설치하는데,
-- create_my_live()가 set search_path = public 이라 gen_random_bytes()를 못 찾아
-- "function gen_random_bytes(integer) does not exist" 로 실패한다(2026-09-02 실제 발생·확인).
create extension if not exists pgcrypto with schema public;

alter table public.lives
  add column if not exists host_token text unique default encode(gen_random_bytes(18), 'hex');

-- 기존 행 중 토큰 없는 것 백필
update public.lives set host_token = encode(gen_random_bytes(18), 'hex') where host_token is null;

-- ⚠️ 중요: lives 테이블은 소비자가 select('*')로 통째로 읽는 공개 테이블이다.
-- 컬럼 단위로 host_token만 콕 집어 조회 권한을 회수해서, 어떤 select('*')를 하더라도
-- 이 컬럼값은 절대 응답에 섞여나가지 않게 한다(anon/authenticated 둘 다 대상).
revoke select (host_token) on public.lives from anon, authenticated;

-- 토큰으로 방송 1건 조회 — 로그인 불필요. 유효기간: 예정시각 6시간 전 ~ 종료(ended) 전까지.
-- (ended로 바뀌면 관리자가 명시적으로 방송을 끝낸 것이므로 그 이후엔 토큰도 자동 무효화)
create or replace function public.get_live_by_host_token(p_token text)
returns public.lives
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.lives;
begin
  select * into v_row from public.lives where host_token = p_token;

  if v_row.id is null then
    raise exception '유효하지 않은 링크입니다.';
  end if;
  if v_row.status = 'ended' then
    raise exception '이미 종료된 방송입니다.';
  end if;
  if v_row.scheduled_at is not null and now() < v_row.scheduled_at - interval '6 hours' then
    raise exception '아직 방송 준비 시간이 아닙니다.';
  end if;

  return v_row;
end;
$$;
revoke all on function public.get_live_by_host_token(text) from public;
grant execute on function public.get_live_by_host_token(text) to anon, authenticated;
