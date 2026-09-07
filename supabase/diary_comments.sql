-- 이야기 댓글 + 참여 적립 — 2026-09-07
--
-- 대표님 지시: "글쓴 사람에게 공감 및 좋아요 댓글 남겼을 시에 포인트 주는 이런 방식 어때?"
--             → "안전장치 및 어뷰징 안 터지게 하는 방향으로 가자"
--
-- ⚠️ daily_questions.sql 을 먼저 실행한 뒤 이 파일을 실행하세요(reactions·claim_mission 을 씁니다).
--
-- 어뷰징 방지 —
--   ① 자기 글에는 적립하지 않는다
--   ② 한 글에서는 평생 한 번만 적립한다(comment_awards, 지우지 않는 기록)
--   ③ 5자 미만은 적립하지 않는다("ㅇㅇ", "굿" 같은 도배 방지)
--   ④ 하루 총량은 missions.max_per_day 가 막는다
-- 미션(comment_give)을 등록하지 않으면 0P — 이 SQL만으로는 포인트가 나가지 않는다.
--
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1) diary_comments
-- ────────────────────────────────────────────────────────────────
create table if not exists public.diary_comments (
  id         uuid primary key default gen_random_uuid(),
  diary_id   uuid not null references public.diaries(id) on delete cascade,
  user_id    uuid not null,
  nickname   text,                                    -- 작성 시점 표시 이름(스냅샷)
  content    text not null,
  status     text not null default 'visible'
             check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.diary_comments is '이야기(일기) 댓글 — 남의 글에 처음 남길 때만 comment_give 적립';

create index if not exists idx_diary_comments_feed on public.diary_comments (diary_id, status, created_at);
create index if not exists idx_diary_comments_user on public.diary_comments (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────
-- 2) comment_awards — "이 글에서는 이미 적립받았다"는 영구 기록
--    댓글을 지웠다 다시 써서 반복 적립하는 것을 막는다. 지우지 않는다.
-- ────────────────────────────────────────────────────────────────
create table if not exists public.comment_awards (
  user_id    uuid not null,
  diary_id   uuid not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, diary_id)
);

-- ────────────────────────────────────────────────────────────────
-- 3) RLS
-- ────────────────────────────────────────────────────────────────
alter table public.diary_comments enable row level security;
alter table public.comment_awards enable row level security;

drop policy if exists diary_comments_public_read on public.diary_comments;
create policy diary_comments_public_read on public.diary_comments
  for select using (status = 'visible');

drop policy if exists diary_comments_own_all on public.diary_comments;
create policy diary_comments_own_all on public.diary_comments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists diary_comments_admin_all on public.diary_comments;
create policy diary_comments_admin_all on public.diary_comments
  for all using (public.is_admin()) with check (public.is_admin());

-- 적립 이력은 본인 것만 읽기, 쓰기는 열지 않는다(security definer 함수만 기록).
drop policy if exists comment_awards_own_read on public.comment_awards;
create policy comment_awards_own_read on public.comment_awards
  for select using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────
-- 4) 댓글 목록
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_diary_comments(
  p_diary_id uuid,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, nickname text, content text, created_at timestamptz, is_mine boolean
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid())
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
  order by c.created_at asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_diary_comments(uuid, integer, integer) from public;
grant execute on function public.get_diary_comments(uuid, integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5) 댓글 쓰기 + 적립
-- ────────────────────────────────────────────────────────────────
create or replace function public.create_diary_comment(
  p_diary_id uuid,
  p_content  text,
  p_nickname text default null
)
returns table (comment_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_id     uuid;
  v_author uuid;
  v_len    integer;
  v_claim  record;
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;

  v_len := length(btrim(coalesce(p_content, '')));
  if v_len = 0 then
    return query select null::uuid, 0, '댓글을 입력해 주세요'::text; return;
  end if;
  if v_len > 500 then
    return query select null::uuid, 0, '500자 안으로 적어주세요'::text; return;
  end if;

  select d.user_id into v_author from public.diaries d
   where d.id = p_diary_id and d.status = 'visible';
  if v_author is null then
    return query select null::uuid, 0, '이미 지워진 이야기예요'::text; return;
  end if;

  insert into public.diary_comments (diary_id, user_id, nickname, content)
  values (p_diary_id, v_uid, p_nickname, btrim(p_content))
  returning id into v_id;

  -- 적립 조건: 남의 글 + 5자 이상 + 이 글에서 아직 받은 적 없음
  if v_author <> v_uid and v_len >= 5
     and not exists (
       select 1 from public.comment_awards w
       where w.user_id = v_uid and w.diary_id = p_diary_id
     )
  then
    select * into v_claim from public.claim_mission('comment_give', 1);
    -- 하루 상한에 걸려 0P였다면 기록하지 않는다 — 내일 다시 받을 수 있어야 한다.
    if coalesce(v_claim.awarded, 0) > 0 then
      insert into public.comment_awards (user_id, diary_id) values (v_uid, p_diary_id)
      on conflict do nothing;
    end if;
  end if;

  return query select v_id, coalesce(v_claim.awarded, 0), ''::text;
end;
$$;

revoke all on function public.create_diary_comment(uuid, text, text) from public;
grant execute on function public.create_diary_comment(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6) 일기 피드에 댓글 수 얹기
--    ⚠️ 또 반환 컬럼이 늘어나므로 drop 후 재생성한다.
--       daily_questions.sql 의 9)번을 이미 실행했더라도, 이 파일을 실행하면 이 정의로 덮인다.
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
  comment_count integer
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
           where c.diary_id = d.id and c.status = 'visible')
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
-- 7) 사진을 넣은 이야기에 추가 적립 (diary_photo)
--    대표님 지시 "글을 쓰고 이미지를 올리면 제품 구매 포인트를 주고".
--    기존 diary_post(글 올리면) 위에 사진이 있을 때만 한 번 더 얹는다.
--    ⚠️ 반환 컬럼은 그대로라 replace 로 충분하다.
-- ────────────────────────────────────────────────────────────────
create or replace function public.create_diary(
  p_content text,
  p_images  text[] default '{}',
  p_nickname text default null
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
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;
  if p_content is null or length(btrim(p_content)) < 5 then
    return query select null::uuid, 0, '내용을 5자 이상 입력해 주세요'::text; return;
  end if;

  insert into public.diaries (user_id, nickname, content, images)
  values (v_uid, p_nickname, btrim(p_content), coalesce(p_images, '{}'))
  returning id into v_id;

  select * into v_claim from public.claim_mission('diary_post', 1);
  v_total := coalesce(v_claim.awarded, 0);

  -- 사진을 실제로 넣었을 때만 추가 적립
  if coalesce(array_length(p_images, 1), 0) > 0 then
    select * into v_photo from public.claim_mission('diary_photo', 1);
    v_total := v_total + coalesce(v_photo.awarded, 0);
  end if;

  return query select v_id, v_total, coalesce(v_claim.message, '')::text;
end;
$$;

revoke all on function public.create_diary(text, text[], text) from public;
grant execute on function public.create_diary(text, text[], text) to authenticated;

notify pgrst, 'reload schema';
