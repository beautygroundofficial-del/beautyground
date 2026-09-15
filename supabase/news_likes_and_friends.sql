-- 새 소식에 하트(좋아요)·친구 신청 수락 추가 — 알림시스템 전수조사에서 발견된 구멍 2건 메움 (2026-09-16)
-- 배경: 09 업무일지/2026-09-16 알림시스템 전수조사.md
--
-- 1) 하트(diary_likes / board_likes / answer_likes)는 reactions 테이블과 별개라
--    get_my_news 의 UNION ALL 목록에서 통째로 빠져 있었다. 공감(reaction)과 완전히 같은 방식으로
--    다룬다 — 별도 이벤트 테이블에 insert하지 않고, 토글 테이블(내 글 + 남이 누름 + created_at)을
--    그대로 UNION ALL에 추가한다. 공감처럼 익명("누군가")으로 둔다(하트도 등수·정렬에 안 쓰는
--    가벼운 표시라는 점에서 reaction과 같은 성격 — LikeButton.tsx 주석 참고).
--
-- 2) 친구신청 수락은 respond_friend()·request_friend() 어느 쪽도 건드리지 않는다.
--    두 함수 모두 수락이 성립하면 friendships.status='accepted' + responded_at=now() 를 남기므로
--    그 컬럼을 읽는 UNION ALL 한 줄만 추가하면 두 경로(상대가 수락 / 맞신청으로 즉시 성립) 모두 잡힌다.
--    friends.sql 은 한 줄도 수정하지 않는다.
--
-- 반환 컬럼은 기존 get_my_news 와 완전히 같아 create or replace 로 충분(drop 불필요, 권한 유지).
-- ✅ 읽기 함수만 재정의 — 데이터 변경 없음.

create or replace function public.get_my_news(p_limit integer default 30)
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
    select 'board_like', 'board', b.id, null, null, left(b.content, 60), null, 'like', l.created_at
    from public.board_likes l join public.board_posts b on b.id = l.post_id
    where b.user_id = auth.uid() and l.user_id <> auth.uid()
    union all
    select 'diary_comment', 'diary', d.id, c.nickname, c.user_id, left(d.content, 60), c.content, null, c.created_at
    from public.diary_comments c join public.diaries d on d.id = c.diary_id
    where d.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
    union all
    select 'diary_reaction', 'diary', d.id, null, null, left(d.content, 60), null, r.kind, r.created_at
    from public.reactions r join public.diaries d on r.target_type = 'diary' and d.id = r.target_id
    where d.user_id = auth.uid() and r.user_id <> auth.uid()
    union all
    select 'diary_like', 'diary', d.id, null, null, left(d.content, 60), null, 'like', l.created_at
    from public.diary_likes l join public.diaries d on d.id = l.diary_id
    where d.user_id = auth.uid() and l.user_id <> auth.uid()
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
    union all
    select 'answer_like', 'answer', a.id, null, null,
           coalesce(nullif(left(a.content, 60), ''), '(사진)'), null, 'like', l.created_at
    from public.answer_likes l join public.daily_answers a on a.id = l.answer_id
    where a.user_id = auth.uid() and l.user_id <> auth.uid()
    union all
    select 'friend_accept', 'friend', f.addressee_id, public.display_name_of(f.addressee_id), f.addressee_id,
           ''::text, null, null, f.responded_at
    from public.friendships f
    where f.requester_id = auth.uid() and f.status = 'accepted' and f.responded_at is not null
  )
  select i.kind, i.target_type, i.target_id, i.actor_nickname, i.actor_user_id, i.excerpt, i.comment_text, i.reaction_kind,
         i.created_at, (i.created_at > seen.at)
  from items i, seen
  order by i.created_at desc
  limit greatest(p_limit, 1);
$$;
revoke all on function public.get_my_news(integer) from public;
grant execute on function public.get_my_news(integer) to authenticated;

notify pgrst, 'reload schema';
