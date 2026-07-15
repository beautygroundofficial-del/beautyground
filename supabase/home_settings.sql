-- 홈 화면 공지 마퀴 문구 (싱글턴 1행) — 관리자가 텍스트로 편집
-- Supabase SQL Editor에서 실행

create table if not exists home_settings (
  id int primary key default 1,
  marquee_items text[] not null default array[
    '🎁 회원가입하면 다양한 혜택이 준비되어 있어요',
    '💛 뷰티그라운드 셀렉트 신상품을 만나보세요'
  ],
  updated_at timestamptz not null default now()
);

insert into home_settings (id) values (1) on conflict (id) do nothing;

alter table home_settings enable row level security;

drop policy if exists "home_settings_public_read" on home_settings;
create policy "home_settings_public_read" on home_settings
  for select using (true);

drop policy if exists "home_settings_admin_write" on home_settings;
create policy "home_settings_admin_write" on home_settings
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

notify pgrst, 'reload schema';
