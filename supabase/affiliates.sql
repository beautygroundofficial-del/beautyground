-- 링크 셀러(개인 제휴 판매자) — 2026-09-26 대표님 지시
-- "브랜드 판매자가 아니고, 우리 앱 제품 링크를 가지고 외부에서 판매하면 판매수수료(5%)를 주는 형태.
--  회원가입을 통한 개인 셀러페이지 안에 개인정보·판매등급·실제 판매금액 정산 시스템,
--  앱 제품 링크를 넣으면 새 링크를 만들어주는 것 — 쿠팡파트너스와 같은 형태."
--
-- 구조(진행자 host → lives → orders 정산 파이프라인을 그대로 본뜸):
--   affiliates(개인 셀러) → affiliate_links(상품별 추적링크) → orders.affiliate_code(주문 귀속) → affiliate_settlements(월 정산)
-- ⚠️ 링크만 공유하는 방식(쿠팡파트너스식). 셀러가 셀러를 모집하거나 하위 실적에 수당을 얹는 구조는 절대 넣지 않는다
--    (방문판매법 다단계 요건 회피 — 정법무 2026-09-24). 추천은 1단계까지만.
-- 실행: 대표님 승인 후 Supabase 대시보드(beautyground-main) → SQL Editor 에 전체 붙여넣고 Run

-- 1) 개인 셀러
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique,                          -- 셀러 고유 코드(링크 코드의 앞부분으로도 씀)
  name text not null,
  phone text,
  email text,
  bank_name text,                                     -- 정산 계좌(본인만 조회)
  bank_account text,
  bank_holder text,
  channel text,                                       -- 주로 공유하는 곳(인스타·블로그·카톡 등, 선택)
  status text not null default 'active' check (status in ('active', 'suspended')),
  agreed_at timestamptz not null default now(),       -- 약관 동의 시각
  created_at timestamptz not null default now()
);

alter table public.affiliates enable row level security;

drop policy if exists "affiliates_select_own" on public.affiliates;
create policy "affiliates_select_own" on public.affiliates
  for select using (auth.uid() = user_id);

-- 가입: 본인 user_id + active 로만 insert (진행자와 달리 심사 없이 즉시 활성 — 링크 공유만 하므로 리스크 낮음)
drop policy if exists "affiliates_insert_own" on public.affiliates;
create policy "affiliates_insert_own" on public.affiliates
  for insert with check (auth.uid() = user_id and status = 'active');

-- 본인 정보 수정(status는 본인이 못 바꾸게 트리거로 고정)
drop policy if exists "affiliates_update_own" on public.affiliates;
create policy "affiliates_update_own" on public.affiliates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.affiliates_guard_status()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() and new.status is distinct from old.status then
    raise exception '상태는 관리자만 바꿀 수 있습니다.';
  end if;
  if new.code is distinct from old.code then
    raise exception '셀러 코드는 바꿀 수 없습니다.';
  end if;
  return new;
end $$;
drop trigger if exists affiliates_guard_status on public.affiliates;
create trigger affiliates_guard_status before update on public.affiliates
  for each row execute function public.affiliates_guard_status();

-- 관리자 전체 조회/상태 변경(is_admin()은 admin_lockdown.sql)
drop policy if exists "affiliates_admin_all" on public.affiliates;
create policy "affiliates_admin_all" on public.affiliates
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) 판매등급표 — 월 매출 기준으로 수수료율 결정. 기본 1단계 5%(대표님 지시). 관리자가 등급 추가 가능.
create table if not exists public.affiliate_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_sales bigint not null default 0,                -- 이 월매출(원) 이상부터 적용
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  created_at timestamptz not null default now()
);
alter table public.affiliate_tiers enable row level security;
drop policy if exists "affiliate_tiers_select_authenticated" on public.affiliate_tiers;
create policy "affiliate_tiers_select_authenticated" on public.affiliate_tiers
  for select using (auth.role() = 'authenticated');
drop policy if exists "affiliate_tiers_admin_all" on public.affiliate_tiers;
create policy "affiliate_tiers_admin_all" on public.affiliate_tiers
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.affiliate_tiers (name, min_sales, commission_rate)
select '기본', 0, 5.00
where not exists (select 1 from public.affiliate_tiers);

-- 3) 추적 링크 — 셀러가 상품 링크를 붙여넣으면 상품 1개당 링크 1개(같은 상품이면 기존 링크 재사용)
create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code text not null unique,                          -- /go/{code}
  clicks bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (affiliate_id, product_id)
);
alter table public.affiliate_links enable row level security;
drop policy if exists "affiliate_links_select_own" on public.affiliate_links;
create policy "affiliate_links_select_own" on public.affiliate_links
  for select using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));
drop policy if exists "affiliate_links_admin_all" on public.affiliate_links;
create policy "affiliate_links_admin_all" on public.affiliate_links
  for all using (public.is_admin()) with check (public.is_admin());
-- insert 는 아래 create_affiliate_link() 함수로만(코드 충돌·상품 존재 검증을 서버에서)

