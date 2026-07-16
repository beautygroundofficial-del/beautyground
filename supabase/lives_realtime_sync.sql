-- 라이브 방송 실시간 동기화: '지금 판매' 하이라이트 + 공지핀
-- 판매자(LiveDetail)가 lives 행을 갱신하면 시청자(ShopLiveWatch)가 Realtime 으로 즉시 반영받는다.
-- 실행: Supabase 대시보드(beautyground-main) → SQL Editor 에 붙여넣고 Run

alter table public.lives
  add column if not exists highlight_product_id uuid references public.products(id) on delete set null;

alter table public.lives
  add column if not exists pinned_message text;

-- 시청자 화면 실시간 반영을 위해 lives 를 realtime 발행에 추가 (이미 있으면 무시)
do $$
begin
  alter publication supabase_realtime add table public.lives;
exception when duplicate_object then
  null;
end $$;
