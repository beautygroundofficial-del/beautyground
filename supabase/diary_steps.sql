-- 하루 이야기에 걸음 수 — 2026-09-11
-- 대표님 지시: "걷기를 통한 하루 일기" — 글·사진과 함께 오늘 걸은 걸음 수를 남긴다.
-- 지금은 웹이라 직접 적는다(선택). 네이티브 앱(헬스킷·헬스커넥트) 전환 후 자동으로 채워진다.
-- 포인트와 무관하다 — 걷기 미션(walk_daily)은 앱 전환 후 별도(직접 적은 숫자로 적립하지 않는다).
-- ⚠️ diary_comments.sql 이후에 실행(get_diary_feed 최신 정의를 덮는다).
-- 실행: Supabase 대시보드(beautyground-main, bjqtuklkskrqzbuxdwxm) → SQL Editor

alter table public.diaries add column if not exists steps integer
  check (steps is null or (steps >= 0 and steps <= 200000));

comment on column public.diaries.steps is '오늘 걸음 수(선택). 웹에선 직접 입력, 앱 전환 후 자동. 적립 근거로 쓰지 않음';

-- ────────────────────────────────────────────────────────────────
-- create_diary — 걸음 수 인자 추가. 기존 3인자 버전은 지운다(이름 겹침 방지).
-- ────────────────────────────────────────────────────────────────
drop function if exists public.create_diary(text, text[], text);

create function public.create_diary(
  p_content  text,
  p_images   text[] default '{}',
  p_nickname text default null,
  p_steps    integer default null
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

  insert into public.diaries (user_id, nickname, content, images, steps)
  values (v_uid, p_nickname, btrim(p_content), coalesce(p_images, '{}'), v_steps)
  returning id into v_id;

  select * into v_claim from public.claim_mission('diary_post', 1);
  v_total := coalesce(v_claim.awarded, 0);

  if coalesce(array_length(p_images, 1), 0) > 0 then
    select * into v_photo from public.claim_mission('diary_photo', 1);
    v_total := v_total + coalesce(v_photo.awarded, 0);
  end if;

  return query select v_id, v_total, coalesce(v_claim.message, '')::text;
end;
$$;

revoke all on function public.create_diary(text, text[], text, integer) from public;
grant execute on function public.create_diary(text, text[], text, integer) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- get_diary_feed — steps 컬럼 추가(반환 컬럼이 늘어 drop 후 재생성)
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
  steps integer
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
         d.steps
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

notify pgrst, 'reload schema';
