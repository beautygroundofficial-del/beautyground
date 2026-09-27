-- 앱 전체 기능 점검(2026-09-27) 후속 — 운영 DB 권한 정리 1건.
-- 근거: 옵시디언 `03 홈페이지/앱 전체 기능 점검 — 문제점 종합 (2026-09-27).md` 🔴 1·2·3·7·8, 🟡 13·14·18·20.
-- 운영 pg_policies 를 직접 조회해 현재 정책명·조건을 확인한 뒤 작성했다(저장소 SQL과 운영이 다른 곳이 있어서).
-- 실행: 대표님 승인 후 scripts/db_query.mjs 로 1회. 전부 idempotent(재실행 안전).

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) orders — 누구나 아무 상태로 주문 행을 넣을 수 있던 옛 정책 제거 + 회원 삽입은 pending 만
-- ─────────────────────────────────────────────────────────────────────────────
-- 운영에 남아 있던 `orders insert`(WITH CHECK true)는 저장소 어디에도 없는 옛 정책. 삭제.
drop policy if exists "orders insert" on public.orders;

-- 회원 주문 삽입: 본인 user_id + status='pending' 만. (결제 확정(paid)은 서버 api/payment-complete 가 service role 로 처리)
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert with check (auth.uid() = user_id and status = 'pending');
-- 비회원 삽입 정책("비회원 주문 접수": user_id null + pending, anon)은 이미 충분히 좁아 그대로 둔다.

-- 파트너(브랜드) UPDATE: with_check 추가(자기 브랜드 행 밖으로 옮기기 금지) + 아래 트리거로 컬럼 제한
drop policy if exists orders_update_partner on public.orders;
create policy orders_update_partner on public.orders
  for update
  using (partner_id in (select id from public.partners where user_id = auth.uid()))
  with check (partner_id in (select id from public.partners where user_id = auth.uid()));

-- 관리자·서버(service role, auth.uid() null)가 아닌 로그인 사용자의 orders UPDATE 는
-- 배송 관련 컬럼과 상태 전이(pending→failed, paid→shipped→done)만 허용. 금액·상품·수량·구매자·결제ID 변경 금지.
create or replace function public.orders_guard_nonadmin_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 서버(service role)·anon 은 auth.uid() 가 null → 그대로 통과(각자 RLS 정책으로 이미 제한됨)
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.amount      is distinct from old.amount
  or new.quantity    is distinct from old.quantity
  or new.product_id  is distinct from old.product_id
  or new.partner_id  is distinct from old.partner_id
  or new.user_id     is distinct from old.user_id
  or new.payment_id  is distinct from old.payment_id
  or new.pg_tx_id    is distinct from old.pg_tx_id
  or new.live_id     is distinct from old.live_id
  or new.order_name  is distinct from old.order_name
  or new.option_label is distinct from old.option_label
  or new.buyer_name  is distinct from old.buyer_name
  or new.buyer_phone is distinct from old.buyer_phone
  or new.buyer_email is distinct from old.buyer_email
  or new.affiliate_code is distinct from old.affiliate_code
  or new.created_at  is distinct from old.created_at then
    raise exception '주문의 금액·상품·구매자·결제 정보는 수정할 수 없습니다.';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status = 'failed') or
      (old.status = 'paid'    and new.status in ('shipped', 'done')) or
      (old.status = 'shipped' and new.status = 'done')
    ) then
      raise exception '허용되지 않는 주문 상태 변경입니다. (% → %)', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_nonadmin_update on public.orders;
create trigger orders_guard_nonadmin_update
  before update on public.orders
  for each row execute function public.orders_guard_nonadmin_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) dept_accounts — 백화점 계정 셀프 가입 차단
