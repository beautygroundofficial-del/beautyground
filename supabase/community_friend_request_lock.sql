-- 친구 맞신청 동시성 수정안 — 2026-09-27
-- 승인 전 초안. 운영 DB에 실행하지 않음.
-- 근거: 운영 request_friend / respond_friend / remove_friend 정의를 읽기 전용으로 대조.
-- 서로 동시에 신청하면 역방향 pending 두 행이 생길 수 있는 구조를 보완한다.
-- 세 쓰기 함수가 같은 두 사용자에 대해 같은 트랜잭션 잠금을 잡도록 한다.
-- 함수 시그니처·반환값·권한은 유지하며 기존 친구 행을 일괄 수정/삭제하지 않는다.
-- 기존 역방향 중복이 있는지는 별도 SELECT로 확인한 후 보정 여부를 결정해야 한다.
-- 검증: 두 계정 동시 맞신청 → pending 중복 없이 accepted 한 행,
--       일반 신청/수락/거절/취소/친구 해제/자기 신청/비로그인 접근 회귀 확인.

begin;

create or replace function public.request_friend(p_user_id uuid)
returns table (status text, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then return query select 'login', '로그인이 필요해요'; return; end if;
  if p_user_id is null or p_user_id = v_me then return query select 'self', '나에게는 신청할 수 없어요'; return; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('friendships:' || least(v_me, p_user_id)::text),
    pg_catalog.hashtext(greatest(v_me, p_user_id)::text)
  );

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return query select 'none', '없는 사람이에요'; return;
  end if;
  if public.are_friends(v_me, p_user_id) then
    return query select 'friends', '이미 친구예요'; return;
  end if;
  if exists (
    select 1 from public.friendships f
    where f.requester_id = p_user_id and f.addressee_id = v_me and f.status = 'pending'
  ) then
    update public.friendships set status = 'accepted', responded_at = now()
      where requester_id = p_user_id and addressee_id = v_me;
    return query select 'friends', '친구가 됐어요'; return;
  end if;
  insert into public.friendships (requester_id, addressee_id) values (v_me, p_user_id)
    on conflict (requester_id, addressee_id) do nothing;
  return query select 'requested', '친구 신청을 보냈어요';
end;
$$;
revoke all on function public.request_friend(uuid) from public, anon;
grant execute on function public.request_friend(uuid) to authenticated;

create or replace function public.respond_friend(p_user_id uuid, p_accept boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_n integer;
begin
  if v_me is null or p_user_id is null or p_user_id = v_me then return false; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('friendships:' || least(v_me, p_user_id)::text),
    pg_catalog.hashtext(greatest(v_me, p_user_id)::text)
  );

  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
      where requester_id = p_user_id and addressee_id = v_me and status = 'pending';
  else
    delete from public.friendships
      where requester_id = p_user_id and addressee_id = v_me and status = 'pending';
  end if;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke all on function public.respond_friend(uuid, boolean) from public, anon;
grant execute on function public.respond_friend(uuid, boolean) to authenticated;

create or replace function public.remove_friend(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_n integer;
begin
  if v_me is null or p_user_id is null or p_user_id = v_me then return false; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('friendships:' || least(v_me, p_user_id)::text),
    pg_catalog.hashtext(greatest(v_me, p_user_id)::text)
  );

  delete from public.friendships
    where (requester_id = v_me and addressee_id = p_user_id)
       or (requester_id = p_user_id and addressee_id = v_me);
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
