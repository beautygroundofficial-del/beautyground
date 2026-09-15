-- 상품 리뷰(product_reviews)에 관리자/브랜드 답변 컬럼 추가 — 2026-09-16 알림시스템 전수조사 발견 사항
-- 리뷰에 대한 답변 기능 자체가 없었음(스키마에 답변 컬럼이 없음). 딱 답변 하나 다는 최소 컬럼만 추가한다.
-- product_questions(구매 문의)과 같은 패턴: 답변 텍스트 + 답변 시각. 누가 답했는지 추적용 replied_by만 추가.

alter table product_reviews add column if not exists reply_content text;
alter table product_reviews add column if not exists replied_at timestamptz;
alter table product_reviews add column if not exists replied_by uuid references auth.users(id);

-- 기존엔 product_reviews에 update 정책 자체가 없어(삭제만 있었음) 답변을 저장할 수 없었다.
-- product_questions_update_admin과 동일 패턴: 답변 등록/수정은 관리자만.
drop policy if exists "product_reviews_update_admin" on product_reviews;
create policy "product_reviews_update_admin" on product_reviews
  for update using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