-- ─────────────────────────────────────────────────────────────────────────────
-- 가입은 claim_dept_account(p_code) / claim_dept_account_by_id(p_id) 함수(관리자가 미리 만든 행에 연결)로만 이뤄지고,
-- 클라이언트 코드(src/)에 dept_accounts insert 가 없음을 확인(2026-09-27). 정책만 제거.
drop policy if exists dept_accounts_insert_own on public.dept_accounts;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) home_settings / hosts — "로그인만 하면" 이던 정책을 관리자 전용으로
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists home_settings_admin_write on public.home_settings;
create policy home_settings_admin_write on public.home_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- 진행자 전체(전화·이메일 포함) 조회는 관리자만. 본인(hosts_select_own)·활성 진행자 공개(hosts_select_public)는 그대로.
drop policy if exists hosts_select_admin on public.hosts;
create policy hosts_select_admin on public.hosts
  for select using (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) 커뮤니티 6개 테이블 — 신고로 숨긴(hidden) 글·댓글을 작성자가 다시 보이게 못 하도록
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.community_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if old.status = 'hidden' and new.status is distinct from 'hidden' then
    raise exception '운영자가 숨긴 글은 작성자가 되돌릴 수 없습니다.';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['board_posts','board_comments','diaries','diary_comments','answer_comments','daily_answers'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_status', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.community_guard_status()', t || '_guard_status', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) get_member_count — 저장소(member_count.sql)에는 있는데 운영에 없어 모든 화면에서 404 콘솔 오류
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_member_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select 7321 + (
    select count(*)::int from auth.users
    where created_at >= '2026-09-13T00:00:00+09:00'
  );
$$;
grant execute on function public.get_member_count() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) 라이브 쿠폰 — release 가 무제한(누구나 qty_used -1)이던 것을 "내가 소진한 것만 1회 되돌리기"로
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.live_coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  live_id     uuid not null references public.lives(id) on delete cascade,
  user_id     uuid,                         -- 로그인 사용자면 auth.uid()
  token       text,                         -- 비회원 구분용(클라이언트가 결제 1회마다 생성)
  created_at  timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists idx_live_coupon_redemptions_live on public.live_coupon_redemptions(live_id, released_at);
alter table public.live_coupon_redemptions enable row level security;
-- 정책 없음: 아래 security definer 함수로만 읽고 쓴다.

-- 시그니처 변경(p_token 추가, 기본값 null) — 기존 2인자 호출도 그대로 동작한다.
drop function if exists public.redeem_live_coupon(uuid, integer);
create or replace function public.redeem_live_coupon(p_live_id uuid, p_subtotal integer, p_token text default null)
returns setof public.live_coupons
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.live_coupons;
begin
  update public.live_coupons
  set qty_used = qty_used + 1
  where live_id = p_live_id
    and active
    and p_subtotal >= min_purchase
    and (qty_limit is null or qty_used < qty_limit)
  returning * into v;

  if v.id is null then
    return;
  end if;

  insert into public.live_coupon_redemptions (live_id, user_id, token)
  values (p_live_id, auth.uid(), p_token);

  return next v;
end;
$$;
grant execute on function public.redeem_live_coupon(uuid, integer, text) to anon, authenticated;

