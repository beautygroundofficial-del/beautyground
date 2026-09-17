-- 긴급 보안 수정 — 미연결 브랜드 행 전체 공개조회 정책 제거 + 좁은 미리보기 함수로 교체 (2026-09-18)
-- 문제: partners_select_unclaimed 정책이 user_id is null인 행을 "누구나 select *"로 열어놔서
-- 미연결 브랜드 전체 목록(id·수수료율·사업자정보)이 로그인 없이도 그대로 노출됐다.
-- /brand/register/:id 가입 링크의 보안 전제("이 id를 아는 사람만 가입 가능")가 이 정책 때문에
-- 무너져서, 누구나 쁘띠페·오디크 등 실제 운영 중인 브랜드 판매자 계정을 가로챌 수 있었다.
-- 2026-09-18 실행 확인됨.

-- 1) 공개 통째 노출 정책 제거
drop policy if exists "partners_select_unclaimed" on public.partners;

-- 2) id를 정확히 아는 사람에게만 이름·로고만 보여주는 함수로 교체(목록 조회 불가 — 단건 조회만)
create or replace function public.get_partner_signup_preview(p_id uuid)
returns table (id uuid, brand_name text, export_logo_url text)
language sql
security definer
set search_path = public
stable
as $$
  select id, brand_name, export_logo_url
  from public.partners
  where id = p_id and user_id is null;
$$;
revoke all on function public.get_partner_signup_preview(uuid) from public;
grant execute on function public.get_partner_signup_preview(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
