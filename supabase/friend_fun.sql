-- 친구끼리 재미 요소 1단계 — 2026-10-14 (대표님 "권장순서대로 진행")
--   ① 토닥 보내기 : 친구에게만, 같은 친구에게 하루 한 번. 받은 사람 소식에 "○○님이 토닥였어요"
--   ② 친구 새 글 소식 : 친구가 최근 3일 안에 남긴 하루 이야기를 소식에 표시(받기/끄기는 본인이 선택, 기본 켜짐)
-- 원칙: 순위·숫자 비교·압박 장치 없음. 포인트 없음. 차단한 사람과는 어느 방향이든 보이지 않는다.
-- 기존 소식 항목은 그대로 두고 두 종류만 덧붙인다 — get_community_news 는 운영 DB 정의(2026-10-14 조회)를
-- 그대로 복사해 끝에 두 항목만 추가했다.
-- 운영 DB 실행: 내용 보고 → 대표님 승인 → 실행(scripts/db_query.mjs). 되돌리기: 맨 아래 롤백 주석 참고.

begin;

-- 1) 토닥
create table if not exists public.friend_pats (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  day        date not null default (timezone('Asia/Seoul', now()))::date,
  created_at timestamptz not null default now(),
  check (from_id <> to_id),
  unique (from_id, to_id, day)
);
create index if not exists idx_friend_pats_to on public.friend_pats (to_id, created_at desc);
alter table public.friend_pats enable row level security;
revoke all on public.friend_pats from anon, authenticated;

create or replace function public.send_friend_pat(p_user_id uuid)
returns table (status text, message text)
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n integer;
begin
  if me is null then return query select 'login'::text, '로그인이 필요해요'::text; return; end if;
  if p_user_id is null or p_user_id = me then return query select 'error'::text, '나에게는 보낼 수 없어요'::text; return; end if;
  if not public.are_friends(me, p_user_id) then return query select 'not_friend'::text, '친구에게만 토닥일 수 있어요'::text; return; end if;
  if exists (select 1 from public.user_blocks b
             where (b.blocker_id = me and b.blocked_id = p_user_id) or (b.blocker_id = p_user_id and b.blocked_id = me)) then
    return query select 'blocked'::text, '지금은 보낼 수 없어요'::text; return;
  end if;
  insert into public.friend_pats (from_id, to_id) values (me, p_user_id) on conflict (from_id, to_id, day) do nothing;
  get diagnostics n = row_count;
  if n = 0 then return query select 'already'::text, '오늘은 이미 토닥였어요'::text;
  else return query select 'sent'::text, '토닥였어요'::text; end if;
end;
$$;
revoke all on function public.send_friend_pat(uuid) from public, anon;
grant execute on function public.send_friend_pat(uuid) to authenticated;

-- 오늘 내가 이미 토닥인 친구들 (버튼 상태 표시용)
create or replace function public.get_pats_sent_today(p_user_ids uuid[])
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct p.to_id from public.friend_pats p
  where p.from_id = auth.uid() and p.day = (timezone('Asia/Seoul', now()))::date
    and p.to_id = any(coalesce(p_user_ids, '{}'::uuid[]));
$$;
revoke all on function public.get_pats_sent_today(uuid[]) from public, anon;
grant execute on function public.get_pats_sent_today(uuid[]) to authenticated;

-- 2) 친구 새 글 소식 받기/끄기 (본인 선택, 기본 켜짐)
alter table public.news_seen add column if not exists friend_posts boolean not null default true;

create or replace function public.get_friend_post_news()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select s.friend_posts from public.news_seen s where s.user_id = auth.uid()), true);
$$;
revoke all on function public.get_friend_post_news() from public, anon;
grant execute on function public.get_friend_post_news() to authenticated;

create or replace function public.set_friend_post_news(p_on boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.news_seen (user_id, seen_at, friend_posts)
  select auth.uid(), 'epoch'::timestamptz, coalesce(p_on, true) where auth.uid() is not null
  on conflict (user_id) do update set friend_posts = excluded.friend_posts;
$$;
revoke all on function public.set_friend_post_news(boolean) from public, anon;
grant execute on function public.set_friend_post_news(boolean) to authenticated;

-- 3) 소식 목록: 기존 정의 + friend_pat · friend_post 두 종류
CREATE OR REPLACE FUNCTION public.get_community_news(p_limit integer DEFAULT 50)
 RETURNS TABLE(kind text, target_type text, target_id uuid, actor_nickname text, actor_user_id uuid, excerpt text, comment_text text, reaction_kind text, created_at timestamp with time zone, is_new boolean, comment_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
   union all
   -- [친구 토닥] 친구가 나에게 보낸 토닥 (친구 관계가 유지되고 차단하지 않았을 때만)
   select 'friend_pat','friend',p.from_id,public.display_name_of(p.from_id),p.from_id,
     '',null,null,p.created_at,null
   from public.friend_pats p
   where p.to_id=auth.uid() and public.are_friends(auth.uid(),p.from_id)
     and not exists (select 1 from public.user_blocks b
       where (b.blocker_id=auth.uid() and b.blocked_id=p.from_id) or (b.blocker_id=p.from_id and b.blocked_id=auth.uid()))
   union all
   -- [친구 새 글] 친구가 최근 3일 안에 남긴 하루 이야기 (내가 끄지 않았을 때만, 차단 제외)
   select 'friend_post','diary',d.id,public.display_name_of(d.user_id),d.user_id,
     left(d.content,60),null,null,d.created_at,null
   from public.diaries d
   where d.status='visible' and d.user_id<>auth.uid()
     and d.created_at > now() - interval '3 days'
     and coalesce((select s.friend_posts from public.news_seen s where s.user_id=auth.uid()), true)
     and public.are_friends(auth.uid(),d.user_id)
     and not exists (select 1 from public.user_blocks b
       where (b.blocker_id=auth.uid() and b.blocked_id=d.user_id) or (b.blocker_id=d.user_id and b.blocked_id=auth.uid()))
 )
 select i.kind,i.target_type,i.target_id,i.actor_nickname,i.actor_user_id,i.excerpt,i.comment_text,i.reaction_kind,
   i.created_at,(i.created_at>seen.at),i.comment_id
 from items i cross join seen where auth.uid() is not null
 order by i.created_at desc,i.target_id,i.comment_id nulls last,i.kind
 limit least(greatest(p_limit,1),500);
$function$;

revoke all on function public.get_community_news(integer) from public, anon;
grant execute on function public.get_community_news(integer) to authenticated;

notify pgrst, 'reload schema';
commit;

-- 롤백(문제가 생기면):
--   1) supabase/community_conversation_integration.sql 의 get_community_news 정의로 되돌려 create or replace 실행
--   2) drop function public.send_friend_pat(uuid), public.get_pats_sent_today(uuid[]),
--      public.get_friend_post_news(), public.set_friend_post_news(boolean);
--   3) drop table public.friend_pats;  alter table public.news_seen drop column friend_posts;
