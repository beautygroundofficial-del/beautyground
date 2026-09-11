-- 브랜드 셀러센터 — 판매자(사업자) 정보 셀프 관리 (2026-09-11)
-- 히로인스 판매자 가이드 목차 대조 결과 "판매자 정보 설정"에 해당하는 화면이 우리 셀러센터엔
-- 아예 없었다(가입 시 서류는 뷰티그라운드 담당자가 ERP 입점 절차로 오프라인 수집, 이후 브랜드가
-- 직접 확인·수정할 방법 없음). 확정한 메뉴 순서(로드맵 "브랜드 셀러센터 메뉴 구조 확정")의 1번.
--
-- ⚠️ 브랜드가 스스로 고칠 수 있는 건 사업자정보·정산계좌·담당자 연락처뿐이다.
-- brand_name(브랜드명 표기)·status(입점상태)·commission_rate(수수료율)는 절대 셀프 수정 불가
-- (수수료율은 계약사항이라 브랜드가 스스로 바꿀 수 있으면 안 됨) — RPC가 화이트리스트한 컬럼만 건드린다.

alter table partners add column if not exists biz_no text;
alter table partners add column if not exists ceo_name text;
alter table partners add column if not exists biz_address text;
alter table partners add column if not exists contact_phone text;
alter table partners add column if not exists bank_name text;
alter table partners add column if not exists bank_account text;
alter table partners add column if not exists bank_holder text;

create or replace function public.update_my_partner_company_info(
  p_biz_no text,
  p_ceo_name text,
  p_biz_address text,
  p_contact_phone text,
  p_bank_name text,
  p_bank_account text,
  p_bank_holder text
)
returns public.partners
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partners;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  update public.partners
  set biz_no = nullif(trim(p_biz_no), ''),
      ceo_name = nullif(trim(p_ceo_name), ''),
      biz_address = nullif(trim(p_biz_address), ''),
      contact_phone = nullif(trim(p_contact_phone), ''),
      bank_name = nullif(trim(p_bank_name), ''),
      bank_account = nullif(trim(p_bank_account), ''),
      bank_holder = nullif(trim(p_bank_holder), '')
  where user_id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception '연결된 브랜드 계정을 찾을 수 없습니다.';
  end if;

  return v_row;
end;
$$;
revoke all on function public.update_my_partner_company_info(text, text, text, text, text, text, text) from public;
grant execute on function public.update_my_partner_company_info(text, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
