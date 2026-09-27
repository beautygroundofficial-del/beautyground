-- Community conversation integration, 2026-09-27. Review before production execution.
-- Existing posts, point rules and friendship records are preserved. No DROP or data rewrite.
begin;

CREATE OR REPLACE FUNCTION public.get_community_diary(p_diary_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, nickname text, content text, images text[], like_count integer, liked_by_me boolean, is_mine boolean, created_at timestamp with time zone, pat integer, same integer, cheer integer, my_kind text, comment_count integer, steps integer, video_url text, pets jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.user_id, d.nickname, d.content, d.images,
         d.like_count,
         exists(select 1 from public.diary_likes l where l.diary_id = d.id and l.user_id = auth.uid()),
         (d.user_id = auth.uid()),
         d.created_at,
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'diary' and r.target_id = d.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.diary_comments c where c.diary_id = d.id and c.status = 'visible' and (c.parent_comment_id is null or exists (select 1 from public.diary_comments parent where parent.id = c.parent_comment_id and parent.diary_id = c.diary_id and parent.status = 'visible'))),
         d.steps,
         d.video_url,
         coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'kind', p.kind, 'photo_url', p.photo_url) order by p.created_at)
                   from public.pets p where p.id = any(d.pet_ids)), '[]'::jsonb)
  from public.diaries d
  where d.status = 'visible' and d.id = p_diary_id;
$function$;
revoke all on function public.get_community_diary(uuid) from public;
grant execute on function public.get_community_diary(uuid) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_community_answer(p_answer_id uuid)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean, pat integer, same integer, cheer integer, my_kind text, images text[], like_count integer, liked_by_me boolean, comment_count integer, question_id uuid, question text, hint text, ask_date date)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select a.id, a.nickname, a.content, a.created_at,
         (a.user_id = auth.uid()),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r where r.target_type = 'answer' and r.target_id = a.id and r.user_id = auth.uid()),
         a.images,
         (select count(*)::integer from public.answer_likes l where l.answer_id = a.id),
         exists(select 1 from public.answer_likes l where l.answer_id = a.id and l.user_id = auth.uid()),
         (select count(*)::integer from public.answer_comments c where c.answer_id = a.id and c.status = 'visible'),
         q.id, q.question, q.hint, q.ask_date
  from public.daily_answers a join public.daily_questions q on q.id = a.question_id
  where a.id = p_answer_id and a.status = 'visible' and q.status = 'published';
