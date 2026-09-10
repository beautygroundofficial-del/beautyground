-- 브랜드 셀러센터 — 재고 직접 수정 (2026-09-11)
-- 히로인스 셀러센터 벤치마킹([[히로인스 수익모델·셀러센터 정밀분석]])의 "브랜드 어드민 MVP 3종
-- (상품등록·주문송장·재고)" 중 재고 파트. 상품등록은 이미 있음(/brand/products, api/scrape-product).
-- Vercel 함수 12/12 한도라 서버리스 API를 늘리지 않고 Postgres RPC로 처리한다
-- (claim_partner_account_by_id·update_my_partner_export_details와 동일 패턴).
-- ⚠️ 본인 partner_id 소유 상품만 수정 가능 — product_id를 요청값으로 받아도 partner_id는
-- auth.uid()로 서버가 강제 조회해서 대조하므로 남의 상품 재고를 바꿀 수 없다.
create or replace function public.update_my_product_stock(p_product_id uuid, p_stock int)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.products;
  v_partner_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_stock < 0 then
    raise exception '재고는 0 이상이어야 합니다.';
  end if;

  select id into v_partner_id from public.partners where user_id = auth.uid();
  if v_partner_id is null then
    raise exception '연결된 브랜드 계정을 찾을 수 없습니다.';
  end if;

  -- 재고 0 → 품절로, 품절 상품에 재고가 다시 들어오면 판매중으로 자동 전환.
  -- 확인 대기(hidden) 상태는 건드리지 않는다 — 재고만으로 심사 전 상품이 노출돼선 안 됨.
  update public.products
  set stock = p_stock,
      status = case
        when p_stock = 0 and status = 'on_sale' then 'sold_out'
        when p_stock > 0 and status = 'sold_out' then 'on_sale'
        else status
      end
  where id = p_product_id and partner_id = v_partner_id
  returning * into v_row;

  if v_row.id is null then
    raise exception '수정 권한이 없는 상품입니다.';
  end if;

  return v_row;
end;
$$;
revoke all on function public.update_my_product_stock(uuid, int) from public;
grant execute on function public.update_my_product_stock(uuid, int) to authenticated;

notify pgrst, 'reload schema';
