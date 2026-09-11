-- 브랜드 셀러센터 — 상품 사진 직접 업로드 (2026-09-11)
-- 그동안 셀러센터 상품 사진은 /api/scrape-product 가 자사몰 URL 에서 긁어온 것뿐이라,
-- 스마트스토어처럼 안 읽히는 몰의 브랜드는 사진을 한 장도 넣을 수 없었고
-- 이미 등록된 상품의 대표사진 교체·잘못 긁힌 사진 삭제도 불가능했다.
-- 파일은 브라우저에서 바로 Storage 로 올린다(Vercel 함수 12/12 한도 — 새 API 안 만듦).
--
-- ⚠️ 본인 partner_id 폴더(seller/<partner_id>/...)에만 올릴 수 있게 storage RLS 로 막는다.
-- products_export_content.sql 의 export/<partner_id>/ 정책과 같은 패턴이며,
-- product-images 버킷은 이미 공개 읽기라 별도 select 정책은 불필요하다.
drop policy if exists "brand can upload own seller images" on storage.objects;
create policy "brand can upload own seller images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'seller'
    and (storage.foldername(name))[2] = (select id::text from public.partners where user_id = auth.uid())
  );

-- 화면에서 "사진 빼기"는 상품의 이미지 목록에서만 빼고 Storage 파일은 남겨둔다
-- (되돌리기 안전 + 다른 상품이 같은 URL 을 쓰고 있을 수 있음). 실제 파일 정리가 필요해지면
-- 이 폴더 접두사에 delete 정책을 추가하거나 관리자 배치로 지운다.

notify pgrst, 'reload schema';