-- 4) 클릭 로그 — 비로그인 포함 누구나 insert 만(조회는 집계 함수로만)
create table if not exists public.affiliate_clicks (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.affiliate_links(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer_domain text,
  device text
);
alter table public.affiliate_clicks enable row level security;
create index if not exists affiliate_clicks_link_idx on public.affiliate_clicks (link_id, clicked_at);

-- 5) 주문 귀속 — 결제 시점에 클라이언트가 저장해둔 링크 코드를 붙인다(라이브의 live_id 와 같은 역할)
alter table public.orders add column if not exists affiliate_code text;
create index if not exists orders_affiliate_code_idx on public.orders (affiliate_code) where affiliate_code is not null;

-- 6) 링크 생성 함수 — 상품 링크 붙여넣기 → 코드 발급. 본인 셀러 레코드가 있어야 하고 상품이 판매중이어야 함.
create or replace function public.create_affiliate_link(p_product_id uuid)
returns public.affiliate_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aff public.affiliates;
  v_row public.affiliate_links;
  v_code text;
  v_try int := 0;
begin
  select * into v_aff from public.affiliates where user_id = auth.uid();
  if v_aff.id is null then raise exception '링크 셀러 가입이 먼저 필요합니다.'; end if;
  if v_aff.status <> 'active' then raise exception '정지된 계정입니다.'; end if;
  if not exists (select 1 from public.products where id = p_product_id and status = 'on_sale') then
    raise exception '판매 중인 상품이 아닙니다.';
  end if;

  select * into v_row from public.affiliate_links where affiliate_id = v_aff.id and product_id = p_product_id;
  if v_row.id is not null then return v_row; end if;

  loop
    -- 셀러코드 + 랜덤 4자 → 사람이 읽기 쉬운 짧은 코드(예: k3m9-a7x2)
    v_code := v_aff.code || '-' || lower(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));
    exit when not exists (select 1 from public.affiliate_links where code = v_code);
    v_try := v_try + 1;
    if v_try > 10 then raise exception '코드 생성 실패, 다시 시도해 주세요.'; end if;
  end loop;

  insert into public.affiliate_links (affiliate_id, product_id, code)
  values (v_aff.id, p_product_id, v_code)
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.create_affiliate_link(uuid) from public;
grant execute on function public.create_affiliate_link(uuid) to authenticated;

-- 7) 클릭 기록 함수 — /go/{code} 진입 시 호출(비로그인 가능). 상품 id 를 돌려줘 그 상품 페이지로 보낸다.
create or replace function public.track_affiliate_click(p_code text, p_referrer text default null, p_device text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.affiliate_links;
begin
  select l.* into v_link
  from public.affiliate_links l
  join public.affiliates a on a.id = l.affiliate_id
  where l.code = p_code and a.status = 'active';
  if v_link.id is null then return null; end if;
  insert into public.affiliate_clicks (link_id, referrer_domain, device) values (v_link.id, p_referrer, p_device);
  update public.affiliate_links set clicks = clicks + 1 where id = v_link.id;
  return v_link.product_id;
end $$;
revoke all on function public.track_affiliate_click(text, text, text) from public;
grant execute on function public.track_affiliate_click(text, text, text) to anon, authenticated;

-- 8) 내 판매내역 뷰 — host_sales_view 와 같은 패턴: 구매자 개인정보 컬럼 없이, auth.uid() 본인 것만.
create or replace view public.affiliate_sales_view as
  select
    o.id,
    o.payment_id,
    o.product_id,
    o.amount,
    o.quantity,
    o.status,
    o.created_at,
    o.affiliate_code,
    l.id as link_id,
    a.id as affiliate_id,
    p.name as product_name,
    p.thumbnail_url
  from public.orders o
  join public.affiliate_links l on l.code = o.affiliate_code
  join public.affiliates a on a.id = l.affiliate_id
  left join public.products p on p.id = o.product_id
  where a.user_id = auth.uid()
    and o.product_id is not null
    and o.order_name is distinct from '배송비';
grant select on public.affiliate_sales_view to authenticated;

-- 9) 월 정산 — host_settlements 와 동일 구조(본인 select 만, 생성/지급확정은 관리자 함수)
create table if not exists public.affiliate_settlements (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  period text not null,                               -- 'YYYY-MM'
  total_sales bigint not null default 0,              -- 결제완료 이상 순매출(취소 제외)
  tier_id uuid references public.affiliate_tiers(id) on delete set null,
  tier_name text,
  commission_rate numeric(5,2) not null default 0,
  commission_amount bigint not null default 0,        -- round(total_sales * rate/100)
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (affiliate_id, period)
);
alter table public.affiliate_settlements enable row level security;
drop policy if exists "affiliate_settlements_select_own" on public.affiliate_settlements;
create policy "affiliate_settlements_select_own" on public.affiliate_settlements
  for select using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));

create or replace function public.admin_generate_affiliate_settlement(
  p_affiliate_id uuid,
  p_period text,
  p_dry_run boolean default false
)
returns public.affiliate_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end   timestamptz := v_start + interval '1 month';
  v_total bigint;
  v_tier_id uuid; v_tier_name text; v_rate numeric(5,2);
  v_commission bigint;
  v_existing_status text;
  v_row public.affiliate_settlements;
