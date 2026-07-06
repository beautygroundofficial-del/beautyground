-- 배송지 저장 기능: 고객이 여러 배송지를 저장하고 기본 배송지를 지정할 수 있게 함
-- Supabase SQL Editor에서 실행

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists addresses_user_id_idx on addresses(user_id);

alter table addresses enable row level security;

drop policy if exists "addresses_select_own" on addresses;
create policy "addresses_select_own" on addresses
  for select using (auth.uid() = user_id);

drop policy if exists "addresses_insert_own" on addresses;
create policy "addresses_insert_own" on addresses
  for insert with check (auth.uid() = user_id);

drop policy if exists "addresses_update_own" on addresses;
create policy "addresses_update_own" on addresses
  for update using (auth.uid() = user_id);

drop policy if exists "addresses_delete_own" on addresses;
create policy "addresses_delete_own" on addresses
  for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
