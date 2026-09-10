-- 커뮤니티 글 — 영상 첨부 + 고쳐 쓰기 (2026-09-11)
-- 대표님 지시: "삭제 옆에 수정도, 다른 유저가 댓글·반응, MP4 영상도 올릴 수 있으면"
--   · 영상: 글당 1개, Storage(product-images) 에 올리고 URL 만 저장(video_url)
--   · 수정: 본인 글은 RLS(own_all)로 직접 update — 별도 함수 없음. 포인트는 다시 주지 않는다(수정은 새 글이 아니다)
-- ⚠️ diary_steps.sql · board_links.sql 이후에 실행(반환 컬럼이 늘어 drop 후 재생성).
-- 실행: Supabase 대시보드(beautyground-main, bjqtuklkskrqzbuxdwxm) → SQL Editor

alter table public.diaries     add column if not exists video_url text;
alter table public.board_posts add column if not exists video_url text;

-- ────────────────────────────────────────────────────────────────
-- 1) create_diary — 영상 인자 추가 (4인자 버전 제거)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.create_diary(text, text[], text, integer);

create function public.create_diary(
  p_content  text,
  p_images   text[] default '{}',
  p_nickname text default null,
  p_steps    integer default null,
  p_video    text default null
)
returns table (diary_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_claim record;
  v_photo record;
  v_total integer := 0;
  v_steps integer := null;
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;
  if p_content is null or length(btrim(p_content)) < 5 then
    return query select null::uuid, 0, '내용을 5자 이상 입력해 주세요'::text; return;
  end if;
  if p_steps is not null and p_steps > 0 then
    v_steps := least(p_steps, 200000);
  end if;

  insert into public.diaries (user_id, nickname, content, images, steps, video_url)
  values (v_uid, p_nickname, btrim(p_content), coalesce(p_images, '{}'), v_steps, nullif(btrim(coalesce(p_video, '')), ''))
  returning id into v_id;

  select * into v_claim from public.claim_mission('diary_post', 1);
  v_total := coalesce(v_claim.awarded, 0);

  -- 사진이나 영상을 실제로 넣었을 때만 추가 적립(diary_photo)
  if coalesce(array_length(p_images, 1), 0) > 0 or nullif(btrim(coalesce(p_video, '')), '') is not null then
    select * into v_photo from public.claim_mission('diary_photo', 1);
    v_total := v_total + coalesce(v_photo.awarded, 0);
  end if;

  return query select v_id, v_total, coalesce(v_claim.message, '')::text;
end;
$$;

revoke all on function public.create_diary(text, text[], text, integer, text) from public;
grant execute on function public.create_diary(text, text[], text, integer, text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 2) get_diary_feed — video_url 추가
-- ────────────────────────────────────────────────────────────────
drop function if exists public.get_diary_feed(text, integer, integer);

create function public.get_diary_feed(
  p_sort text default 'recent',
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
language sql
security definer
set search_path = public
as $$
  select d.id, d.user_id, d.nickname, d.content, d.images,
         d.like_count,
         exists(select 1 from public.diary_likes l where l.diary_id = d.id and l.user_id = auth.uid()),
         (d.user_id = auth.uid()),
         d.created_at,
         (select count(*)::integer from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r
           where r.target_type = 'diary' and r.target_id = d.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.diary_comments c
           where c.diary_id = d.id and c.status = 'visible'),
         d.steps,
         d.video_url
  from public.diaries d
  where d.status = 'visible'
  order by
    case when p_sort = 'popular'
      then (select count(*) from public.reactions r
             where r.target_type = 'diary' and r.target_id = d.id)
    end desc nulls last,
    d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_diary_feed(text, integer, integer) from public;
grant execute on function public.get_diary_feed(text, integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3) 속 이야기 — create_board_post 영상 인자, 조회 3종에 video_url
-- ────────────────────────────────────────────────────────────────
drop function if exists public.create_board_post(text, text, text[], text);

create function public.create_board_post(
  p_category text,
  p_content  text,
  p_images   text[] default '{}',
  p_nickname text default null,
  p_video    text default null
)
returns table (post_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_claim record;
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;
  if p_category not in ('kids','spouse','parents','body','mind','living','chat') then
    return query select null::uuid, 0, '이야기 종류를 골라주세요'::text; return;
  end if;
  if p_content is null or length(btrim(p_content)) < 10 then
    return query select null::uuid, 0, '10자 이상 적어주세요'::text; return;
  end if;
  if length(p_content) > 2000 then
    return query select null::uuid, 0, '2000자 안으로 적어주세요'::text; return;
  end if;

  insert into public.board_posts (user_id, nickname, category, content, images, video_url)
  values (v_uid, p_nickname, p_category, btrim(p_content), coalesce(p_images, '{}'), nullif(btrim(coalesce(p_video, '')), ''))
  returning id into v_id;

  select * into v_claim from public.claim_mission('board_post', 1);
  return query select v_id, coalesce(v_claim.awarded, 0), ''::text;
end;
$$;

revoke all on function public.create_board_post(text, text, text[], text, text) from public;
grant execute on function public.create_board_post(text, text, text[], text, text) to authenticated;

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
  video_url text
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()),
         b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.video_url
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
  video_url text
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()),
         b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.video_url
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
  status text, video_url text
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         true, b.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         null::text,
         (select count(*)::integer from public.board_comments c where c.post_id = b.id and c.status = 'visible'),
         b.status, b.video_url
  from public.board_posts b
  where b.user_id = auth.uid()
  order by b.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_my_board_posts(integer, integer) from public;
grant execute on function public.get_my_board_posts(integer, integer) to authenticated;

notify pgrst, 'reload schema';
