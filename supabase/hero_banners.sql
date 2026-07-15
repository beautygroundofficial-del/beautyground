-- 홈 화면 히어로 배너: 관리자가 고른 상품을 순서대로 노출
-- Supabase SQL Editor에서 실행

create table if not exists hero_banners (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists hero_banners_sort_idx on hero_banners(sort_order);

alter table hero_banners enable row level security;

-- 소비자(anon): 노출중인 배너만 조회
drop policy if exists "hero_banners_public_read" on hero_banners;
create policy "hero_banners_public_read" on hero_banners
  for select using (active = true);

-- 관리자(로그인 계정): 전체 조회/추가/수정/삭제. partner_applications와 동일하게
-- 별도 admin role 없이 "로그인한 계정"으로만 판별(현재 앱 전체 관례).
drop policy if exists "hero_banners_admin_all" on hero_banners;
create policy "hero_banners_admin_all" on hero_banners
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
