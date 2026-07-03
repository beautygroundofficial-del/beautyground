-- 소비자 목록 가격 정렬을 실제 판매가(할인가 우선) 기준으로.
-- 정렬 전용 생성 컬럼: sale_price 가 있으면 sale_price, 없으면 price.
alter table products
  add column if not exists effective_price integer
  generated always as (coalesce(sale_price, price)) stored;

create index if not exists products_effective_price_idx on products (effective_price);

notify pgrst, 'reload schema';
