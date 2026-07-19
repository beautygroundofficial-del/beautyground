-- 라이브에 진행자(호스트) 지정 — 브랜드 담당자 자체 진행이면 NULL(수수료 정산 대상 아님).
-- 실행: hosts.sql 적용 이후 Supabase 대시보드(beautyground-main) → SQL Editor 에서 Run

alter table public.lives
  add column if not exists host_id uuid references public.hosts(id) on delete set null;

create index if not exists lives_host_id_idx on public.lives (host_id);
