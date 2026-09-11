-- 속 이야기 카테고리 추가 1번째 — 갱년기 이야기 (2026-09-12)
-- 대표님 지시: "카테고리가 많지 않으니 하나씩 늘려보자, 정확한 위치는 연구하면서"
-- 근거(옵시디언 03 홈페이지/4050~60대 여성 관심사 리서치): 50대 여성 최대 관심사가
-- 갱년기·노후불안인데, 기존 'body'(건강·체력·운동)엔 안 묻어나 못 찾던 것으로 보임.
-- ⚠️ 미실행 — 내용 보고 후 승인받아야 운영 DB(beautyground-main)에 실행한다.

-- 1) 테이블 체크 제약 갱신
alter table public.board_posts drop constraint if exists board_posts_category_check;
alter table public.board_posts add constraint board_posts_category_check
  check (category in ('kids','spouse','parents','body','menopause','mind','living','chat'));

-- 2) create_board_post 검증 목록 갱신 (community_media_edit.sql의 5-인자 버전을 그대로 갱신)
create or replace function public.create_board_post(
  p_category text,
  p_content  text,
  p_images   text[] default '{}',
  p_nickname text default null,
  p_video    text default null
)
returns table (post_id uuid, awarded integer, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_claim record;
begin
  if v_uid is null then
    return query select null::uuid, 0, '로그인이 필요합니다'::text; return;
  end if;
  if p_category not in ('kids','spouse','parents','body','menopause','mind','living','chat') then
    return query select null::uuid, 0, '이야기 종류를 골라주세요'::text; return;
  end if;
  if p_content is null or length(btrim(p_content)) < 10 then
    return query select null::uuid, 0, '10자 이상 적어주세요'::text; return;
  end if;
  if length(p_content) > 2000 then
    return query select null::uuid, 0, '2000자 안으로 적어주세요'::text; return;
  end if;

  insert into public.board_posts (user_id, nickname, category, content, images, video_url)
  values (v_uid, p_nickname, p_category, btrim(p_content), coalesce(p_images, '{}'), nullif(btrim(coalesce(p_video, '')), ''))
  returning id into v_id;

  select * into v_claim from public.claim_mission('board_post', 1);
  return query select v_id, coalesce(v_claim.awarded, 0), ''::text;
end;
$$;

revoke all on function public.create_board_post(text, text, text[], text, text) from public;
grant execute on function public.create_board_post(text, text, text[], text, text) to authenticated;

notify pgrst, 'reload schema';
