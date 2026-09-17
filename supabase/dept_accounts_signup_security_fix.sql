-- dept_accounts도 partners와 동일한 패턴의 구멍이라 같이 막는다 (2026-09-18)
-- dept_accounts_select_unclaimed 정책이 미연결(user_id is null) 행을 로그인 없이 통째로
-- select * 가능하게 열어놔서, /dept/register/:id 가입 링크의 보안 전제(id를 아는 사람만
-- 가입 가능)가 깨져 있었다. 실행 시점엔 미연결 행이 0건이라 당장 새는 데이터는 없었지만,
-- 구조적으로 partners_signup_security_fix.sql과 동일한 취약점이라 같이 고쳐둔다.
-- 2026-09-18 실행 확인됨.

drop policy if exists "dept_accounts_select_unclaimed" on public.dept_accounts;

create or replace function public.get_dept_signup_preview(p_id uuid)
returns table (id uuid, dept_key text, display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select id, dept_key, display_name
  from public.dept_accounts
  where id = p_id and user_id is null;
$$;
revoke all on function public.get_dept_signup_preview(uuid) from public;
grant execute on function public.get_dept_signup_preview(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
