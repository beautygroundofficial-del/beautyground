-- 이야기 댓글에 답글(대댓글) 추가 — 2026-09-16
--
-- 배경: 알림시스템 전수조사에서 "대댓글 기능 자체가 없음" 확인. 기존 diary_comments(1단계 댓글)에
-- parent_comment_id 만 얹어 2단계(댓글 → 답글)까지 지원한다. 답글의 답글(3단계)은 지원하지 않는다
-- — 프론트에서 답글에는 "답글" 버튼을 아예 안 보여주고, RPC 에서도 한 번 더 막는다.
--
-- ⚠️ diary_comments.sql 을 먼저 실행한 뒤 이 파일을 실행하세요.
-- ⚠️ 알림(새 소식) 연동은 넣지 않았다 — news_actor.sql 은 다른 세션이 동시에 손대고 있어
--    충돌을 피하려고 여기서는 건드리지 않는다. get_my_news 에 'diary_comment_reply' kind를
--    추가하는 건 별도 작업(아래 맨 아래 주석 참고).
--
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1) parent_comment_id — null 이면 1단계 댓글, 값 있으면 그 댓글의 답글
-- ────────────────────────────────────────────────────────────────
alter table public.diary_comments
  add column if not exists parent_comment_id uuid references public.diary_comments(id) on delete cascade;

create index if not exists idx_diary_comments_parent on public.diary_comments (parent_comment_id);

-- ────────────────────────────────────────────────────────────────
-- 2) 댓글 목록 — parent_comment_id 를 반환에 추가, 답글이 원댓글 바로 뒤에 오도록 정렬
--    (반환 컬럼이 늘어나서 drop 후 재생성 — diary_comments.sql 의 4)번을 이 정의로 덮는다)
-- ────────────────────────────────────────────────────────────────
drop function if exists public.get_diary_comments(uuid, integer, integer);

create function public.get_diary_comments(
  p_diary_id uuid,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, nickname text, content text, created_at timestamptz, is_mine boolean,
  parent_comment_id uuid
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid()),
         c.parent_comment_id
  from public.diary_comments c
  where c.diary_id = p_diary_id and c.status = 'visible'
  order by
    coalesce(
      (select p.created_at from public.diary_comments p where p.id = c.parent_comment_id),
      c.created_at
    ) asc,
    c.created_at asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_diary_comments(uuid, integer, integer) from public;
grant execute on function public.get_diary_comments(uuid, integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 3) 댓글/답글 쓰기 — p_parent_comment_id 매개변수 추가(기존 3개 매개변수 시그니처는 drop)
--    적립 규칙은 답글도 댓글과 완전히 동일하게 그대로 적용한다(새 규칙 만들지 않음).
-- ────────────────────────────────────────────────────────────────
drop function if exists public.create_diary_comment(uuid, text, text);

create function public.create_diary_comment(
  p_diary_id uuid,
  p_content  text,
  p_nickname text default null,
  p_parent_comment_id uuid default null
)
returns table (comment_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_author  uuid;
  v_len     integer;
  v_claim   record;
  v_awarded integer := 0;
  v_parent  public.diary_comments%rowtype;
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

  -- 답글이면: 같은 글에 달린, 그 자체가 답글이 아닌(1단계) 댓글이어야 한다(2단계까지만 허용).
  if p_parent_comment_id is not null then
    select * into v_parent from public.diary_comments p
     where p.id = p_parent_comment_id and p.diary_id = p_diary_id and p.status = 'visible';
    if v_parent.id is null then
      return query select null::uuid, 0, '이미 지워진 댓글이에요'::text; return;
    end if;
    if v_parent.parent_comment_id is not null then
      return query select null::uuid, 0, '답글에는 답글을 달 수 없어요'::text; return;
    end if;
  end if;

  insert into public.diary_comments (diary_id, user_id, nickname, content, parent_comment_id)
  values (p_diary_id, v_uid, p_nickname, btrim(p_content), p_parent_comment_id)
  returning id into v_id;

  -- 적립 조건: 남의 글 + 5자 이상 + 이 글에서 아직 받은 적 없음 — 답글도 댓글과 동일 규칙
  if v_author <> v_uid and v_len >= 5
     and not exists (
       select 1 from public.comment_awards w
       where w.user_id = v_uid and w.diary_id = p_diary_id
     )
  then
    select * into v_claim from public.claim_mission('comment_give', 1);
    v_awarded := coalesce(v_claim.awarded, 0);
    if v_awarded > 0 then
      insert into public.comment_awards (user_id, diary_id) values (v_uid, p_diary_id)
      on conflict do nothing;
    end if;
  end if;

  return query select v_id, v_awarded, ''::text;
end;
$$;

revoke all on function public.create_diary_comment(uuid, text, text, uuid) from public;
grant execute on function public.create_diary_comment(uuid, text, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────
-- (참고, 별도 작업) 답글 알림을 붙이려면 news_actor.sql 의 get_my_news() items 에
-- 아래와 같은 분기를 추가하면 된다 — "원댓글 작성자"에게 알리는 것이라 diary 소유자(d.user_id) 조건이
-- 아니라 부모 댓글 작성자(p.user_id) 조건이어야 한다:
--
--   union all
--   select 'diary_comment_reply', 'diary', d.id, c.nickname, c.user_id, left(d.content, 60), c.content, null, c.created_at
--   from public.diary_comments c
--   join public.diary_comments p on p.id = c.parent_comment_id
--   join public.diaries d on d.id = c.diary_id
--   where p.user_id = auth.uid() and c.user_id <> auth.uid() and c.status = 'visible'
--
-- news_actor.sql 을 다른 세션이 손대고 있어 지금은 넣지 않는다. 이 파일과 충돌 없이 나중에 이어 붙이면 된다.
