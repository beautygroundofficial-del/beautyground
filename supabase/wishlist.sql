-- 찜(위시리스트) 기능: 고객이 상품을 찜해두고 나중에 볼 수 있게 함
-- Supabase SQL Editor에서 실행

create table if not exists wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists wishlist_items_user_id_idx on wishlist_items(user_id);

alter table wishlist_items enable row level security;

drop policy if exists "wishlist_items_select_own" on wishlist_items;
create policy "wishlist_items_select_own" on wishlist_items
  for select using (auth.uid() = user_id);

drop policy if exists "wishlist_items_insert_own" on wishlist_items;
create policy "wishlist_items_insert_own" on wishlist_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "wishlist_items_delete_own" on wishlist_items;
create policy "wishlist_items_delete_own" on wishlist_items
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