$function$;
revoke all on function public.get_community_answer(uuid) from public;
grant execute on function public.get_community_answer(uuid) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_diary_comments(p_diary_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean, parent_comment_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
    and exists (select 1 from public.diaries d where d.id = c.diary_id and d.status = 'visible')
    and (c.parent_comment_id is null or exists (select 1 from public.diary_comments parent where parent.id = c.parent_comment_id and parent.diary_id = c.diary_id and parent.status = 'visible'))
  order by
    coalesce(
      (select p.created_at from public.diary_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;
revoke all on function public.get_diary_comments(uuid, integer, integer) from public;
grant execute on function public.get_diary_comments(uuid, integer, integer) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_diary_comment_thread(p_diary_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean, parent_comment_id uuid, user_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id, c.user_id
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
    and exists (select 1 from public.diaries d where d.id = c.diary_id and d.status = 'visible')
    and (c.parent_comment_id is null or exists (select 1 from public.diary_comments parent where parent.id = c.parent_comment_id and parent.diary_id = c.diary_id and parent.status = 'visible'))
  order by
    coalesce(
      (select p.created_at from public.diary_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;
revoke all on function public.get_diary_comment_thread(uuid, integer, integer) from public;
grant execute on function public.get_diary_comment_thread(uuid, integer, integer) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_board_comments(p_post_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid())
  from public.board_comments c
  where c.post_id = p_post_id and c.status = 'visible'
    and exists (select 1 from public.board_posts d where d.id = c.post_id and d.status = 'visible')
  order by c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;
revoke all on function public.get_board_comments(uuid, integer, integer) from public;
grant execute on function public.get_board_comments(uuid, integer, integer) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_answer_comments(p_answer_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, nickname text, content text, created_at timestamp with time zone, is_mine boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid())
  from public.answer_comments c
  where c.answer_id = p_answer_id and c.status = 'visible'
    and exists (select 1 from public.daily_answers d where d.id = c.answer_id and d.status = 'visible' and exists (select 1 from public.daily_questions q where q.id = d.question_id and q.status = 'published'))
  order by c.created_at asc, c.id asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$function$;
revoke all on function public.get_answer_comments(uuid, integer, integer) from public;
grant execute on function public.get_answer_comments(uuid, integer, integer) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_community_news(p_limit integer DEFAULT 50)
RETURNS TABLE(kind text, target_type text, target_id uuid, actor_nickname text, actor_user_id uuid,
 excerpt text, comment_text text, reaction_kind text, created_at timestamptz, is_new boolean, comment_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
 with seen as (
   select coalesce((select s.seen_at from public.news_seen s where s.user_id=auth.uid()), 'epoch'::timestamptz) as at
 ), items as (
   select 'board_comment'::text as kind, 'board'::text as target_type, b.id as target_id,
     c.nickname as actor_nickname, null::uuid as actor_user_id, left(b.content,60) as excerpt,
     c.content as comment_text, null::text as reaction_kind, c.created_at, c.id as comment_id
   from public.board_comments c join public.board_posts b on b.id=c.post_id
   where b.user_id=auth.uid() and c.user_id<>auth.uid() and c.status='visible' and b.status='visible'
   union all
   select case when parent.user_id=auth.uid() then 'diary_reply' else 'diary_comment' end,
     'diary', d.id, c.nickname, c.user_id, left(d.content,60), c.content, null, c.created_at, c.id
   from public.diary_comments c join public.diaries d on d.id=c.diary_id
   left join public.diary_comments parent on parent.id=c.parent_comment_id and parent.diary_id=c.diary_id
   where (d.user_id=auth.uid() or parent.user_id=auth.uid()) and c.user_id<>auth.uid()
     and c.status='visible' and d.status='visible'
     and (c.parent_comment_id is null or parent.status='visible')
   union all
   select 'answer_comment', 'answer', a.id, c.nickname, null, coalesce(nullif(left(a.content,60),''),'(사진)'),
     c.content, null, c.created_at, c.id
   from public.answer_comments c join public.daily_answers a on a.id=c.answer_id
   join public.daily_questions q on q.id=a.question_id
   where a.user_id=auth.uid() and c.user_id<>auth.uid() and c.status='visible' and a.status='visible' and q.status='published'
   union all
   select 'board_reaction','board',b.id,null,null,left(b.content,60),null,r.kind,r.created_at,null
   from public.reactions r join public.board_posts b on r.target_type='board' and b.id=r.target_id
   where b.user_id=auth.uid() and r.user_id<>auth.uid() and b.status='visible'
   union all
   select 'diary_reaction','diary',d.id,null,null,left(d.content,60),null,r.kind,r.created_at,null
   from public.reactions r join public.diaries d on r.target_type='diary' and d.id=r.target_id
   where d.user_id=auth.uid() and r.user_id<>auth.uid() and d.status='visible'
   union all
   select 'answer_reaction','answer',a.id,null,null,left(a.content,60),null,r.kind,r.created_at,null
   from public.reactions r join public.daily_answers a on r.target_type='answer' and a.id=r.target_id
   join public.daily_questions q on q.id=a.question_id
   where a.user_id=auth.uid() and r.user_id<>auth.uid() and a.status='visible' and q.status='published'
   union all
   select 'board_like','board',b.id,null,null,left(b.content,60),null,'like',l.created_at,null
   from public.board_likes l join public.board_posts b on b.id=l.post_id
   where b.user_id=auth.uid() and l.user_id<>auth.uid() and b.status='visible'
   union all
   select 'diary_like','diary',d.id,null,null,left(d.content,60),null,'like',l.created_at,null
   from public.diary_likes l join public.diaries d on d.id=l.diary_id
   where d.user_id=auth.uid() and l.user_id<>auth.uid() and d.status='visible'
   union all
   select 'answer_like','answer',a.id,null,null,left(a.content,60),null,'like',l.created_at,null
   from public.answer_likes l join public.daily_answers a on a.id=l.answer_id
   join public.daily_questions q on q.id=a.question_id
   where a.user_id=auth.uid() and l.user_id<>auth.uid() and a.status='visible' and q.status='published'
   union all
   select 'friend_request','friend',f.requester_id,public.display_name_of(f.requester_id),f.requester_id,
     '',null,null,f.created_at,null
   from public.friendships f where f.addressee_id=auth.uid() and f.status='pending'
   union all
   select 'friend_accept','friend',f.addressee_id,public.display_name_of(f.addressee_id),f.addressee_id,
     '',null,null,f.responded_at,null
   from public.friendships f where f.requester_id=auth.uid() and f.status='accepted' and f.responded_at is not null
 )
 select i.kind,i.target_type,i.target_id,i.actor_nickname,i.actor_user_id,i.excerpt,i.comment_text,i.reaction_kind,
   i.created_at,(i.created_at>seen.at),i.comment_id
 from items i cross join seen where auth.uid() is not null
 order by i.created_at desc,i.target_id,i.comment_id nulls last,i.kind
 limit least(greatest(p_limit,1),500);
$function$;
revoke all on function public.get_community_news(integer) from public;
grant execute on function public.get_community_news(integer) to authenticated;

CREATE OR REPLACE FUNCTION public.get_my_news(p_limit integer DEFAULT 30)
 RETURNS TABLE(kind text, target_type text, target_id uuid, actor_nickname text, actor_user_id uuid, excerpt text, comment_text text, reaction_kind text, created_at timestamp with time zone, is_new boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select n.kind,n.target_type,n.target_id,n.actor_nickname,n.actor_user_id,n.excerpt,n.comment_text,n.reaction_kind,n.created_at,n.is_new
 from public.get_community_news(p_limit) n;
$function$;
revoke all on function public.get_my_news(integer) from public;
grant execute on function public.get_my_news(integer) to authenticated;

CREATE OR REPLACE FUNCTION public.mark_community_news_seen(p_seen_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
 insert into public.news_seen(user_id,seen_at)
 select auth.uid(),least(p_seen_at,now()) where auth.uid() is not null and p_seen_at is not null
 on conflict(user_id) do update set seen_at=greatest(public.news_seen.seen_at,excluded.seen_at);
$function$;
revoke all on function public.mark_community_news_seen(timestamptz) from public;
grant execute on function public.mark_community_news_seen(timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
