-- 브랜드 셀러센터 — 내 상품이 팔린 주문 조회, 읽기 전용 (2026-09-11)
-- 히로인스 셀러센터 벤치마킹([[히로인스 수익모델·셀러센터 정밀분석]])의 "브랜드 어드민 MVP 3종
-- (상품등록·주문송장·재고)" 중 주문 파트. ⚠️ 법적 근거: 우리 몰 주문은 매장(광명점)이 CJ택배로
-- 직접 발송하므로(project_mall_shipping) 브랜드가 배송/송장을 직접 입력할 일이 없다 — 여기서는
-- "무엇이 얼마나 팔렸는지" 조회만 제공한다.
-- ⚠️ 개인정보 비공개 원칙 — 히로인스도 "체험단 주문자 정보는 개인정보 비공개"로 설계했다.
-- 구매자명·연락처·배송지·결제ID 등은 절대 반환하지 않는다(개인정보보호법 제3자 제공 소지 차단).
-- Vercel 함수 12/12 한도라 Postgres RPC로 처리, 반환 컬럼을 여기서 직접 화이트리스트한다.
create or replace function public.get_my_orders()
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

  select id into v_partner_id from public.partners where user_id = auth.uid();
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
revoke all on function public.get_my_orders() from public;
grant execute on function public.get_my_orders() to authenticated;

notify pgrst, 'reload schema';