drop function if exists public.release_live_coupon(uuid);
create or replace function public.release_live_coupon(p_live_id uuid, p_token text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- 최근 2시간 안에 내가(로그인 uid 또는 토큰) 소진한, 아직 되돌리지 않은 기록 1건만 되돌린다
  select id into v_id
  from public.live_coupon_redemptions
  where live_id = p_live_id
    and released_at is null
    and created_at > now() - interval '2 hours'
    and (
      (auth.uid() is not null and user_id = auth.uid())
      or (p_token is not null and token = p_token)
      -- 배포 전 구버전 화면(토큰 없음)의 비회원 호출 호환 — 실제 소진 기록 수 안에서만 되돌려진다
      or (auth.uid() is null and p_token is null and user_id is null and token is null)
    )
  order by created_at desc
  limit 1
  for update skip locked;

  if v_id is null then
    return;
  end if;

  update public.live_coupon_redemptions set released_at = now() where id = v_id;
  update public.live_coupons set qty_used = greatest(qty_used - 1, 0) where live_id = p_live_id;
end;
$$;
grant execute on function public.release_live_coupon(uuid, text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) 브랜드 정산 — 라이브 쿠폰 할인 반영
-- ─────────────────────────────────────────────────────────────────────────────
-- 라이브 쿠폰은 브랜드가 자기 라이브에 직접 설정(live_coupons_partner_write)하므로 할인분은 브랜드 매출에서 차감돼야 한다.
-- 주문 저장 시 '라이브 쿠폰 할인' 행은 partner_id 가 null 이고 live_id 만 있어, lives.partner_id 로 브랜드를 찾아 합산.
-- (진행자 정산 admin_generate_host_settlement 는 이미 live_id 조인으로 자동 상쇄되고 있어 그쪽과 일치하게 됨)
-- 적립금 사용·가입 쿠폰(회사 부담) 행은 종전처럼 브랜드 정산에 넣지 않는다.
create or replace function public.admin_generate_partner_settlement(
  p_partner_id uuid,
  p_period text,
  p_dry_run boolean default false
)
returns public.settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start timestamptz := to_date(p_period || '-01', 'YYYY-MM-DD');
  v_end   timestamptz := v_start + interval '1 month';
  v_total bigint;
  v_coupon bigint;
  v_rate numeric(5,2);
  v_commission bigint;
  v_payout bigint;
  v_existing_status text;
  v_row public.settlements;
begin
  if not public.is_admin() then
    raise exception '관리자만 정산을 생성할 수 있습니다.';
  end if;

  select status into v_existing_status
  from public.settlements
  where partner_id = p_partner_id and period = p_period;

  if v_existing_status = 'paid' then
    raise exception '이미 지급 완료된 정산입니다. (partner_id=%, period=%)', p_partner_id, p_period;
  end if;

  -- 상품 매출(배송비 행 제외)
  select coalesce(sum(o.amount), 0) into v_total
  from public.orders o
  where o.partner_id = p_partner_id
    and o.status in ('paid', 'shipped', 'done')
    and o.product_id is not null
    and coalesce(o.order_name, '') is distinct from '배송비'
    and o.created_at >= v_start
    and o.created_at < v_end;

  -- 이 브랜드 라이브의 라이브 쿠폰 할인(음수 금액 행) — 브랜드 부담
  select coalesce(sum(o.amount), 0) into v_coupon
  from public.orders o
  join public.lives l on l.id = o.live_id
  where l.partner_id = p_partner_id
    and o.product_id is null
    and o.order_name = '라이브 쿠폰 할인'
    and o.status in ('paid', 'shipped', 'done')
    and o.created_at >= v_start
    and o.created_at < v_end;

  v_total := v_total + v_coupon;   -- v_coupon 은 0 또는 음수

  select commission_rate into v_rate from public.partners where id = p_partner_id;
  v_rate := coalesce(v_rate, 0);
  v_commission := round(v_total * v_rate / 100);
  v_payout := v_total - v_commission;

  if p_dry_run then
    v_row.partner_id := p_partner_id;
    v_row.period := p_period;
    v_row.total_sales := v_total;
    v_row.commission := v_commission;
    v_row.payout_amount := v_payout;
    v_row.status := 'pending';
    return v_row;
  end if;

  insert into public.settlements (partner_id, period, total_sales, commission, payout_amount, status)
  values (p_partner_id, p_period, v_total, v_commission, v_payout, 'pending')
  on conflict (partner_id, period) do update
    set total_sales = excluded.total_sales,
        commission = excluded.commission,
        payout_amount = excluded.payout_amount
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.admin_generate_partner_settlement(uuid, text, boolean) from public;
grant execute on function public.admin_generate_partner_settlement(uuid, text, boolean) to authenticated;

commit;
