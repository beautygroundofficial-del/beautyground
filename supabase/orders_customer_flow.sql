-- 고객 구매여정 보강: 배송 요청사항 + 운송장 + 고객 취소요청
-- 실행: Supabase 대시보드 → SQL Editor 에 전체 붙여넣고 Run

-- 0) [버그수정·중요] payment_id UNIQUE 제약 제거
--    주문서(AppOrder)는 장바구니 여러 상품 + 배송비를 "같은 payment_id 의 여러 행"으로
--    저장하는 구조인데, unique 제약 때문에 2행째부터 23505 로 실패 →
--    다품목/배송비 포함 주문이 전부 "주문 생성 실패"가 나던 원인.
alter table orders drop constraint if exists orders_payment_id_key;
create index if not exists orders_payment_id_idx on orders (payment_id);

-- 1) 주문에 배송 요청사항/운송장 컬럼 추가
alter table orders add column if not exists delivery_memo text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists tracking_carrier text;

-- 2) 고객 취소요청 RPC — 고객에게 orders update 권한을 직접 주면 금액 등
--    다른 컬럼까지 조작 가능하므로, "자기 주문 + paid 상태 → cancel_requested"
--    한 가지 전이만 허용하는 security definer 함수로 제한한다.
create or replace function request_order_cancel(p_payment_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update orders
     set status = 'cancel_requested'
   where payment_id = p_payment_id
     and user_id = auth.uid()
     and status = 'paid';
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function request_order_cancel(text) from public;
grant execute on function request_order_cancel(text) to authenticated;
