-- 소비자(anon) 상품 목록에 브랜드명 표시용
-- partners 는 "본인만 조회" RLS 라 anon 이 brand_name 을 못 읽음.
-- 민감 컬럼(commission_rate/user_id/status) 노출 없이 id + brand_name 만 공개하는 뷰.
create or replace view partner_brands as
  select id, brand_name from partners;

grant select on partner_brands to anon, authenticated;

-- 참고) products 는 이미 anon select 가능(공개 읽기).
-- 원한다면 anon 에게 판매중만 노출하도록 정책을 조일 수 있음(선택, 미적용):
--   drop policy if exists "products public read" on products;
--   create policy "products public read" on products
--     for select using (status = 'on_sale');
--   (파트너 본인은 "products owner write"(for all) 정책으로 자기 상품 전체 조회 유지)
