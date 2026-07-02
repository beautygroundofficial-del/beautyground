-- 스크랩 원본 상품 페이지 URL 저장 (수정 화면에서 후기 재수집 시 URL 미리 채우기)
alter table products add column if not exists source_url text;
notify pgrst, 'reload schema';
