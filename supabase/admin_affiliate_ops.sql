-- 파트너스(개인 제휴 판매자) 관리자 화면 — 2026-09-29
-- affiliates.sql 에는 본인 조회/쓰기 RLS + admin_generate_affiliate_settlement/admin_mark_affiliate_settlement_paid
-- 함수까지만 있고, 관리자가 "전체 정산 목록"을 한 번에 보는 조회 함수가 없었다
-- (admin_list_partner_settlements 와 짝이 되는 게 없어서 admin_ops.sql을 그대로 본떠 추가).
-- 파트너 목록(affiliates)은 이미 affiliates_admin_all 정책으로 관리자가 전체 select 가능해서 별도 함수 불필요.

create or replace function public.admin_list_affiliate_settlements()
returns table (
  id uuid,
  affiliate_id uuid,
  affiliate_name text,
  affiliate_code text,
  period text,
  total_sales bigint,
  tier_name text,
  commission_rate numeric,
  commission_amount bigint,
  status text,
  paid_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 정산 목록을 조회할 수 있습니다.';
  end if;

  return query
    select s.id, s.affiliate_id, a.name, a.code, s.period, s.total_sales, s.tier_name,
           s.commission_rate, s.commission_amount, s.status, s.paid_at, s.created_at
    from public.affiliate_settlements s
    join public.affiliates a on a.id = s.affiliate_id
    order by s.created_at desc;
end;
$$;
revoke all on function public.admin_list_affiliate_settlements() from public;
grant execute on function public.admin_list_affiliate_settlements() to authenticated;

notify pgrst, 'reload schema';
