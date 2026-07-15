-- 홈 화면 확장: 히어로 배너에 커스텀 이미지+문구 허용, 카테고리 대표 이미지 추가
-- Supabase SQL Editor에서 실행

-- 1) 히어로 배너: 상품 연결 없이 이미지+문구+링크만으로도 등록 가능하게
alter table hero_banners alter column product_id drop not null;
alter table hero_banners add column if not exists image_url text;
alter table hero_banners add column if not exists headline text;
alter table hero_banners add column if not exists subcopy text;
alter table hero_banners add column if not exists link_url text;

-- 2) 카테고리 대표 이미지 (홈 화면 카테고리 아이콘 그리드용)
create table if not exists category_thumbnails (
  category text primary key,
  product_id uuid references products(id) on delete set null,
  image_url text,
  sort_order int not null default 0
);

alter table category_thumbnails enable row level security;

drop policy if exists "category_thumbnails_public_read" on category_thumbnails;
create policy "category_thumbnails_public_read" on category_thumbnails
  for select using (true);

drop policy if exists "category_thumbnails_admin_all" on category_thumbnails;
create policy "category_thumbnails_admin_all" on category_thumbnails
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
