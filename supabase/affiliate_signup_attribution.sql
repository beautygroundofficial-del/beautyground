-- 파트너스 가입 귀속 측정 — 2026-10-14
-- 목적: "파트너 링크로 들어와 가입한 사람이 가입 뒤 커뮤니티에 남는가"를 알 수 있게 가입자를 파트너에 연결해 기록한다.
--       지금은 구매(orders.affiliate_code)만 파트너에 귀속되고 가입·활동은 연결이 없어 효과를 측정할 수 없다.
-- 원칙: 측정만 한다. 가입·활동에 대한 보상은 만들지 않는다(방문판매법 다단계 판정 위험 — 별도 법적 검토 후에만).
--       파트너에게는 개별 가입자를 보여주지 않는다(관리자만 집계를 본다).
-- 기록 기준: 7일 귀속 쿠키(bg_aff_v1)가 있는 상태에서 "갓 가입한 계정"의 첫 로그인(이메일 인증형은 인증 시각 기준 2시간 이내).
--           이미 기록된 사람·본인·정지된 파트너·없는 코드는 기록하지 않는다. 측정 실패가 가입에 영향을 주지 않는다.
-- 운영 DB 실행: 내용 보고 → 대표님 승인 → 실행(scripts/db_query.mjs). 되돌리기: 맨 아래 롤백 주석.

begin;

create table if not exists public.affiliate_signups (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  link_code    text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_affiliate_signups_aff on public.affiliate_signups (affiliate_id, created_at desc);
alter table public.affiliate_signups enable row level security;
revoke all on public.affiliate_signups from anon, authenticated;

-- 로그인 직후 클라이언트가 호출. 결과 문구는 내부 확인용(화면에 보여주지 않는다).
create or replace function public.attribute_affiliate_signup(p_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_fresh boolean; v_aff uuid; v_aff_user uuid; v_status text;
begin
  if me is null then return 'login'; end if;
  if p_code is null or length(p_code) > 40 then return 'invalid'; end if;
  if exists (select 1 from public.affiliate_signups where user_id = me) then return 'already'; end if;

  select (now() - coalesce(u.email_confirmed_at, u.created_at)) < interval '2 hours'
    into v_fresh from auth.users u where u.id = me;
  if not coalesce(v_fresh, false) then return 'not_new'; end if;

  select a.id, a.user_id, a.status into v_aff, v_aff_user, v_status
  from public.affiliate_links l join public.affiliates a on a.id = l.affiliate_id
  where l.code = p_code;
  if v_aff is null then return 'invalid'; end if;
  if v_status <> 'active' then return 'inactive'; end if;
  if v_aff_user = me then return 'self'; end if;

  insert into public.affiliate_signups (user_id, affiliate_id, link_code)
  values (me, v_aff, p_code) on conflict (user_id) do nothing;
  return 'ok';
end;
$$;
revoke all on function public.attribute_affiliate_signup(text) from public, anon;
grant execute on function public.attribute_affiliate_signup(text) to authenticated;

-- 관리자용 집계 — 파트너별 가입 수와 가입 뒤 행동.
--  · mature_7d / mature_30d : 가입한 지 7일 / 30일이 지난 사람 수(아직 기간이 안 된 사람은 비율에서 뺀다)
--  · wrote_*  : 가입 뒤 N일 안에 글·댓글·답변을 한 번이라도 남긴 사람(하루 이야기·속 이야기·댓글·오늘의 질문 답)
--  · returned_*: 가입 다음 날 이후에 다시 접속한 사람(마지막 접속 시각 기준 — 정확한 일별 접속 기록은 없다)
create or replace function public.admin_affiliate_signup_stats()
returns table (
  affiliate_id uuid, code text, name text,
  signups bigint, signups_30d bigint,
  mature_7d bigint, wrote_7d bigint, returned_7d bigint,
  mature_30d bigint, wrote_30d bigint, returned_30d bigint
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '관리자만 실행할 수 있습니다.'; end if;
  return query
  with s as (
    select sg.affiliate_id as aid, sg.user_id as uid, sg.created_at as signed_at, u.last_sign_in_at as last_in
    from public.affiliate_signups sg join auth.users u on u.id = sg.user_id
  ), f as (
    select s.*, (
      select min(t.at) from (
        select d.created_at as at from public.diaries d where d.user_id = s.uid
        union all select b.created_at from public.board_posts b where b.user_id = s.uid
        union all select c.created_at from public.diary_comments c where c.user_id = s.uid
        union all select c.created_at from public.board_comments c where c.user_id = s.uid
        union all select a.created_at from public.daily_answers a where a.user_id = s.uid
      ) t
    ) as first_act
    from s
  )
  select a.id, a.code, a.name,
    count(f.uid)::bigint,
    count(f.uid) filter (where f.signed_at >= now() - interval '30 days')::bigint,
    count(f.uid) filter (where f.signed_at <= now() - interval '7 days')::bigint,
    count(f.uid) filter (where f.signed_at <= now() - interval '7 days' and f.first_act <= f.signed_at + interval '7 days')::bigint,
    count(f.uid) filter (where f.signed_at <= now() - interval '7 days' and f.last_in >= f.signed_at + interval '1 day')::bigint,
    count(f.uid) filter (where f.signed_at <= now() - interval '30 days')::bigint,
    count(f.uid) filter (where f.signed_at <= now() - interval '30 days' and f.first_act <= f.signed_at + interval '30 days')::bigint,
    count(f.uid) filter (where f.signed_at <= now() - interval '30 days' and f.last_in >= f.signed_at + interval '1 day')::bigint
  from public.affiliates a left join f on f.aid = a.id
  group by a.id, a.code, a.name
  order by count(f.uid) desc, a.created_at;
end;
$$;
revoke all on function public.admin_affiliate_signup_stats() from public, anon;
grant execute on function public.admin_affiliate_signup_stats() to authenticated;

notify pgrst, 'reload schema';
commit;

-- 롤백: drop function public.admin_affiliate_signup_stats(); drop function public.attribute_affiliate_signup(text);
--       drop table public.affiliate_signups;
