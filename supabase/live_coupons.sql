-- 라이브 한정 쿠폰/특가
-- 라이브 1건당 쿠폰 1개(live_id unique). 시청자는 읽기만(배너 노출용), 파트너 본인만 생성/수정.
-- 실행: Supabase 대시보드(beautyground-main) → SQL Editor 에 붙여넣고 Run

create table if not exists public.live_coupons (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null unique references public.lives(id) on delete cascade,
  discount_type text not null check (discount_type in ('amount', 'percent')),
  discount_value integer not null check (discount_value > 0),
  min_purchase integer not null default 0,
  qty_limit integer,               -- null = 무제한
  qty_used integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.live_coupons enable row level security;

drop policy if exists "live_coupons_public_read" on public.live_coupons;
create policy "live_coupons_public_read" on public.live_coupons
  for select using (true);

drop policy if exists "live_coupons_partner_write" on public.live_coupons;
create policy "live_coupons_partner_write" on public.live_coupons
  for all using (
    exists (
      select 1 from public.lives l
      join public.partners p on p.id = l.partner_id
      where l.id = live_coupons.live_id and p.user_id = auth.uid()
    )
  );

-- 원자적 사용: 조건(활성·최소구매액·잔여수량) 통과 시에만 qty_used +1 하고 그 행을 반환.
-- 조건 불충족이면 아무 행도 반환하지 않음(빈 결과) — 애플리케이션이 "쿠폰 소진/미충족"으로 처리.
create or replace function public.redeem_live_coupon(p_live_id uuid, p_subtotal integer)
returns setof public.live_coupons
language sql
security definer
set search_path = public
as $$
  update public.live_coupons
  set qty_used = qty_used + 1
  where live_id = p_live_id
    and active
    and p_subtotal >= min_purchase
    and (qty_limit is null or qty_used < qty_limit)
  returning *;
$$;

grant execute on function public.redeem_live_coupon(uuid, integer) to anon, authenticated;

-- 결제가 그 자리에서 취소/실패한 경우(리다이렉트 없는 동기 경로) 소진된 수량을 되돌림.
-- 모바일 간편결제처럼 페이지를 벗어났다 돌아오는 흐름은 클라이언트 상태가 유실돼 이 함수가 호출되지 않을 수 있음(알려진 한계).
create or replace function public.release_live_coupon(p_live_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.live_coupons
  set qty_used = greatest(qty_used - 1, 0)
  where live_id = p_live_id;
$$;

grant execute on function public.release_live_coupon(uuid) to anon, authenticated;
