-- 라이브 방송 종료 후 통계: 최고 동시 시청자 수
-- LiveDetail(판매자 화면)이 방송 중 폴링한 시청자 수 중 최고값을 기록해두고,
-- 방송 종료 후 결과 패널에 "총 시청자"로 표시한다.
-- 실행: Supabase 대시보드(beautyground-main) → SQL Editor 에 붙여넣고 Run

alter table public.lives
  add column if not exists peak_viewers integer not null default 0;
