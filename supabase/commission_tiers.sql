-- 진행자 등급별 수수료율표. 관리자가 자유롭게 등급(이름/기준 매출/수수료율)을 추가·수정.
-- 실행: Supabase 대시보드(beautyground-main) → SQL Editor 에 붙여넣고 Run

create table if not exists public.commission_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_sales bigint not null default 0,               -- 이 매출(원) 이상부터 적용되는 등급 기준
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  created_at timestamptz not null default now()
);

alter table public.commission_tiers enable row level security;

-- 등급표 자체는 민감정보가 아니고, 오히려 "많이 팔수록 수수료율이 오른다"는 투명성이
-- 진행자 동기부여의 핵심이므로 로그인한 모든 계정(진행자 포함)에게 공개한다.
drop policy if exists "commission_tiers_select_authenticated" on public.commission_tiers;
create policy "commission_tiers_select_authenticated" on public.commission_tiers
  for select using (auth.role() = 'authenticated');

-- 관리자: 등급 추가/수정/삭제 (기존 관례 그대로, 이번 범위 밖의 알려진 한계 답습)
drop policy if exists "commission_tiers_insert_admin" on public.commission_tiers;
create policy "commission_tiers_insert_admin" on public.commission_tiers
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "commission_tiers_update_admin" on public.commission_tiers;
create policy "commission_tiers_update_admin" on public.commission_tiers
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "commission_tiers_delete_admin" on public.commission_tiers;
create policy "commission_tiers_delete_admin" on public.commission_tiers
  for delete using (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