begin
  if not public.is_admin() then raise exception '관리자만 실행할 수 있습니다.'; end if;

  select status into v_existing_status from public.affiliate_settlements
  where affiliate_id = p_affiliate_id and period = p_period;
  if v_existing_status = 'paid' then
    raise exception '이미 지급 완료된 정산입니다. (affiliate_id=%, period=%)', p_affiliate_id, p_period;
  end if;

  select coalesce(sum(o.amount), 0) into v_total
  from public.orders o
  join public.affiliate_links l on l.code = o.affiliate_code
  where l.affiliate_id = p_affiliate_id
    and o.product_id is not null
    and o.status in ('paid', 'shipped', 'done')
    and o.created_at >= v_start and o.created_at < v_end;

  select id, name, commission_rate into v_tier_id, v_tier_name, v_rate
  from public.affiliate_tiers where min_sales <= v_total
  order by min_sales desc limit 1;
  if v_rate is null then v_rate := 5.00; v_tier_name := '기본'; end if;

  v_commission := round(v_total * v_rate / 100);

  if p_dry_run then
    v_row.affiliate_id := p_affiliate_id; v_row.period := p_period; v_row.total_sales := v_total;
    v_row.tier_id := v_tier_id; v_row.tier_name := v_tier_name; v_row.commission_rate := v_rate;
    v_row.commission_amount := v_commission; v_row.status := 'pending';
    return v_row;
  end if;

  insert into public.affiliate_settlements (affiliate_id, period, total_sales, tier_id, tier_name, commission_rate, commission_amount)
  values (p_affiliate_id, p_period, v_total, v_tier_id, v_tier_name, v_rate, v_commission)
  on conflict (affiliate_id, period) do update
    set total_sales = excluded.total_sales, tier_id = excluded.tier_id, tier_name = excluded.tier_name,
        commission_rate = excluded.commission_rate, commission_amount = excluded.commission_amount
  returning * into v_row;
  return v_row;
end $$;
revoke all on function public.admin_generate_affiliate_settlement(uuid, text, boolean) from public;
grant execute on function public.admin_generate_affiliate_settlement(uuid, text, boolean) to authenticated;

create or replace function public.admin_mark_affiliate_settlement_paid(p_id uuid)
returns public.affiliate_settlements
language plpgsql security definer set search_path = public as $$
declare v_row public.affiliate_settlements;
begin
  if not public.is_admin() then raise exception '관리자만 실행할 수 있습니다.'; end if;
  update public.affiliate_settlements set status = 'paid', paid_at = now()
  where id = p_id and status = 'pending' returning * into v_row;
  if v_row.id is null then raise exception '대기 중인 정산이 아닙니다.'; end if;
  return v_row;
end $$;
revoke all on function public.admin_mark_affiliate_settlement_paid(uuid) from public;
grant execute on function public.admin_mark_affiliate_settlement_paid(uuid) to authenticated;

-- 10) 셀러 본인 요약 — 이달 매출·예상 수수료·등급을 한 번에(화면 상단 카드용)
create or replace function public.my_affiliate_summary(p_period text default to_char(now(), 'YYYY-MM'))
returns table (period text, total_sales bigint, order_count bigint, tier_name text, commission_rate numeric, estimated_commission bigint, next_tier_name text, next_tier_min_sales bigint, link_count bigint, click_count bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_aff_id uuid; v_start timestamptz := to_date(p_period || '-01', 'YYYY-MM-DD'); v_end timestamptz;
begin
  v_end := v_start + interval '1 month';
  select id into v_aff_id from public.affiliates where user_id = auth.uid();
  if v_aff_id is null then return; end if;

  return query
  with s as (
    select coalesce(sum(o.amount), 0)::bigint as total, count(distinct o.payment_id)::bigint as cnt
    from public.orders o join public.affiliate_links l on l.code = o.affiliate_code
    where l.affiliate_id = v_aff_id and o.product_id is not null
      and o.status in ('paid', 'shipped', 'done') and o.created_at >= v_start and o.created_at < v_end
  ),
  t as (select name, commission_rate from public.affiliate_tiers, s where min_sales <= s.total order by min_sales desc limit 1),
  n as (select name, min_sales from public.affiliate_tiers, s where min_sales > s.total order by min_sales asc limit 1),
  lk as (select count(*)::bigint as links, coalesce(sum(clicks), 0)::bigint as clicks from public.affiliate_links where affiliate_id = v_aff_id)
  select p_period, s.total, s.cnt, coalesce(t.name, '기본'), coalesce(t.commission_rate, 5.00),
         round(s.total * coalesce(t.commission_rate, 5.00) / 100)::bigint, n.name, n.min_sales, lk.links, lk.clicks
  from s left join t on true left join n on true cross join lk;
end $$;
revoke all on function public.my_affiliate_summary(text) from public;
grant execute on function public.my_affiliate_summary(text) to authenticated;

notify pgrst, 'reload schema';
