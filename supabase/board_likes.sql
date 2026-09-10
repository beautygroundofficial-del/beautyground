-- 속 이야기 하트(좋아요) — 2026-09-11
-- 대표님 지시 "좋아요 하트도 만들어". 하루 이야기는 diary_likes·toggle_diary_like 가 이미 있어 그대로 쓰고,
-- 속 이야기에만 같은 구조를 새로 만든다. 포인트 없음(어뷰징 쉬움), 정렬·등수에 안 씀.
-- ⚠️ community_media_edit.sql 이후에 실행(조회 함수 3개를 다시 만든다 — like_count·liked_by_me 추가).
-- ⚠️ 실행 전 대표님 승인 필요(2026-09-11 방침). 실행: Supabase 대시보드(beautyground-main) → SQL Editor

create table if not exists public.board_likes (
  post_id    uuid not null references public.board_posts(id) on delete cascade,
  user_id    uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists idx_board_likes_user on public.board_likes (user_id);

alter table public.board_likes enable row level security;
drop policy if exists board_likes_read on public.board_likes;
create policy board_likes_read on public.board_likes for select using (true);
drop policy if exists board_likes_own_write on public.board_likes;
create policy board_likes_own_write on public.board_likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.toggle_board_like(p_post_id uuid)
returns table (liked boolean, like_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_exists boolean;
  v_count integer;
begin
  if v_uid is null then
    return query select false, 0; return;
  end if;
  -- 내 글은 안 된다(화면에서도 막지만 한 번 더)
  if exists (select 1 from public.board_posts b where b.id = p_post_id and b.user_id = v_uid) then
    select count(*)::integer into v_count from public.board_likes l where l.post_id = p_post_id;
    return query select false, v_count; return;
  end if;
  select exists(select 1 from public.board_likes l where l.post_id = p_post_id and l.user_id = v_uid) into v_exists;
  if v_exists then
    delete from public.board_likes where post_id = p_post_id and user_id = v_uid;
  else
    insert into public.board_likes (post_id, user_id) values (p_post_id, v_uid) on conflict do nothing;
  end if;
  select count(*)::integer into v_count from public.board_likes l where l.post_id = p_post_id;
  return query select (not v_exists), v_count;
end;
$$;
revoke all on function public.toggle_board_like(uuid) from public;
grant execute on function public.toggle_board_like(uuid) to authenticated;

-- 조회 3종에 like_count · liked_by_me 추가 (반환 컬럼이 늘어 drop 후 재생성)
drop function if exists public.get_board_feed(text[], integer, integer);
create function public.get_board_feed(
  p_categories text[] default '{}',
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, nickname text, category text, content text, images text[],
  is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text, comment_count integer,
  video_url text, like_count integer, liked_by_me boolean
)
language sql security definer set search_path = public as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()), b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.video_url,
         (select count(*)::integer from public.board_likes l where l.post_id = b.id),
         exists(select 1 from public.board_likes l where l.post_id = b.id and l.user_id = auth.uid())
  from public.board_posts b
  where b.status = 'visible'
    and (coalesce(array_length(p_categories, 1), 0) = 0 or b.category = any(p_categories))
  order by b.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_board_feed(text[], integer, integer) from public;
grant execute on function public.get_board_feed(text[], integer, integer) to anon, authenticated;

drop function if exists public.get_board_post(uuid);
create function public.get_board_post(p_id uuid)
returns table (
  id uuid, user_id uuid, nickname text, category text, content text, images text[],
  is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text, comment_count integer,
  video_url text, like_count integer, liked_by_me boolean
)
language sql security definer set search_path = public as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()), b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.video_url,
         (select count(*)::integer from public.board_likes l where l.post_id = b.id),
         exists(select 1 from public.board_likes l where l.post_id = b.id and l.user_id = auth.uid())
  from public.board_posts b
  where b.id = p_id
    and (b.status = 'visible' or b.user_id = auth.uid() or public.is_admin());
$$;
revoke all on function public.get_board_post(uuid) from public;
grant execute on function public.get_board_post(uuid) to anon, authenticated;

drop function if exists public.get_my_board_posts(integer, integer);
create function public.get_my_board_posts(
  p_limit  integer default 30,
  p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, nickname text, category text, content text, images text[],
  is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text, comment_count integer,
  status text, video_url text, like_count integer, liked_by_me boolean
)
language sql security definer set search_path = public as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         true, b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         null::text,
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.status, b.video_url,
         (select count(*)::integer from public.board_likes l where l.post_id = b.id),
         false
  from public.board_posts b
  where b.user_id = auth.uid()
  order by b.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_my_board_posts(integer, integer) from public;
grant execute on function public.get_my_board_posts(integer, integer) to authenticated;

notify pgrst, 'reload schema';
