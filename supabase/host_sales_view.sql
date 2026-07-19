-- 진행자 본인이 진행한 라이브의 판매내역(투명성 요구사항 — "브랜드·상품명·금액·수량·판매일시").
-- 구매자 개인정보(이름/연락처)는 컬럼 자체를 포함하지 않는다.
-- 뷰 정의 안에서 auth.uid()로 "이 뷰를 호출한 사람이 host인 그 호스트의 라이브"만 필터링하므로
-- orders 테이블에 별도 RLS 정책을 추가할 필요가 없다(추가하면 구매자 PII 노출 위험이 생김).
-- partner_brands 뷰(products_public_read.sql)에 이미 쓰인 것과 동일한 패턴.
-- 실행: hosts.sql, lives_host_id.sql 적용 이후에 Supabase 대시보드(beautyground-main) → SQL Editor 에서 Run

create or replace view public.host_sales_view as
  select
    o.id,
    o.live_id,
    o.product_id,
    o.amount,
    o.quantity,
    o.status,
    o.created_at,
    l.host_id,
    l.title as live_title,
    p.name as product_name,
    p.partner_id,
    pb.brand_name
  from public.orders o
  join public.lives l on l.id = o.live_id
  join public.hosts h on h.id = l.host_id
  left join public.products p on p.id = o.product_id
  left join public.partner_brands pb on pb.id = p.partner_id
  where h.user_id = auth.uid();

grant select on public.host_sales_view to authenticated;
