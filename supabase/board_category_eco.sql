-- 속 이야기 카테고리 추가 2번째 — 아껴 쓰는 이야기(친환경/작은 실천) (2026-09-12)
-- 대표님 확정: "친환경 작은 실천도 좋은것 같네"
-- 근거(옵시디언 03 홈페이지/친환경 + 걷기 + 사는이야기 리서치): 60대 여성이 전 연령·
-- 성별 중 ESG(친환경) 의식 1위(2.63점). "친환경"이라는 구호성 표현 대신, 조사에서
-- 확인된 가장 익숙한 개념인 "재활용(42%, 1위 키워드)"에 맞춰 "아껴 쓰는 이야기"로 명명.
-- ✅ 2026-09-12 대표님 승인("승인하니 진행해") 후 운영 DB(beautyground-main) 실행 완료.
--    테스트 계정으로 create_board_post 실제 호출 검증(테스트 글은 삭제해 되돌림).

-- 1) 테이블 체크 제약 갱신
alter table public.board_posts drop constraint if exists board_posts_category_check;
alter table public.board_posts add constraint board_posts_category_check
  check (category in ('kids','spouse','parents','body','menopause','mind','living','eco','chat'));

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
  if p_category not in ('kids','spouse','parents','body','menopause','mind','living','eco','chat') then
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
