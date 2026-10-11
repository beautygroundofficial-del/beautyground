-- 차단 시 운영자에게도 알림 (2026-10-11)
-- 목적: Apple 심사 Guideline 1.2 — "blocking should also notify the developer of the inappropriate content"
-- 지금까지 block_user()는 user_blocks에만 기록하고 운영자에게는 아무 신호가 안 갔다.
-- 이 파일은 content_reports.target_type에 'user'를 추가하고, block_user()가 차단과 동시에
-- content_reports에도 기록을 남기게 한다 — 기존 관리자 화면(admin/커뮤니티 신고, BoardReports.tsx)에
-- 그대로 같이 뜬다. 새 화면은 만들지 않는다.
-- 실행: 대표님 승인 후 scripts/db_query.mjs 로 1회. 재실행 안전.

begin;

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('diary','answer','board_comment','diary_comment','answer_comment','chat','user'));

-- 차단: 기록 + 친구 관계 끊기 + 운영자 알림(신고 레코드 추가) — 기존 동작에 insert 한 줄만 추가
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception '자기 자신은 차단할 수 없습니다.'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id)
  on conflict do nothing;
  delete from public.friendships f
  where (f.requester_id = auth.uid() and f.addressee_id = p_user_id)
     or (f.requester_id = p_user_id and f.addressee_id = auth.uid());
  insert into public.content_reports (target_type, target_id, user_id, reason)
  values ('user', p_user_id::text, auth.uid(), '사용자 차단')
  on conflict (target_type, target_id, user_id) do update set created_at = now();
end;
$$;

-- 운영자 목록에 차단된 사용자도 같이 보이게 — nickname은 display_name_of, content는 고정 라벨
create or replace function public.admin_content_reports()
returns table (target_type text, target_id text, content text, nickname text, status text, target_created_at timestamptz,
               report_count integer, last_reported_at timestamptz, reasons text)
language sql
security definer
set search_path = public
as $$
  with t as (
    select 'diary'::text k, id::text tid, content, nickname, status, created_at from public.diaries
    union all select 'answer', id::text, content, nickname, status, created_at from public.daily_answers
    union all select 'board_comment', id::text, content, nickname, status, created_at from public.board_comments
    union all select 'diary_comment', id::text, content, nickname, status, created_at from public.diary_comments
    union all select 'answer_comment', id::text, content, nickname, status, created_at from public.answer_comments
    union all select 'chat', id::text, message, nickname, 'visible', created_at from public.chat_messages
    union all select 'user', id::text, '사용자 차단 신고'::text, public.display_name_of(id), 'visible', created_at from auth.users
  )
  select r.target_type, r.target_id, t.content, t.nickname, t.status, t.created_at,
         count(r.*)::integer, max(r.created_at),
         string_agg(nullif(btrim(r.reason), ''), ' / ' order by r.created_at desc)
  from public.content_reports r
  left join t on t.k = r.target_type and t.tid = r.target_id
  where public.is_admin()
  group by r.target_type, r.target_id, t.content, t.nickname, t.status, t.created_at
  order by max(r.created_at) desc;
$$;
revoke all on function public.admin_content_reports() from public;
grant execute on function public.admin_content_reports() to authenticated;

commit;
