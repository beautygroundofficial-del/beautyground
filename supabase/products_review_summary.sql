-- 상품 리뷰 요약(리뷰수/평균평점/대표 사진 썸네일) 저장 컬럼 추가
-- 형태: { "count": 340, "avg": 4.7, "photos": ["https://.../a.jpg", ...] }
-- Supabase SQL Editor 에서 1회 실행
alter table products add column if not exists review_summary jsonb;

-- PostgREST 스키마 캐시 갱신 (컬럼 추가 후 즉시 반영)
notify pgrst, 'reload schema';
