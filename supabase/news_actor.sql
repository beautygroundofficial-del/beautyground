-- 새 소식에 댓글 단 사람의 user_id 추가 — 이름을 누르면 그 사람 페이지로 (2026-09-12, 커뮤니티 4-10 A 마무리)
-- 공감(reaction)은 원래 익명("누군가")이라 actor_user_id 를 null 로 둔다.
-- get_my_news 반환 컬럼이 늘어 drop 후 재생성 — get_my_news_count 는 이 함수를 부르므로 같이 다시 만든다.
-- ✅ 읽기 함수만, 데이터 변경 없음.

drop function if exists public.get_my_news_count();
drop function if exists public.get_my_news(integer);
create function public.get_my_news(p_limit integer default 30)
returns table (
  kind text, target_type text, target_id uuid,
  actor_nickname text, actor_user_id uuid,
  excerpt text, comment_text text, reaction_kind text,
  created_at timestamptz, is_new boolean
)
language sql security definer set search_path = public as $$
  with seen as (
    select coalesce((select s.seen_at from public.news_seen s where s.user_id = auth.uid()), 'epoch'::timestamptz) as at
  ),
  items as (
    select 'board_comment'::text as kind, 'board'::text as target_type, b.id as target_id,
           c.nickname as actor_nickname, c.user_id as actor_user_id, left(b.content, 60) as excerpt, c.content as comment_text,
           null::text as reaction_kind, c.created_at
    from public.board_comments c join public.board_posts b on b.id = c.post_id
    where b.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'board_reaction', 'board', b.id, null, null, left(b.content, 60), null, r.kind, r.created_at
    from public.reactions r join public.board_posts b on r.target_type = 'board' and b.id = r.target_id
    where b.user_id = auth.uid() and r.user_id <> auth.uid()
    union all
    select 'diary_comment', 'diary', d.id, c.nickname, c.user_id, left(d.content, 60), c.content, null, c.created_at
    from public.diary_comments c join public.diaries d on d.id = c.diary_id
    where d.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'diary_reaction', 'diary', d.id, null, null, left(d.content, 60), null, r.kind, r.created_at
    from public.reactions r join public.diaries d on r.target_type = 'diary' and d.id = r.target_id
    where d.user_id = auth.uid() and r.user_id <> auth.uid()
    union all
    select 'answer_comment', 'answer', a.id, c.nickname, c.user_id,
           coalesce(nullif(left(a.content, 60), ''), '(사진)'), c.content, null, c.created_at
    from public.answer_comments c join public.daily_answers a on a.id = c.answer_id
    where a.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'answer_reaction', 'answer', a.id, null, null,
           coalesce(nullif(left(a.content, 60), ''), '(사진)'), null, r.kind, r.created_at
    from public.reactions r join public.daily_answers a on r.target_type = 'answer' and a.id = r.target_id
    where a.user_id = auth.uid() and r.user_id <> auth.uid()
  )
  select i.kind, i.target_type, i.target_id, i.actor_nickname, i.actor_user_id, i.excerpt, i.comment_text, i.reaction_kind,
         i.created_at, (i.created_at > seen.at)
  from items i, seen
  order by i.created_at desc
  limit greatest(p_limit, 1);
$$;
revoke all on function public.get_my_news(integer) from public;
grant execute on function public.get_my_news(integer) to authenticated;

create function public.get_my_news_count()
returns integer
language sql security definer set search_path = public as $$
  select count(*)::integer from public.get_my_news(100) n where n.is_new;
$$;
revoke all on function public.get_my_news_count() from public;
grant execute on function public.get_my_news_count() to authenticated;

notify pgrst, 'reload schema';
