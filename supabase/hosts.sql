-- 진행자(라이브 호스트) 계정 — 브랜드 담당자 본인 방송이 아니라, 뷰티그라운드가 별도
-- 섭외해 여러 브랜드를 옮겨다니며 방송하는 인력. 파트너처럼 신청 테이블을 따로 두지 않고
-- 1단계(가입 즉시 pending insert)로 단순화.
-- 실행: Supabase 대시보드(beautyground-main) → SQL Editor 에 붙여넣고 Run

create table if not exists public.hosts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id),
  name text not null,
  phone text,
  email text,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table public.hosts enable row level security;

-- 본인: 자기 레코드만 조회
drop policy if exists "hosts_select_own" on public.hosts;
create policy "hosts_select_own" on public.hosts
  for select using (auth.uid() = user_id);

-- 본인: 가입 시 본인 user_id + status='pending' 으로만 insert 가능(셀프 승인 방지)
drop policy if exists "hosts_insert_own" on public.hosts;
create policy "hosts_insert_own" on public.hosts
  for insert with check (auth.uid() = user_id and status = 'pending');

-- 관리자(로그인 계정): 전체 조회. partner_applications/hero_banners와 동일하게
-- 별도 admin role 없이 "로그인한 계정"으로만 판별(현재 앱 전체 관례, 이번 범위 밖의 알려진 한계).
drop policy if exists "hosts_select_admin" on public.hosts;
create policy "hosts_select_admin" on public.hosts
  for select using (auth.role() = 'authenticated');

-- 관리자: 승인/정지 등 상태 변경. (주의: 이 정책은 authenticated 전체에 열려있어
-- 이론상 진행자 본인도 자기 status를 바꿀 수 있다 — 알려진 한계, 후속 과제로 문서화)
drop policy if exists "hosts_update_admin" on public.hosts;
create policy "hosts_update_admin" on public.hosts
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
