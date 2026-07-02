-- 상품에 업체 리뷰 게시판에서 수집한 리뷰(JSON 배열)를 저장하는 컬럼 추가
-- Supabase SQL Editor 에서 1회 실행
alter table products add column if not exists scraped_reviews jsonb;

-- PostgREST 스키마 캐시 갱신 (컬럼 추가 후 즉시 반영)
notify pgrst, 'reload schema';
