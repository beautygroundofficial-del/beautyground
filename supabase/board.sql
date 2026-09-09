-- 속 이야기(손님 게시판) — 2026-09-10
--
-- 히로인스 게시판을 분석해 기능만 가져오고 이름·구조는 새로 지었다(설계도: 옵시디언 "손님 게시판 설계").
--   · 카테고리 7개, 제목 없이 본문만, 최신순만(인기순 없음), 숫자 0이면 감춤
--   · 공감(토닥토닥·나도 그래요·응원해요)·댓글·어뷰징 방지는 일기(diaries) 것과 같은 방식
-- ⚠️ community_posts(브랜드 회원사 전용 사내 블로그)와는 무관 — 완전히 다른 기능이라 새 테이블.
-- ⚠️ daily_questions.sql · diary_comments.sql · missions_rpc.sql 을 먼저 실행한 뒤 실행하세요
--    (reactions · claim_mission 을 씁니다).
-- 포인트: board_post 미션을 등록하지 않으면 0P — 이 SQL만으로는 포인트가 나가지 않는다(결정 대기).
--         공감·댓글은 일기와 같은 reaction_give · comment_give 미션을 그대로 쓴다.
-- 실행: Supabase 대시보드(beautyground-main, bjqtuklkskrqzbuxdwxm) → SQL Editor

-- ────────────────────────────────────────────────────────────────
-- 1) board_posts
-- ────────────────────────────────────────────────────────────────
create table if not exists public.board_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  nickname    text,                                   -- 작성 시점 표시 이름(스냅샷)
  category    text not null
              check (category in ('kids','spouse','parents','body','mind','living','chat')),
  content     text not null,
  images      text[] not null default '{}',
  status      text not null default 'visible'
              check (status in ('visible', 'hidden')), -- 신고·운영상 숨김 처리용
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.board_posts is '속 이야기(손님 게시판) — kids=아이 키우는 이야기 spouse=남편이랑 사는 이야기 parents=부모님 생각나는 날 body=몸이 달라지는 이야기 mind=마음이 힘든 날 living=살림하는 이야기 chat=그냥 하는 이야기';

create index if not exists idx_board_posts_feed on public.board_posts (status, created_at desc);
create index if not exists idx_board_posts_cat  on public.board_posts (status, category, created_at desc);
create index if not exists idx_board_posts_user on public.board_posts (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────
-- 2) board_comments + 적립 이력
-- ────────────────────────────────────────────────────────────────
create table if not exists public.board_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.board_posts(id) on delete cascade,
  user_id    uuid not null,
  nickname   text,
  content    text not null,
  status     text not null default 'visible'
             check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_board_comments_feed on public.board_comments (post_id, status, created_at);
create index if not exists idx_board_comments_user on public.board_comments (user_id, created_at desc);

-- 한 글에서는 평생 한 번만 적립 — 지웠다 다시 써서 반복 적립하는 것을 막는다. 지우지 않는다.
create table if not exists public.board_comment_awards (
  user_id    uuid not null,
  post_id    uuid not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ────────────────────────────────────────────────────────────────
-- 3) board_reports — 신고(운영자가 보고 숨김 처리)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.board_reports (
  post_id    uuid not null references public.board_posts(id) on delete cascade,
  user_id    uuid not null,
  reason     text,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ────────────────────────────────────────────────────────────────
-- 4) RLS
-- ────────────────────────────────────────────────────────────────
alter table public.board_posts          enable row level security;
alter table public.board_comments       enable row level security;
alter table public.board_comment_awards enable row level security;
alter table public.board_reports        enable row level security;

drop policy if exists board_posts_public_read on public.board_posts;
create policy board_posts_public_read on public.board_posts
  for select using (status = 'visible');

drop policy if exists board_posts_own_all on public.board_posts;
create policy board_posts_own_all on public.board_posts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists board_posts_admin_all on public.board_posts;
create policy board_posts_admin_all on public.board_posts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists board_comments_public_read on public.board_comments;
create policy board_comments_public_read on public.board_comments
  for select using (status = 'visible');

drop policy if exists board_comments_own_all on public.board_comments;
create policy board_comments_own_all on public.board_comments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists board_comments_admin_all on public.board_comments;
create policy board_comments_admin_all on public.board_comments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists board_comment_awards_own_read on public.board_comment_awards;
create policy board_comment_awards_own_read on public.board_comment_awards
  for select using (auth.uid() = user_id);

-- 신고는 관리자만 읽는다(신고자 노출 방지). 쓰기는 report_board_post(security definer)만.
drop policy if exists board_reports_admin_read on public.board_reports;
create policy board_reports_admin_read on public.board_reports
  for select using (public.is_admin());

