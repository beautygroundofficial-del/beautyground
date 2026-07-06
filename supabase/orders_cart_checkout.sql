-- 구매 흐름 실연동: orders 테이블 보강 + cart_items 신설
-- Supabase SQL Editor에서 실행

-- 1) orders 테이블에 결제 연동에 필요한 컬럼 추가 (CheckoutPage/api/payment-complete 가 실제로 참조하는 컬럼)
alter table orders add column if not exists payment_id text unique;
alter table orders add column if not exists order_name text;
alter table orders add column if not exists buyer_email text;
alter table orders add column if not exists user_id uuid references auth.users(id);
alter table orders add column if not exists pg_tx_id text;

-- 2) 장바구니 (회원가입 필수 → user_id 기준 DB 저장)
create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table cart_items enable row level security;

drop policy if exists "cart_items_select_own" on cart_items;
create policy "cart_items_select_own" on cart_items
  for select using (auth.uid() = user_id);

drop policy if exists "cart_items_insert_own" on cart_items;
create policy "cart_items_insert_own" on cart_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "cart_items_update_own" on cart_items;
create policy "cart_items_update_own" on cart_items
  for update using (auth.uid() = user_id);

drop policy if exists "cart_items_delete_own" on cart_items;
create policy "cart_items_delete_own" on cart_items
  for delete using (auth.uid() = user_id);

-- 3) orders: 현재 RLS 미적용(익명키로 전체 조회/수정 가능) 상태.
--    RLS를 켜되, 기존 파트너 주문관리(PartnerOrders.tsx: partner_id 기준 조회/상태변경)가
--    계속 동작하도록 파트너용 정책을 반드시 함께 추가한다.
alter table orders enable row level security;

-- 고객: 본인이 만든 주문만 조회/생성
drop policy if exists "orders_select_own" on orders;
create policy "orders_select_own" on orders
  for select using (auth.uid() = user_id);

drop policy if exists "orders_insert_own" on orders;
create policy "orders_insert_own" on orders
  for insert with check (auth.uid() = user_id);

-- 파트너: 자기 브랜드(partner_id) 주문만 조회/상태변경 (기존 PartnerOrders.tsx 동작 유지용)
drop policy if exists "orders_select_partner" on orders;
create policy "orders_select_partner" on orders
  for select using (
    partner_id in (select id from partners where user_id = auth.uid())
  );

drop policy if exists "orders_update_partner" on orders;
create policy "orders_update_partner" on orders
  for update using (
    partner_id in (select id from partners where user_id = auth.uid())
  );

notify pgrst, 'reload schema';
