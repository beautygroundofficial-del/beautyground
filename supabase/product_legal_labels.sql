-- 상품정보고시(화장품 표시기재) 컬럼 추가 (2026-09-11)
-- ⚠️ 법적 최우선 갭 — 지금까지 화장품 소비자 표시사항(전성분·사용기한 등)을 저장할 컬럼 자체가
-- 없어서, 상품 상세페이지에 "전성분은 제품 포장을 참조해 주세요"라는 안내문만 있었다
-- (전자상거래법상 구매 전 온라인 표시 의무와 맞지 않음). 참고: [[히로인스 수익모델·셀러센터 정밀분석]]
-- "실전 등록으로 확인한 운영 흐름" — 화장품 카테고리는 등록 시 이 항목들이 필수로 붙는다고 확인됨.
--
-- ⚠️⚠️ 아래 8개 필드는 조사 과정에서 파악한 일반적인 화장품 표시기재 항목이며,
-- 공정거래위원회 고시·화장품법상 정확한 필수항목 전체 목록을 법률 검토한 것은 아니다.
-- 실제 서비스 전 반드시 법무 확인이 필요하다.

alter table products add column if not exists capacity_weight text;   -- 내용물의 용량 또는 중량
alter table products add column if not exists ingredients text;        -- 전성분
alter table products add column if not exists expiry_info text;        -- 사용기한 또는 개봉 후 사용기간
alter table products add column if not exists usage_method text;       -- 사용방법
alter table products add column if not exists manufacturer text;       -- 제조업자
alter table products add column if not exists responsible_seller text; -- 책임판매업자
alter table products add column if not exists precautions text;        -- 사용할 때의 주의사항
alter table products add column if not exists quality_standard text;   -- 품질보증기준

-- 브랜드 셀러센터 — 본인 상품 수정 시 이 컬럼들을 포함한 전체 필드를 고칠 수 있게 하는 RPC.
-- api/scrape-product.ts 의 mode:'save'(+product_id)가 이 컬럼들을 그대로 받아 update 한다 —
-- 별도 RPC 없이 기존 등록 경로를 재사용(파트너 소유권 검증도 그 파일에서 이미 함).
-- 이 파일은 스키마 변경만 담당.

notify pgrst, 'reload schema';
