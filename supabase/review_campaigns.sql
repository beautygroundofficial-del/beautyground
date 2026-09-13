-- 체험단(리뷰 캠페인) 최소 기능 — 2026-09-14
-- 기존 missions 테이블(걷기·일기 등 고정포인트 활동)과는 별개 — 체험단은 특정 상품 지정·
-- 구매 인증·구매액 비례 환급·인원 제한이 필요해 새 스키마로 분리한다.
-- 참고: 03 홈페이지/참여유도형 리뷰체험단 기획.md
-- 실행: Supabase 대시보드(beautyground-main, bjqtuklkskrqzbuxdwxm) → SQL Editor

create table if not exists public.review_campaigns (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  partner_id uuid references public.partners(id),
  title text not null,
  reward_percent numeric not null,
  max_participants integer not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.review_campaign_applications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.review_campaigns(id),
  user_id uuid not null,
  status text not null default 'applied'
    check (status in ('applied','selected','purchased','reviewed','rewarded','rejected')),
  order_id text,
  review_id uuid,
  rewarded_points integer,
  applied_at timestamptz not null default now(),
  unique(campaign_id, user_id)
);

create index if not exists idx_review_campaigns_status on public.review_campaigns (status);
create index if not exists idx_review_campaign_apps_user on public.review_campaign_applications (user_id);
create index if not exists idx_review_campaign_apps_campaign on public.review_campaign_applications (campaign_id, status);

alter table public.review_campaigns enable row level security;
alter table public.review_campaign_applications enable row level security;

-- 누구나 열린 캠페인 목록은 볼 수 있다
create policy review_campaigns_select_open on public.review_campaigns
  for select using (status = 'open' or is_admin());

-- 신청 내역은 본인 것만, 관리자는 전체
create policy review_campaign_apps_own on public.review_campaign_applications
  for select using (user_id = auth.uid() or is_admin());

create policy review_campaign_apps_insert_own on public.review_campaign_applications
  for insert with check (user_id = auth.uid());

grant select on public.review_campaigns to anon, authenticated;
grant select, insert on public.review_campaign_applications to authenticated;
