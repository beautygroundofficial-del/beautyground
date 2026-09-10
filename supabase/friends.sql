-- 친구 맺기 — 2026-09-11 대표님 지시 "유저끼리 친구 맺기 기능도 만들어줘"
--
-- 방식: 신청 → 상대가 수락 → 친구(양방향). 서로에게 신청하면 그 자리에서 성립.
-- 쓰기는 전부 RPC(security definer)로만, 테이블 직접 insert/update 는 막는다.
-- 이름: "친구"(타사 표현 "응원친구"는 쓰지 않는다 — 타사 표현 사용 금지 목록).
-- 속 이야기(익명 게시판)에는 붙이지 않는다 — 이름을 가리고 털어놓는 곳이라 친구가 익명성을 깬다.
-- ✅ 2026-09-11 대표님 승인("실행해") 후 운영 DB(beautyground-main) SQL Editor 실행 완료.
--    두 계정으로 신청 → 마이페이지 개수 → 수락 → 이름 공개 → 친구 탭 → 끊기까지 확인.

create table if not exists public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,  -- 신청한 사람
  addressee_id uuid not null references auth.users(id) on delete cascade,  -- 받은 사람
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
create index if not exists idx_friendships_addressee on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
drop policy if exists friendships_read_own on public.friendships;
create policy friendships_read_own on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);
-- insert/update/delete 정책 없음 → RPC 로만

-- 두 사람이 친구인가
create or replace function public.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = p_a and f.addressee_id = p_b) or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;
revoke all on function public.are_friends(uuid, uuid) from public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- 표시 이름 — 닉네임(user_metadata.name) 없으면 이메일 앞부분. 글의 nickname 스냅샷과 같은 규칙.
create or replace function public.display_name_of(p_user uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1), '익명')
  from auth.users u where u.id = p_user;
$$;
revoke all on function public.display_name_of(uuid) from public;
grant execute on function public.display_name_of(uuid) to authenticated;

-- 친구 신청. 상대가 이미 나에게 신청해 뒀으면 그 자리에서 친구가 된다.
-- 반환 status: 'friends' | 'requested' | 'self' | 'login'
create or replace function public.request_friend(p_user_id uuid)
returns table (status text, message text)
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then return query select 'login', '로그인이 필요해요'; return; end if;
  if p_user_id is null or p_user_id = v_me then return query select 'self', '나에게는 신청할 수 없어요'; return; end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return query select 'none', '없는 사람이에요'; return;
  end if;

  if public.are_friends(v_me, p_user_id) then
    return query select 'friends', '이미 친구예요'; return;
  end if;

  -- 상대가 먼저 보낸 신청이 있으면 수락으로 처리
  if exists (select 1 from public.friendships f where f.requester_id = p_user_id and f.addressee_id = v_me and f.status = 'pending') then
    update public.friendships set status = 'accepted', responded_at = now()
      where requester_id = p_user_id and addressee_id = v_me;
    return query select 'friends', '친구가 됐어요'; return;
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_me, p_user_id)
    on conflict (requester_id, addressee_id) do nothing;
  return query select 'requested', '친구 신청을 보냈어요';
end;
$$;
revoke all on function public.request_friend(uuid) from public;
grant execute on function public.request_friend(uuid) to authenticated;

-- 받은 신청에 답하기 — 수락(accepted) 또는 거절(행 삭제, 상대에게 알리지 않는다)
create or replace function public.respond_friend(p_user_id uuid, p_accept boolean)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_n integer;
begin
  if v_me is null then return false; end if;
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
revoke all on function public.respond_friend(uuid, boolean) from public;
grant execute on function public.respond_friend(uuid, boolean) to authenticated;

-- 끊기 — 내가 보낸 신청 취소, 또는 친구 끊기(양쪽 어느 행이든 삭제)
create or replace function public.remove_friend(p_user_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_n integer;
begin
  if v_me is null then return false; end if;
  delete from public.friendships
    where (requester_id = v_me and addressee_id = p_user_id)
       or (requester_id = p_user_id and addressee_id = v_me);
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

-- 여러 사람과의 관계를 한 번에 — 피드 카드에 버튼 상태를 그리기 위해
-- status: 'friends' | 'requested'(내가 보냄) | 'received'(상대가 보냄). 관계 없는 사람은 행이 없다.
create or replace function public.get_friend_statuses(p_user_ids uuid[])
returns table (user_id uuid, status text)
language sql stable security definer set search_path = public as $$
  select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end,
         case when f.status = 'accepted' then 'friends'
              when f.requester_id = auth.uid() then 'requested'
              else 'received' end
  from public.friendships f
  where (f.requester_id = auth.uid() and f.addressee_id = any(p_user_ids))
     or (f.addressee_id = auth.uid() and f.requester_id = any(p_user_ids));
$$;
revoke all on function public.get_friend_statuses(uuid[]) from public;
grant execute on function public.get_friend_statuses(uuid[]) to authenticated;

-- 내 친구 목록
create or replace function public.get_my_friends()
returns table (user_id uuid, nickname text, since timestamptz)
language sql stable security definer set search_path = public as $$
  select x.other, public.display_name_of(x.other), x.since
  from (
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as other,
           coalesce(f.responded_at, f.created_at) as since
    from public.friendships f
    where f.status = 'accepted' and (f.requester_id = auth.uid() or f.addressee_id = auth.uid())
  ) x
  order by x.since desc;
$$;
revoke all on function public.get_my_friends() from public;
grant execute on function public.get_my_friends() to authenticated;

-- 대기 중인 신청 — 받은 것(received)과 보낸 것(sent)
create or replace function public.get_friend_requests()
returns table (user_id uuid, nickname text, direction text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.requester_id, public.display_name_of(f.requester_id), 'received', f.created_at
  from public.friendships f where f.addressee_id = auth.uid() and f.status = 'pending'
  union all
  select f.addressee_id, public.display_name_of(f.addressee_id), 'sent', f.created_at
  from public.friendships f where f.requester_id = auth.uid() and f.status = 'pending'
  order by 4 desc;
$$;
revoke all on function public.get_friend_requests() from public;
grant execute on function public.get_friend_requests() to authenticated;

-- 받은 신청 개수 — 마이페이지 메뉴 옆 숫자
create or replace function public.get_friend_request_count()
returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.friendships f
  where f.addressee_id = auth.uid() and f.status = 'pending';
$$;
revoke all on function public.get_friend_request_count() from public;
grant execute on function public.get_friend_request_count() to authenticated;

-- 친구 글만 — get_diary_feed 와 같은 모양, 친구와 내 글만 최신순
create or replace function public.get_friend_diary_feed(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, nickname text, content text, images text[],
  like_count integer, liked_by_me boolean, is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text,
  comment_count integer,
  steps integer,
  video_url text
)
language sql security definer set search_path = public as $$
  select d.id, d.user_id, d.nickname, d.content, d.images,
         d.like_count,
         exists(select 1 from public.diary_likes l where l.diary_id = d.id and l.user_id = auth.uid()),
         (d.user_id = auth.uid()),
         d.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.diary_comments c where c.diary_id = d.id and c.status = 'visible'),
         d.steps,
         d.video_url
  from public.diaries d
  where d.status = 'visible'
    and auth.uid() is not null
    and (d.user_id = auth.uid() or public.are_friends(auth.uid(), d.user_id))
  order by d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_friend_diary_feed(integer, integer) from public;
grant execute on function public.get_friend_diary_feed(integer, integer) to authenticated;

notify pgrst, 'reload schema';
