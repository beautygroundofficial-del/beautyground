-- 속 이야기 카테고리 추가 3번째 — 피부 이야기 (2026-09-12)
-- 대표님 확정: "추가해"
-- 근거: 대학내일20대연구소 세대별 피부 고민 조사 — X세대(46~61세, 우리 타겟과 겹침)
-- 1위 고민은 주름. 정식 "후기"(제품 리뷰)와 달리 부담 없이 피부 얘기를 나눌 공간이
-- 기존 9개 카테고리 어디에도 없었음 — 뷰티 커머스 커뮤니티인데 정작 빈 자리였음.
-- ✅ 2026-09-12 대표님 승인("승인하니 진행해") 후 운영 DB(beautyground-main) 실행 완료.
--    테스트 계정으로 create_board_post 실제 호출 검증(테스트 글은 삭제해 되돌림).

-- 1) 테이블 체크 제약 갱신
alter table public.board_posts drop constraint if exists board_posts_category_check;
alter table public.board_posts add constraint board_posts_category_check
  check (category in ('kids','spouse','parents','body','menopause','skin','mind','living','eco','chat'));

-- 2) create_board_post 검증 목록 갱신
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
  if p_category not in ('kids','spouse','parents','body','menopause','skin','mind','living','eco','chat') then
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
