-- 회원 관리: 커뮤니티 시딩용 테스트 계정 구분 — 2026-09-17
-- 시딩 계정 100개는 user_metadata에 is_seed:true 를 심어서 만들었다
-- (scripts/seed_create_accounts.mjs). admin_list_members()가 이 값을 안 읽어와서
-- 관리자 회원목록에서 실회원과 구분이 안 됐다 — is_seed 컬럼을 추가해 반환하도록 재정의한다.
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor 에 전체 붙여넣고 Run
-- 선행 조건: members_channel_breakdown.sql 이 먼저 적용되어 있어야 함(같은 함수를 재정의).

drop function if exists public.admin_list_members();

create function public.admin_list_members()
returns table (
  id uuid,
  email text,
  name text,
  phone text,
  provider text,
  created_at timestamptz,
  total_spent bigint,
  order_count bigint,
  mall_spent bigint,
  mall_order_count bigint,
  live_spent bigint,
  live_order_count bigint,
  tier_label text,
  is_seed boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 회원 목록을 조회할 수 있습니다.';
  end if;

  return query
    select
      u.id,
      u.email::text,
      coalesce(u.raw_user_meta_data->>'name', '') as name,
      coalesce(u.raw_user_meta_data->>'phone', '') as phone,
      coalesce(
        u.raw_user_meta_data->>'provider',
        (select i.provider from auth.identities i where i.user_id = u.id order by i.created_at asc limit 1),
        'email'
      ) as provider,
      u.created_at,
      coalesce(o.total_spent, 0) as total_spent,
      coalesce(o.order_count, 0) as order_count,
      coalesce(o.mall_spent, 0) as mall_spent,
      coalesce(o.mall_order_count, 0) as mall_order_count,
      coalesce(o.live_spent, 0) as live_spent,
      coalesce(o.live_order_count, 0) as live_order_count,
      coalesce(
        (select mt.label from public.membership_tiers mt
         where mt.min_spent <= coalesce(o.total_spent, 0)
         order by mt.min_spent desc limit 1),
        'BASIC'
      ) as tier_label,
      coalesce((u.raw_user_meta_data->>'is_seed')::boolean, false) as is_seed
    from auth.users u
    left join (
      select
        user_id,
        sum(amount) filter (where product_id is not null and order_name is distinct from '배송비') as total_spent,
        count(distinct payment_id) as order_count,
        sum(amount) filter (where product_id is not null and order_name is distinct from '배송비' and live_id is null) as mall_spent,
        count(distinct payment_id) filter (where live_id is null) as mall_order_count,
        sum(amount) filter (where product_id is not null and order_name is distinct from '배송비' and live_id is not null) as live_spent,
        count(distinct payment_id) filter (where live_id is not null) as live_order_count
      from public.orders
      where status in ('paid', 'shipped', 'done')
      group by user_id
    ) o on o.user_id = u.id
    order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_members() from public;
grant execute on function public.admin_list_members() to authenticated;

notify pgrst, 'reload schema';
