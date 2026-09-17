-- 관리자가 아무 입점 브랜드나 골라서 판매자 센터를 조회하는 기능 — 2026-09-18
-- 대표님 지시: "매번 판매자 아이디를 새로 만들어서 들어가볼 수 없잖아, 마스터 계정으로 봐야해"
-- partners/products/settlements RLS는 이미 is_admin() 예외가 있음(admin_ops.sql) —
-- 남은 건 auth.uid()에 고정된 security definer RPC 2개(주문·라이브판매)뿐이라 이것만 고친다.
-- 실행: Supabase 대시보드(beautyground-mall, bjqtuklkskrqzbuxdwxm) → SQL Editor 에 전체 붙여넣고 Run

-- 1) 주문 조회 — p_partner_id 추가. 관리자가 넘기면 그 브랜드로, 아니면 기존과 동일(내 브랜드).
--    관리자가 아닌데 남의 partner_id를 넘기면 무시하고 본인 것으로 처리(권한 상승 방지).
create or replace function public.get_my_orders(p_partner_id uuid default null)
returns table (
  id uuid,
  product_id uuid,
  product_name text,
  quantity int,
  amount int,
  option_label text,
  status text,
  tracking_carrier text,
  shipping_status text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_partner_id is not null and public.is_admin() then
    v_partner_id := p_partner_id;
  else
    select pt.id into v_partner_id from public.partners pt where pt.user_id = auth.uid();
  end if;

  if v_partner_id is null then
    raise exception '연결된 브랜드 계정을 찾을 수 없습니다.';
  end if;

  return query
    select o.id, o.product_id, p.name, o.quantity, o.amount, o.option_label,
           o.status, o.tracking_carrier, o.shipping_status, o.shipped_at, o.delivered_at, o.created_at
    from public.orders o
    join public.products p on p.id = o.product_id
    where o.partner_id = v_partner_id
      and o.status not in ('pending', 'failed')
    order by o.created_at desc
    limit 500;
end;
$$;
revoke all on function public.get_my_orders(uuid) from public;
grant execute on function public.get_my_orders(uuid) to authenticated;

-- 2) 라이브 판매내역 — partner_live_sales_view(뷰, auth.uid() 고정)는 그대로 두고,
--    관리자 조회용 함수를 새로 만든다(뷰는 파라미터를 못 받음). 로직·반환 컬럼은 뷰와 동일.
create or replace function public.get_partner_live_sales(p_partner_id uuid default null)
returns table (
  id uuid,
  live_id uuid,
  product_id uuid,
  amount int,
  quantity int,
  status text,
  created_at timestamptz,
  partner_id uuid,
  live_title text,
  live_scheduled_at timestamptz,
  dept_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  if p_partner_id is not null and public.is_admin() then
    v_partner_id := p_partner_id;
  else
    select pt.id into v_partner_id from public.partners pt where pt.user_id = auth.uid();
  end if;

  if v_partner_id is null then
    raise exception '연결된 브랜드 계정을 찾을 수 없습니다.';
  end if;

  -- 정렬은 안 붙인다 — PostgREST가 함수 결과도 .order()로 정렬해주므로 호출부(Dashboard.tsx는
  -- created_at, LiveSales.tsx는 live_scheduled_at)에서 필요한 기준으로 각자 정렬한다.
  return query
    select o.id, o.live_id, o.product_id, o.amount, o.quantity, o.status, o.created_at,
           o.partner_id, l.title, l.scheduled_at, l.dept_key
    from public.orders o
    left join public.lives l on l.id = o.live_id
    where o.partner_id = v_partner_id;
end;
$$;
revoke all on function public.get_partner_live_sales(uuid) from public;
grant execute on function public.get_partner_live_sales(uuid) to authenticated;

notify pgrst, 'reload schema';
