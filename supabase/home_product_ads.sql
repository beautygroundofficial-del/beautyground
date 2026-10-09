-- Home advertising pilot. Apply only after approval; existing commerce data is untouched.
begin;

create table public.home_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  product_id uuid references public.products(id),
  rotation_hour timestamptz,
  active boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create unique index home_ad_one_active on public.home_ad_campaigns ((true)) where active;
alter table public.home_ad_campaigns enable row level security;
revoke all on public.home_ad_campaigns from anon, authenticated;
grant select, update(active) on public.home_ad_campaigns to authenticated;
create policy home_ad_campaigns_admin_read on public.home_ad_campaigns for select to authenticated using (public.is_admin());
create policy home_ad_campaigns_admin_update on public.home_ad_campaigns for update to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.home_ad_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.home_ad_campaigns(id),
  product_id uuid not null references public.products(id),
  slot_at timestamptz not null,
  session_id uuid not null,
  kind text not null check (kind in ('impression', 'popup_open', 'product_click')),
  occurred_at timestamptz not null default now(),
  event_day date not null default ((now() at time zone 'Asia/Seoul')::date),
  unique (campaign_id, product_id, slot_at, session_id, kind)
);
create index home_ad_events_period on public.home_ad_events (occurred_at, campaign_id);
alter table public.home_ad_events enable row level security;
revoke all on public.home_ad_events from anon, authenticated;
revoke all on sequence public.home_ad_events_id_seq from anon, authenticated;
-- No direct client inserts/reads. Only validated recording and admin aggregate RPCs.

create function public.get_active_home_ad()
returns table (campaign_id uuid, campaign_name text, product_id uuid, product_name text, brand text, price numeric, sale_price numeric, thumbnail_url text, ends_at timestamptz, slot_at timestamptz, refresh_after_seconds numeric)
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign public.home_ad_campaigns%rowtype;
  v_product uuid;
  v_hour timestamptz := date_trunc('hour', now(), 'Asia/Seoul');
begin
  -- The first visitor each hour selects once. Row locking keeps concurrent visitors consistent.
  -- No worker, browser timer or operator needs to stay running for the hourly change.
  select c.* into v_campaign from public.home_ad_campaigns c
  where c.active and c.starts_at <= now() and c.ends_at > now()
  order by c.created_at desc limit 1 for update;
  if not found then return; end if;
  if v_campaign.rotation_hour is distinct from v_hour then
    select p.id into v_product from public.products p
    where p.status = 'on_sale' and p.stock > 0 and nullif(p.thumbnail_url, '') is not null
      and coalesce(p.sale_price, p.price) > 0
      and (not exists (select 1 from public.product_options o where o.product_id = p.id)
           or exists (select 1 from public.product_options o where o.product_id = p.id and o.in_stock))
    order by (p.id is not distinct from v_campaign.product_id), random() limit 1;
    update public.home_ad_campaigns c set product_id = v_product, rotation_hour = v_hour
    where c.id = v_campaign.id;
  end if;
  return query
    select c.id, c.name, p.id, p.name::text, p.brand::text, p.price::numeric,
      p.sale_price::numeric, p.thumbnail_url::text, least(c.ends_at, v_hour + interval '1 hour'),
      v_hour, extract(epoch from least(c.ends_at, v_hour + interval '1 hour') - now())
    from public.home_ad_campaigns c join public.products p on p.id = c.product_id
    where c.id = v_campaign.id and p.status = 'on_sale' and p.stock > 0
      and nullif(p.thumbnail_url, '') is not null and coalesce(p.sale_price, p.price) > 0
      and (not exists (select 1 from public.product_options o where o.product_id = p.id)
           or exists (select 1 from public.product_options o where o.product_id = p.id and o.in_stock));
end;
$$;

create function public.record_home_ad_event(p_campaign_id uuid, p_product_id uuid, p_slot_at timestamptz, p_session_id uuid, p_kind text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_campaign_id is null or p_product_id is null or p_slot_at is null or p_session_id is null or p_kind is null
     or p_kind not in ('impression', 'popup_open', 'product_click') then return false; end if;
  if coalesce(public.is_admin(), false) then return false; end if;
  if not exists (
    select 1 from public.home_ad_campaigns c join public.products p on p.id = c.product_id
    where c.id = p_campaign_id and c.active and c.starts_at <= now() and c.ends_at > now()
      and c.product_id = p_product_id and c.rotation_hour = p_slot_at
      and p_slot_at = date_trunc('hour', now(), 'Asia/Seoul')
      and p.status = 'on_sale' and p.stock > 0 and nullif(p.thumbnail_url, '') is not null
      and coalesce(p.sale_price, p.price) > 0
      and (not exists (select 1 from public.product_options o where o.product_id = p.id)
           or exists (select 1 from public.product_options o where o.product_id = p.id and o.in_stock))
  ) then return false; end if;
  if p_kind <> 'impression' and not exists (
    select 1 from public.home_ad_events e where e.campaign_id = p_campaign_id
      and e.product_id = p_product_id and e.slot_at = p_slot_at
      and e.session_id = p_session_id and e.kind = 'impression'
  ) then return false; end if;
  if p_kind = 'product_click' and not exists (
    select 1 from public.home_ad_events e where e.campaign_id = p_campaign_id
      and e.product_id = p_product_id and e.slot_at = p_slot_at
      and e.session_id = p_session_id and e.kind = 'popup_open'
  ) then return false; end if;
  insert into public.home_ad_events(campaign_id, product_id, slot_at, session_id, kind, event_day)
  values (p_campaign_id, p_product_id, p_slot_at, p_session_id, p_kind, v_day) on conflict do nothing;
  return true;
end;
$$;

create function public.admin_home_ad_summary(p_from timestamptz, p_to timestamptz)
returns table (campaign_id uuid, campaign_name text, product_id uuid, product_name text, active boolean, starts_at timestamptz, ends_at timestamptz, impressions bigint, popup_opens bigint, product_clicks bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception '관리자만 조회할 수 있습니다.'; end if;
  if p_from is null or p_to is null or p_to <= p_from then raise exception '조회 기간을 확인해 주세요.'; end if;
  return query
    select c.id, c.name, p.id, coalesce(p.name::text, '첫 광고 준비 중'), c.active, c.starts_at, c.ends_at,
      count(e.id) filter (where e.kind = 'impression'),
      count(e.id) filter (where e.kind = 'popup_open'),
      count(e.id) filter (where e.kind = 'product_click')
    from public.home_ad_campaigns c
    left join public.home_ad_events e on e.campaign_id = c.id and e.occurred_at >= p_from and e.occurred_at < p_to
    left join public.products p on p.id = coalesce(e.product_id, c.product_id)
    group by c.id, p.id, p.name order by c.created_at desc, count(e.id) desc;
end;
$$;

revoke all on function public.get_active_home_ad() from public, anon, authenticated;
revoke all on function public.record_home_ad_event(uuid, uuid, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_home_ad_summary(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_active_home_ad() to anon, authenticated;
grant execute on function public.record_home_ad_event(uuid, uuid, timestamptz, uuid, text) to anon, authenticated;
grant execute on function public.admin_home_ad_summary(timestamptz, timestamptz) to authenticated;

-- Hourly random promotion. Seven-day internal pilot; no billing.
insert into public.home_ad_campaigns (name, active, starts_at, ends_at)
values ('매시간 랜덤 상품 · 홈 광고 자체 테스트', true, now(), now() + interval '7 days');

notify pgrst, 'reload schema';
commit;
