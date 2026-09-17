-- 커뮤니티 애칭(닉네임) — 2026-09-18
-- 대표님 지시: "회원이 되는 단계에서 애칭을 만드는 과정 있어야해" → 가입 시점보다는
-- "글/댓글을 처음 쓰려는 시점"에 애칭이 없으면 만들게 한다(카카오/네이버 로그인 마찰 유지).
-- 중복 애칭 금지(대소문자 구분 없이) + 애칭 설정 시 10P 지급(missions 'nickname_set').
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor 에 전체 붙여넣고 Run

create table if not exists public.user_nicknames (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nickname   text not null,
  created_at timestamptz not null default now()
);

-- 대소문자만 다른 애칭(예: abc / ABC)도 같은 걸로 취급해 중복 방지
create unique index if not exists user_nicknames_nickname_ci_unique
  on public.user_nicknames (lower(nickname));

alter table public.user_nicknames enable row level security;

drop policy if exists user_nicknames_own_read on public.user_nicknames;
create policy user_nicknames_own_read on public.user_nicknames
  for select using (auth.uid() = user_id);

drop policy if exists user_nicknames_own_insert on public.user_nicknames;
create policy user_nicknames_own_insert on public.user_nicknames
  for insert with check (auth.uid() = user_id);

drop policy if exists user_nicknames_admin_all on public.user_nicknames;
create policy user_nicknames_admin_all on public.user_nicknames
  for all using (public.is_admin()) with check (public.is_admin());

-- 애칭 설정 — 한 번 정하면 이 함수로는 다시 못 바꾼다(중복검사 무력화 방지, 변경은 관리자만 admin RLS로).
create or replace function public.set_my_nickname(p_nickname text)
returns table (ok boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_clean text := trim(coalesce(p_nickname, ''));
begin
  if v_uid is null then
    return query select false, '로그인이 필요합니다'; return;
  end if;
  if length(v_clean) < 2 or length(v_clean) > 12 then
    return query select false, '애칭은 2~12자로 정해주세요'; return;
  end if;
  if exists (select 1 from public.user_nicknames where user_id = v_uid) then
    return query select false, '이미 애칭을 설정했어요'; return;
  end if;

  begin
    insert into public.user_nicknames (user_id, nickname) values (v_uid, v_clean);
  exception when unique_violation then
    return query select false, '이미 다른 분이 쓰고 있는 애칭이에요. 다른 애칭을 입력해 주세요'; return;
  end;

  return query select true, '애칭이 설정됐어요';
end;
$$;

revoke all on function public.set_my_nickname(text) from public;
grant execute on function public.set_my_nickname(text) to authenticated;

-- 애칭 설정 미션(10P, 평생 1회) — /admin/missions 화면과 같은 테이블에 직접 등록.
insert into public.missions (key, title, description, icon, type, metric, target_value, reward_points, max_per_day, active, sort_order)
values ('nickname_set', '애칭 만들기', '커뮤니티에서 쓸 나만의 애칭을 처음 만들면 드려요', '✨', 'once', 'nickname_set', 1, 10, 1, true, 5)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
