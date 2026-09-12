-- 헤더 "n,321명" 카운터 — 대표님 지시(2026-09-13): "7,321명을 기준으로 앞으로 회원가입이 되면 카운트 늘려나가라"
-- 지금까지는 AppHeader.tsx에 7321이 하드코딩(2026-09-10 임시값)돼 있었다.
-- auth.users는 클라이언트(anon/authenticated)에서 직접 select 할 수 없으므로
-- admin_members.sql과 같은 패턴으로 SECURITY DEFINER 함수 하나만 공개로 연다.
-- 개인정보는 전혀 반환하지 않고 숫자 하나만 돌려주므로 관리자 게이팅(is_admin()) 없이 누구나 호출 가능하게 둔다.
-- 실행: Supabase 대시보드(beautyground-main, bjqtuklkskrqzbuxdwxm) → SQL Editor

create or replace function public.get_member_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select 7321 + (
    select count(*)::int from auth.users
    where created_at >= '2026-09-13T00:00:00+09:00'
  );
$$;

grant execute on function public.get_member_count() to anon, authenticated;
