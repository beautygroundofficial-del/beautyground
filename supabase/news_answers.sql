-- 새 소식에 오늘의 질문 답변 소식 추가 — 2026-09-11
-- 내 답에 달린 댓글(answer_comments)·공감(reactions target 'answer')을 하루·속 이야기 소식과 같이 모은다.
-- get_my_news 만 다시 만든다(반환 컬럼 동일 → create or replace). 하트는 기존과 같이 새 소식에 넣지 않는다(재촉 방지).
-- ✅ 2026-09-11 대표님이 직접 SQL Editor(beautyground-main)에 붙여 실행("런했어"). 두 계정으로 새 소식에 답변 댓글·공감 뜨는 것 확인.

create or replace function public.get_my_news(p_limit integer default 30)
returns table (
  kind text,            -- board_comment | board_reaction | diary_comment | diary_reaction | answer_comment | answer_reaction
  target_type text,     -- board | diary | answer
  target_id uuid,
  actor_nickname text,
  excerpt text,
  comment_text text,
  reaction_kind text,
  created_at timestamptz,
  is_new boolean
)
language sql
security definer
set search_path = public
as $$
  with seen as (
    select coalesce((select s.seen_at from public.news_seen s where s.user_id = auth.uid()), 'epoch'::timestamptz) as at
  ),
  items as (
    select 'board_comment'::text as kind, 'board'::text as target_type, b.id as target_id,
           c.nickname as actor_nickname, left(b.content, 60) as excerpt, c.content as comment_text,
           null::text as reaction_kind, c.created_at
    from public.board_comments c
    join public.board_posts b on b.id = c.post_id
    where b.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'board_reaction', 'board', b.id, null, left(b.content, 60), null, r.kind, r.created_at
    from public.reactions r
    join public.board_posts b on r.target_type = 'board' and b.id = r.target_id
    where b.user_id = auth.uid() and r.user_id <> auth.uid()
    union all
    select 'diary_comment', 'diary', d.id, c.nickname, left(d.content, 60), c.content, null, c.created_at
    from public.diary_comments c
    join public.diaries d on d.id = c.diary_id
    where d.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'diary_reaction', 'diary', d.id, null, left(d.content, 60), null, r.kind, r.created_at
    from public.reactions r
    join public.diaries d on r.target_type = 'diary' and d.id = r.target_id
    where d.user_id = auth.uid() and r.user_id <> auth.uid()
    union all
    -- 오늘의 질문 답변 — 사진만 있는 답은 본문이 비어 있어 "(사진)"으로 보여준다
    select 'answer_comment', 'answer', a.id, c.nickname,
           coalesce(nullif(left(a.content, 60), ''), '(사진)'), c.content, null, c.created_at
    from public.answer_comments c
    join public.daily_answers a on a.id = c.answer_id
    where a.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'answer_reaction', 'answer', a.id, null,
           coalesce(nullif(left(a.content, 60), ''), '(사진)'), null, r.kind, r.created_at
    from public.reactions r
    join public.daily_answers a on r.target_type = 'answer' and a.id = r.target_id
    where a.user_id = auth.uid() and r.user_id <> auth.uid()
  )
  select i.kind, i.target_type, i.target_id, i.actor_nickname, i.excerpt, i.comment_text, i.reaction_kind,
         i.created_at, (i.created_at > seen.at)
  from items i, seen
  order by i.created_at desc
  limit greatest(p_limit, 1);
$$;

revoke all on function public.get_my_news(integer) from public;
grant execute on function public.get_my_news(integer) to authenticated;

notify pgrst, 'reload schema';