-- ────────────────────────────────────────────────────────────────
-- 5) 공감을 게시판 글에도 붙인다 — reactions 대상에 'board' 추가
-- ────────────────────────────────────────────────────────────────
alter table public.reactions       drop constraint if exists reactions_target_type_check;
alter table public.reactions       add  constraint reactions_target_type_check
  check (target_type in ('diary', 'answer', 'board'));

alter table public.reaction_awards drop constraint if exists reaction_awards_target_type_check;
alter table public.reaction_awards add  constraint reaction_awards_target_type_check
  check (target_type in ('diary', 'answer', 'board'));

-- set_reaction — 반환 컬럼은 그대로라 replace 로 충분. 'board' 분기만 추가.
create or replace function public.set_reaction(
  p_target_type text,
  p_target_id   uuid,
  p_kind        text
)
returns table (my_kind text, pat integer, same integer, cheer integer, awarded integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_cur    text;
  v_author uuid;
  v_claim  record;
  v_awarded integer := 0;
begin
  if v_uid is null then
    return query select null::text, 0, 0, 0, 0; return;
  end if;
  if p_target_type not in ('diary', 'answer', 'board') or p_kind not in ('pat', 'same', 'cheer') then
    return query select null::text, 0, 0, 0, 0; return;
  end if;

  select r.kind into v_cur from public.reactions r
   where r.target_type = p_target_type and r.target_id = p_target_id and r.user_id = v_uid;

  if v_cur = p_kind then
    delete from public.reactions
     where target_type = p_target_type and target_id = p_target_id and user_id = v_uid;
  else
    insert into public.reactions (target_type, target_id, user_id, kind)
    values (p_target_type, p_target_id, v_uid, p_kind)
    on conflict (target_type, target_id, user_id) do update set kind = excluded.kind;

    if p_target_type = 'diary' then
      select d.user_id into v_author from public.diaries d where d.id = p_target_id;
    elsif p_target_type = 'board' then
      select b.user_id into v_author from public.board_posts b where b.id = p_target_id;
    else
      select a.user_id into v_author from public.daily_answers a where a.id = p_target_id;
    end if;

    if v_author is not null and v_author <> v_uid
       and not exists (
         select 1 from public.reaction_awards w
         where w.user_id = v_uid and w.target_type = p_target_type and w.target_id = p_target_id
       )
    then
      select * into v_claim from public.claim_mission('reaction_give', 1);
      v_awarded := coalesce(v_claim.awarded, 0);
      if v_awarded > 0 then
        insert into public.reaction_awards (user_id, target_type, target_id)
        values (v_uid, p_target_type, p_target_id)
        on conflict do nothing;
      end if;
    end if;
  end if;

  return query
    select (select r.kind from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.user_id = v_uid),
           (select count(*)::integer from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.kind = 'pat'),
           (select count(*)::integer from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.kind = 'same'),
           (select count(*)::integer from public.reactions r
             where r.target_type = p_target_type and r.target_id = p_target_id and r.kind = 'cheer'),
           v_awarded;
end;
$$;

revoke all on function public.set_reaction(text, uuid, text) from public;
grant execute on function public.set_reaction(text, uuid, text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 6) 글 쓰기 (+ board_post 미션 — 등록돼 있을 때만 적립)
-- ────────────────────────────────────────────────────────────────
create or replace function public.create_board_post(
  p_category text,
  p_content  text,
  p_images   text[] default '{}',
  p_nickname text default null
)
returns table (post_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_claim record;
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;
  if p_category not in ('kids','spouse','parents','body','mind','living','chat') then
    return query select null::uuid, 0, '이야기 종류를 골라주세요'::text; return;
  end if;
  if p_content is null or length(btrim(p_content)) < 10 then
    return query select null::uuid, 0, '10자 이상 적어주세요'::text; return;
  end if;
  if length(p_content) > 2000 then
    return query select null::uuid, 0, '2000자 안으로 적어주세요'::text; return;
  end if;

  insert into public.board_posts (user_id, nickname, category, content, images)
  values (v_uid, p_nickname, p_category, btrim(p_content), coalesce(p_images, '{}'))
  returning id into v_id;

  select * into v_claim from public.claim_mission('board_post', 1);
  return query select v_id, coalesce(v_claim.awarded, 0), ''::text;
end;
$$;

revoke all on function public.create_board_post(text, text, text[], text) from public;
grant execute on function public.create_board_post(text, text, text[], text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 7) 목록 — 카테고리 여러 개 동시 선택 가능(빈 배열이면 전체). 최신순만.
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_board_feed(
  p_categories text[] default '{}',
  p_limit  integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid, user_id uuid, nickname text, category text, content text, images text[],
  is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text, comment_count integer
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()),
         b.created_at,
         (select count(*)::integer from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c
           where c.post_id = b.id and c.status = 'visible')
  from public.board_posts b
  where b.status = 'visible'
    and (coalesce(array_length(p_categories, 1), 0) = 0 or b.category = any(p_categories))
  order by b.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_board_feed(text[], integer, integer) from public;
grant execute on function public.get_board_feed(text[], integer, integer) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 8) 글 하나
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_board_post(p_id uuid)
returns table (
  id uuid, user_id uuid, nickname text, category text, content text, images text[],
  is_mine boolean, created_at timestamptz,
  pat integer, same integer, cheer integer, my_kind text, comment_count integer
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.user_id, b.nickname, b.category, b.content, b.images,
         (b.user_id = auth.uid()),
         b.created_at,
         (select count(*)::integer from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.kind = 'pat'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.kind = 'same'),
         (select count(*)::integer from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.kind = 'cheer'),
         (select r.kind from public.reactions r
           where r.target_type = 'board' and r.target_id = b.id and r.user_id = auth.uid()),
         (select count(*)::integer from public.board_comments c
           where c.post_id = b.id and c.status = 'visible')
  from public.board_posts b
  where b.id = p_id
    and (b.status = 'visible' or b.user_id = auth.uid() or public.is_admin());
$$;

revoke all on function public.get_board_post(uuid) from public;
grant execute on function public.get_board_post(uuid) to anon, authenticated;

-- ────────────────────────────────────────────────────────────────
-- 9) 댓글 목록 / 쓰기 (+ comment_give 적립, 일기와 같은 규칙)
-- ────────────────────────────────────────────────────────────────
create or replace function public.get_board_comments(
  p_post_id uuid,
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (id uuid, nickname text, content text, created_at timestamptz, is_mine boolean)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nickname, c.content, c.created_at, (c.user_id = auth.uid())
  from public.board_comments c
  where c.post_id = p_post_id and c.status = 'visible'
  order by c.created_at asc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

revoke all on function public.get_board_comments(uuid, integer, integer) from public;
grant execute on function public.get_board_comments(uuid, integer, integer) to anon, authenticated;

create or replace function public.create_board_comment(
  p_post_id  uuid,
  p_content  text,
  p_nickname text default null
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

  select b.user_id into v_author from public.board_posts b
   where b.id = p_post_id and b.status = 'visible';
  if v_author is null then
    return query select null::uuid, 0, '이미 지워진 이야기예요'::text; return;
  end if;

  insert into public.board_comments (post_id, user_id, nickname, content)
  values (p_post_id, v_uid, p_nickname, btrim(p_content))
  returning id into v_id;

  if v_author <> v_uid and v_len >= 5
     and not exists (
       select 1 from public.board_comment_awards w
       where w.user_id = v_uid and w.post_id = p_post_id
     )
  then
    select * into v_claim from public.claim_mission('comment_give', 1);
    v_awarded := coalesce(v_claim.awarded, 0);
    if v_awarded > 0 then
      insert into public.board_comment_awards (user_id, post_id) values (v_uid, p_post_id)
      on conflict do nothing;
    end if;
  end if;

  return query select v_id, v_awarded, ''::text;
end;
$$;

revoke all on function public.create_board_comment(uuid, text, text) from public;
grant execute on function public.create_board_comment(uuid, text, text) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 10) 신고 — 기록만 남긴다. 숨김은 운영자가 보고 결정(자동 숨김 없음).
-- ────────────────────────────────────────────────────────────────
create or replace function public.report_board_post(p_post_id uuid, p_reason text default null)
returns table (ok boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return query select false, '로그인이 필요합니다'::text; return;
  end if;
  if not exists (select 1 from public.board_posts b where b.id = p_post_id) then
    return query select false, '이미 지워진 이야기예요'::text; return;
  end if;
  insert into public.board_reports (post_id, user_id, reason)
  values (p_post_id, v_uid, left(coalesce(p_reason, ''), 200))
  on conflict (post_id, user_id) do update set reason = excluded.reason, created_at = now();
  return query select true, '알려주셔서 고마워요. 확인해 볼게요'::text;
end;
$$;

revoke all on function public.report_board_post(uuid, text) from public;
grant execute on function public.report_board_post(uuid, text) to authenticated;

notify pgrst, 'reload schema';
