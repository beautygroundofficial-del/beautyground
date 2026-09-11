-- 펫 프로필 + "오늘 같이 걸은 친구" — 2026-09-12 대표님 "펫과 같이 걷고 이미지 올리길 장려", "우리 앱에 펫도 강조"
--
--   · pets — 내 반려동물(이름·종류·사진). 누구나 읽을 수 있어야 카드에 펫 얼굴이 보인다. 쓰기는 본인만.
--   · diaries.pet_ids — 그 글에서 같이 걸은 펫들. create_diary 에 p_pet_ids 추가(고쳐 쓰기는 RLS 로 직접 update).
--   · get_diary_feed / get_friend_diary_feed — pets(jsonb 배열)·pet_walk(boolean) 반환 추가. 반환 컬럼이 늘어 drop 후 재생성.
--   포인트는 아직 안 건드린다(대표님이 값 정하면 missions 에 등록).
-- ⚠️ 실행 전 대표님 승인 필요. 실행: node scripts/db_query.mjs supabase/pets.sql 또는 SQL Editor

-- 1) 펫
create table if not exists public.pets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 20),
  kind       text not null default 'dog' check (kind in ('dog', 'cat', 'other')),
  photo_url  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pets_user on public.pets (user_id, created_at);

alter table public.pets enable row level security;
drop policy if exists pets_public_read on public.pets;
create policy pets_public_read on public.pets for select using (true);
drop policy if exists pets_own_write on public.pets;
create policy pets_own_write on public.pets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) 글에 같이 걸은 펫
alter table public.diaries add column if not exists pet_ids uuid[] not null default '{}';

-- 3) 쓰기 — p_pet_ids 추가. 내 펫이 아닌 id 는 버린다. 사진이 없으면 펫 태그도 비운다(사진 올리기 장려).
drop function if exists public.create_diary(text, text[], text, integer, text);
create function public.create_diary(
  p_content  text,
  p_images   text[] default '{}',
  p_nickname text default null,
  p_steps    integer default null,
  p_video    text default null,
  p_pet_ids  uuid[] default null
)
returns table (diary_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_claim   record;
  v_awarded integer := 0;
  v_photo   record;
  v_steps   integer := case when p_steps is null or p_steps <= 0 then null else least(p_steps, 200000) end;
  v_pets    uuid[] := '{}';
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;
  if p_content is null or length(btrim(p_content)) < 5 then
    return query select null::uuid, 0, '5자 이상 적어주세요'::text; return;
  end if;
  if length(btrim(p_content)) > 1000 then
    return query select null::uuid, 0, '1000자 안으로 적어주세요'::text; return;
  end if;

  if coalesce(array_length(p_images, 1), 0) > 0 and coalesce(array_length(p_pet_ids, 1), 0) > 0 then
    select coalesce(array_agg(p.id), '{}') into v_pets
    from public.pets p where p.user_id = v_uid and p.id = any(p_pet_ids);
  end if;

  insert into public.diaries (user_id, nickname, content, images, steps, video_url, pet_ids)
  values (v_uid, p_nickname, btrim(p_content), coalesce(p_images, '{}'), v_steps, nullif(btrim(coalesce(p_video, '')), ''), v_pets)
  returning id into v_id;

  select * into v_claim from public.claim_mission('diary_post', 1);
  v_awarded := coalesce(v_claim.awarded, 0);
  if coalesce(array_length(p_images, 1), 0) > 0 then
    select * into v_photo from public.claim_mission('diary_photo', 1);
    v_awarded := v_awarded + coalesce(v_photo.awarded, 0);
  end if;

  return query select v_id, v_awarded, ''::text;
end;
$$;
revoke all on function public.create_diary(text, text[], text, integer, text, uuid[]) from public;
grant execute on function public.create_diary(text, text[], text, integer, text, uuid[]) to authenticated;

-- 4) 피드 — pets(jsonb: [{id,name,kind,photo_url}]) 추가
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
  video_url text,
  pets jsonb
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
         d.video_url,
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'photo_url', p.photo_url) order by p.created_at)
                   from public.pets p where p.id = any(d.pet_ids)), '[]'::jsonb)
  from public.diaries d
  where d.status = 'visible'
    and (p_sort <> 'walk' or coalesce(array_length(d.pet_ids, 1), 0) > 0)
  order by
    case when p_sort = 'popular'
      then (select count(*) from public.reactions r where r.target_type = 'diary' and r.target_id = d.id)
    end desc nulls last,
    d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_diary_feed(text, integer, integer) from public;
grant execute on function public.get_diary_feed(text, integer, integer) to anon, authenticated;

drop function if exists public.get_friend_diary_feed(integer, integer);
create function public.get_friend_diary_feed(
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, nickname text, content text, images text[],
  like_count integer, liked_by_me boolean, is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text,
  comment_count integer,
  steps integer,
  video_url text,
  pets jsonb
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
         d.video_url,
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'photo_url', p.photo_url) order by p.created_at)
                   from public.pets p where p.id = any(d.pet_ids)), '[]'::jsonb)
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
