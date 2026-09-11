-- 그 사람의 이야기 페이지 — 2026-09-12 대표님 "페이지와 페이지가 연결되어야 하고"(커뮤니티 로드맵 4-10 A1)
--   · get_user_profile(p_user_id) — 표시 이름·하루 이야기 수·첫 글 시점·펫 목록
--   · get_user_diary_feed(p_user_id, …) — 그 사람의 하루 이야기(get_diary_feed 와 같은 모양)
--   속 이야기(익명 게시판)는 이 페이지에 안 나온다 — 익명 보호.
--   표시 이름은 그 사람 글의 닉네임 스냅샷(비로그인도 봄) → 가리는 건 화면에서(친구면 그대로).
-- ✅ 2026-09-12 대표님 "이어가 → 배포하고 → 저장하고" 지시로 db_query.mjs 실행 완료(읽기 함수 2개, 데이터 변경 없음). test3 로 검증.

create or replace function public.get_user_profile(p_user_id uuid)
returns table (
  user_id uuid, nickname text, diary_count integer, since timestamptz, pets jsonb, is_me boolean
)
language sql stable security definer set search_path = public as $$
  select p_user_id,
         coalesce(
           (select d.nickname from public.diaries d where d.user_id = p_user_id and d.status = 'visible' and d.nickname is not null order by d.created_at desc limit 1),
           case when auth.uid() is not null then public.display_name_of(p_user_id) else null end
         ),
         (select count(*)::integer from public.diaries d where d.user_id = p_user_id and d.status = 'visible'),
         (select min(d.created_at) from public.diaries d where d.user_id = p_user_id and d.status = 'visible'),
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'photo_url', p.photo_url) order by p.created_at)
                   from public.pets p where p.user_id = p_user_id), '[]'::jsonb),
         (auth.uid() = p_user_id)
  where exists (select 1 from auth.users u where u.id = p_user_id);
$$;
revoke all on function public.get_user_profile(uuid) from public;
grant execute on function public.get_user_profile(uuid) to anon, authenticated;

create or replace function public.get_user_diary_feed(
  p_user_id uuid,
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
  where d.status = 'visible' and d.user_id = p_user_id
  order by d.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
revoke all on function public.get_user_diary_feed(uuid, integer, integer) from public;
grant execute on function public.get_user_diary_feed(uuid, integer, integer) to anon, authenticated;

notify pgrst, 'reload schema';
