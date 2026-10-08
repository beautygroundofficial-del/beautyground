-- 커뮤니티 댓글 차단 필터 재적용 (2026-10-08)
-- 배경: community_block_filter.sql(2026-09-28, 327d7f5)이 get_board_comments·get_diary_comments에
-- "차단한 사람 제외" 조건을 넣었지만, 다음날 community_comment_replies_likes.sql(2026-09-29, 48ec784)이
-- 답글·좋아요 기능을 추가하며 두 함수를 drop/create로 다시 만들면서 차단 필터가 빠졌다(운영 DB 조회로 확인).
-- 그 결과 차단한 사람의 댓글이 댓글 목록에서 계속 보이는 상태였다 — 이 파일로 필터만 되돌린다(그 외 동작 동일).
-- 실행: scripts/db_query.mjs 로 1회, 재실행 안전.

create or replace function public.get_board_comments(p_post_id uuid, p_limit integer default 50, p_offset integer default 0)
 returns table(id uuid, nickname text, content text, created_at timestamptz, is_mine boolean, parent_comment_id uuid, user_id uuid, like_count integer, liked_by_me boolean)
 language sql security definer set search_path to 'public'
as $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id, c.user_id,
         (select count(*)::integer from public.board_comment_likes l where l.comment_id = c.id),
         exists(select 1 from public.board_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid())
  from public.board_comments c
  where c.post_id = p_post_id and c.status = 'visible'
    and not public.is_blocked_by_me(c.user_id)
    and exists (select 1 from public.board_posts d where d.id = c.post_id and d.status = 'visible')
    and (c.parent_comment_id is null or exists (select 1 from public.board_comments parent where parent.id = c.parent_comment_id and parent.post_id = c.post_id and parent.status = 'visible'))
  order by
    coalesce(
      (select p.created_at from public.board_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;

create or replace function public.get_diary_comments(p_diary_id uuid, p_limit integer default 50, p_offset integer default 0)
 returns table(id uuid, nickname text, content text, created_at timestamptz, is_mine boolean, parent_comment_id uuid, user_id uuid, like_count integer, liked_by_me boolean)
 language sql security definer set search_path to 'public'
as $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id, c.user_id,
         (select count(*)::integer from public.diary_comment_likes l where l.comment_id = c.id),
         exists(select 1 from public.diary_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid())
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
    and not public.is_blocked_by_me(c.user_id)
  order by
    coalesce(
      (select p.created_at from public.diary_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc;
$function$;
