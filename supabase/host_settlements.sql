-- 진행자 정산: 등급별 수수료 스냅샷 저장 + 생성/지급확정용 관리자 함수.
-- 이 테이블에는 "본인 것만" select 정책만 둔다(관리자용 블랭킷 정책을 일부러 만들지 않음) —
-- host_settlements는 개인 정산 금액이라 hosts/commission_tiers보다 한 단계 더 엄격하게 격리한다.
-- 관리자의 생성/전체조회/지급확정은 모두 아래 SECURITY DEFINER 함수를 통해서만 가능하다.
-- 실행: hosts.sql, commission_tiers.sql 적용 이후 Supabase 대시보드(beautyground-main) → SQL Editor 에서 Run

create table if not exists public.host_settlements (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts(id) on delete cascade,
  period text not null,                              -- 'YYYY-MM'
  total_sales bigint not null default 0,              -- 해당 기간 이 진행자 방송의 순매출(취소/쿠폰 자동 상쇄 반영)
  tier_id uuid references public.commission_tiers(id) on delete set null,
  tier_name text,                                     -- 생성 시점 등급명 스냅샷(등급명이 나중에 바뀌어도 불변)
  commission_rate numeric(5,2) not null default 0,    -- 생성 시점 수수료율 스냅샷
  commission_amount bigint not null default 0,        -- 진행자에게 지급할 금액 = round(total_sales * commission_rate/100)
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (host_id, period)
);

alter table public.host_settlements enable row level security;

-- 진행자 본인: 자기 정산 내역만 조회 (관리자용 블랭킷 정책 없음 — 이게 이 테이블의 유일한 select 정책)
drop policy if exists "host_settlements_select_own" on public.host_settlements;
create policy "host_settlements_select_own" on public.host_settlements
  for select using (
    host_id in (select id from public.hosts where user_id = auth.uid())
  );

-- 정산 생성/갱신: 매출 집계 + 등급 판정 + 스냅샷 저장을 원자적으로 처리.
-- p_dry_run=true 면 저장하지 않고 계산 결과만 반환(관리자 화면의 "미리보기"용).
-- 이미 지급 완료(status='paid')된 정산은 재생성 자체를 막아서(예외 발생) 실수로 금액이
-- 바뀌는 사고를 방지한다.
create or replace function public.admin_generate_host_settlement(
  p_host_id uuid,
  p_period text,
  p_dry_run boolean default false
)
returns public.host_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end   timestamptz := v_start + interval '1 month';
  v_total bigint;
  v_tier_id uuid;
  v_tier_name text;
  v_rate numeric(5,2);
  v_commission bigint;
  v_existing_status text;
  v_row public.host_settlements;
begin
  select status into v_existing_status
  from public.host_settlements
  where host_id = p_host_id and period = p_period;

  if v_existing_status = 'paid' then
    raise exception '이미 지급 완료된 정산입니다. (host_id=%, period=%)', p_host_id, p_period;
  end if;

  -- 순매출 집계: 이 진행자가 host_id로 지정된 라이브들의 결제완료 이상 주문 합산.
  -- 라이브 쿠폰 할인은 별도 음수 amount 행으로 저장되므로 그대로 합산하면 자동 상쇄된다
  -- (Dashboard.tsx의 기존 매출 집계 관례와 동일한 status 필터).
  select coalesce(sum(o.amount), 0) into v_total
  from public.orders o
  join public.lives l on l.id = o.live_id
  where l.host_id = p_host_id
    and o.status in ('paid', 'shipped', 'done')
    and o.created_at >= v_start
    and o.created_at < v_end;

  -- 등급 판정: 매출 기준(min_sales)을 만족하는 가장 높은 등급 선택
  select id, name, commission_rate into v_tier_id, v_tier_name, v_rate
  from public.commission_tiers
  where min_sales <= v_total
  order by min_sales desc
  limit 1;

  v_rate := coalesce(v_rate, 0);
  v_commission := round(v_total * v_rate / 100);

  if p_dry_run then
    v_row.host_id := p_host_id;
    v_row.period := p_period;
    v_row.total_sales := v_total;
    v_row.tier_id := v_tier_id;
    v_row.tier_name := v_tier_name;
    v_row.commission_rate := v_rate;
    v_row.commission_amount := v_commission;
    v_row.status := 'pending';
    return v_row;
  end if;

  insert into public.host_settlements
    (host_id, period, total_sales, tier_id, tier_name, commission_rate, commission_amount, status)
  values
    (p_host_id, p_period, v_total, v_tier_id, v_tier_name, v_rate, v_commission, 'pending')
  on conflict (host_id, period) do update
    set total_sales = excluded.total_sales,
        tier_id = excluded.tier_id,
        tier_name = excluded.tier_name,
        commission_rate = excluded.commission_rate,
        commission_amount = excluded.commission_amount
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_generate_host_settlement(uuid, text, boolean) from public;
grant execute on function public.admin_generate_host_settlement(uuid, text, boolean) to authenticated;

-- 지급 완료 처리: pending 상태만 paid로 전이 가능(이중 지급 클릭 등의 실수 방지)
create or replace function public.admin_mark_host_settlement_paid(p_settlement_id uuid)
returns public.host_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.host_settlements;
begin
  update public.host_settlements
  set status = 'paid', paid_at = now()
  where id = p_settlement_id and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception '대기 중인 정산만 지급 완료 처리할 수 있습니다. (id=%)', p_settlement_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.admin_mark_host_settlement_paid(uuid) from public;
grant execute on function public.admin_mark_host_settlement_paid(uuid) to authenticated;

-- 관리자 전체 조회: host_settlements 테이블 자체엔 관리자용 select 정책이 없으므로
-- 이 함수(SECURITY DEFINER)로만 전체 목록을 볼 수 있다. 호스트 이름을 조인해서 반환.
create or replace function public.admin_list_host_settlements()
returns table (
  id uuid,
  host_id uuid,
  host_name text,
  period text,
  total_sales bigint,
  tier_name text,
  commission_rate numeric,
  commission_amount bigint,
  status text,
  paid_at timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    hs.id, hs.host_id, h.name as host_name, hs.period, hs.total_sales,
    hs.tier_name, hs.commission_rate, hs.commission_amount, hs.status, hs.paid_at, hs.created_at
  from public.host_settlements hs
  join public.hosts h on h.id = hs.host_id
  order by hs.created_at desc;
$$;

revoke all on function public.admin_list_host_settlements() from public;
grant execute on function public.admin_list_host_settlements() to authenticated;

notify pgrst, 'reload schema';
