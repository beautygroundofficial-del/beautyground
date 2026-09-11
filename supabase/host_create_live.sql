-- 승인된 진행자가 스스로 라이브를 만들고 자기 host_token 링크를 즉시 받아갈 수 있게 하는 RPC(2026-08-25).
-- host_token 컬럼은 anon/authenticated에서 select 자체가 막혀있어(lives_host_token.sql) 일반
-- insert+select로는 받아올 수 없다 — SECURITY DEFINER 함수로 생성 직후에만 예외적으로 그 값을 반환한다.
-- 실행: Supabase 대시보드(beautyground-main) → SQL Editor에서 Run

-- search_path에 extensions도 포함 필수: lives.host_token 기본값이 gen_random_bytes()를 쓰는데
-- 이 DB에선 pgcrypto가 extensions 스키마에 이미 설치돼 있어 public만으로는 못 찾는다
-- ("function gen_random_bytes(integer) does not exist", 2026-09-02 실제 발생·확인).
create or replace function public.create_my_live(p_title text, p_scheduled_at timestamptz)
returns table (id uuid, host_token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_host_id uuid;
  v_id uuid;
  v_token text;
begin
  select h.id into v_host_id from public.hosts h where h.user_id = auth.uid() and h.status = 'active';
  if v_host_id is null then
    raise exception '승인된 진행자만 라이브를 만들 수 있습니다.';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception '제목을 입력하세요.';
  end if;

  insert into public.lives (title, scheduled_at, host_id, status)
  values (trim(p_title), p_scheduled_at, v_host_id, 'scheduled')
  returning lives.id, lives.host_token into v_id, v_token;

  return query select v_id, v_token;
end;
$$;
revoke all on function public.create_my_live(text, timestamptz) from public;
grant execute on function public.create_my_live(text, timestamptz) to authenticated;
