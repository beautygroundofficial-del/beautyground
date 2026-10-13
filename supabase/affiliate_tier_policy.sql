-- 파트너스 수수료 정책 반영 — 2026-10-14 (대표님 확정)
--  · 기본 5%는 첫 판매부터(현행 유지), 판매한 만큼 전부 지급(최소 지급액 없음), 지급일 익월 10일
--  · 실버(10%) 기준을 월 50만원 → 월 25만원으로 낮춤. 골드 150만·플래티넘 500만은 그대로
--  · 본인 구매(파트너가 자기 링크로 산 주문)는 수수료·등급 집계에서 제외 — 정산 함수와 내 요약 함수 둘 다
-- 함수 두 개는 운영 DB 정의(2026-10-14 조회·백업)를 그대로 복사해 조건 한 줄씩만 추가했다.
-- 집계 상태(paid/shipped/done)는 바꾸지 않았다: done(배송완료)은 관리자가 수동으로 바꾸는 상태라 자동 구매확정이 없어
--   '구매확정만 집계'로 하면 파트너가 못 받을 수 있다. 지급 시점(익월 10일)에 취소·환불 건은 이미 제외된다.
-- 지금은 제휴 주문·정산이 0건이라 기존 정산에 영향 없음.
begin;

update public.affiliate_tiers set min_sales = 250000 where name = '실버' and min_sales = 500000;

CREATE OR REPLACE FUNCTION public.admin_generate_affiliate_settlement(p_affiliate_id uuid, p_period text, p_dry_run boolean DEFAULT false)
 RETURNS affiliate_settlements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    and o.user_id is distinct from (select af.user_id from public.affiliates af where af.id = p_affiliate_id)  -- 본인 구매 제외
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
end $function$;

CREATE OR REPLACE FUNCTION public.my_affiliate_summary(p_period text DEFAULT to_char(now(), 'YYYY-MM'::text))
 RETURNS TABLE(period text, total_sales bigint, order_count bigint, tier_name text, commission_rate numeric, estimated_commission bigint, next_tier_name text, next_tier_min_sales bigint, link_count bigint, click_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
-- ↑ returns table 의 열 이름(commission_rate 등)이 affiliate_tiers 열과 겹쳐 "ambiguous" 오류(2026-09-26 운영 테스트) — 본문에서는 항상 테이블 열로 해석
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
    where l.affiliate_id = v_aff_id and o.product_id is not null and o.user_id is distinct from auth.uid()  -- 본인 구매 제외
      and o.status in ('paid', 'shipped', 'done') and o.created_at >= v_start and o.created_at < v_end
  ),
  t as (select name, commission_rate from public.affiliate_tiers, s where min_sales <= s.total order by min_sales desc limit 1),
  n as (select name, min_sales from public.affiliate_tiers, s where min_sales > s.total order by min_sales asc limit 1),
  lk as (select count(*)::bigint as links, coalesce(sum(clicks), 0)::bigint as clicks from public.affiliate_links where affiliate_id = v_aff_id)
  select p_period, s.total, s.cnt, coalesce(t.name, '기본'), coalesce(t.commission_rate, 5.00),
         round(s.total * coalesce(t.commission_rate, 5.00) / 100)::bigint, n.name, n.min_sales, lk.links, lk.clicks
  from s left join t on true left join n on true cross join lk;
end $function$;

notify pgrst, 'reload schema';
commit;

-- 롤백: update public.affiliate_tiers set min_sales = 500000 where name = '실버';
--       두 함수는 백업(C:/temp/affiliate_backup/affiliate_functions_before_20261014.json)의 정의로 create or replace
