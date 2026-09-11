// Supabase 테이블 타입 (STEP 0 SQL 스키마와 일치)

// 업체 리뷰 게시판에서 수집한 리뷰 1건 (scrape-reviews 응답 및 products.scraped_reviews 저장 형태)
export interface ScrapedReview {
  rating: number | null
  text: string
  photo: string | null // 하위호환: photos[0]
  photos?: string[] // 리뷰 사진 여러 장 (게시글 상세의 /file_data/ 이미지)
  date: string | null
  author: string | null
}

export interface Product {
  id: string
  partner_id: string | null
  name: string
  price: number
  sale_price: number | null
  category: string | null
  thumbnail_url: string | null
  description: string | null
  stock: number
  status: 'on_sale' | 'sold_out' | 'hidden'
  gallery_images: string[] | null
  detail_images: string[] | null
  scraped_reviews: ScrapedReview[] | null
  review_summary: ReviewSummaryData | null // 리뷰 요약(수/평균평점/사진) — 간단 리뷰 위젯용
  source_url: string | null // 스크랩 원본 상품 페이지 URL(후기 재수집용)
  season_tags: string[] // 계절/명절 추천 태그(봄·여름·가을·겨울·추석·설) — 홈 "지금 확인할 상품" 큐레이션에 사용
  is_export_featured: boolean // 브랜드가 해외 바이어용 대표상품으로 고른 상품인지 (supabase/products_export_featured.sql)
  // 수출용 별도 이미지/설명 — 소비자용 gallery_images/description과 분리 (supabase/products_export_content.sql)
  export_image_urls: string[]
  export_description: string | null
  export_description_en: string | null // /api/translate로 자동번역
  // 상품정보고시(화장품 표시기재) — supabase/product_legal_labels.sql. 전부 선택 입력이라
  // null 가능(기존 상품은 소급 입력 전까지 전부 비어있음).
  capacity_weight: string | null
  ingredients: string | null
  expiry_info: string | null
  usage_method: string | null
  manufacturer: string | null
  responsible_seller: string | null
  precautions: string | null
  quality_standard: string | null
  created_at: string
}

// 상품 옵션(색상 등, supabase/product_options.sql) — 없는 상품은 옵션 없이 바로 구매
export interface ProductOption {
  id: string
  product_id: string
  label: string
  sort_order: number
  in_stock: boolean
}

// 리뷰 1건 (url 있으면 사진 리뷰, 없으면 텍스트 전용 리뷰)
export interface ReviewPhoto {
  url?: string | null // 사진 없는 텍스트 리뷰는 url 없음
  text?: string
  rating?: number | null
  author?: string | null
  date?: string | null
}

// 리뷰 요약 (products.review_summary 저장 형태 · ReviewSummary 위젯 입력)
// photos 는 신형(ReviewPhoto 객체) / 구형(문자열 URL) 모두 허용
export interface ReviewSummaryData {
  count: number
  avg: number | null
  photos: (string | ReviewPhoto)[]
}

export interface Live {
  id: string
  partner_id: string | null
  title: string
  description: string | null
  scheduled_at: string | null
  status: 'scheduled' | 'live' | 'ended'
  thumbnail_url: string | null
  stream_url: string | null
  stream_uid: string | null
  playback_url: string | null
  product_ids: string[] | null
  // 방송 중 실시간 동기화 (supabase/lives_realtime_sync.sql)
  highlight_product_id?: string | null
  pinned_message?: string | null
  // 방송 종료 후 통계 (supabase/lives_peak_viewers.sql)
  peak_viewers?: number
  // 진행자 지정 (supabase/lives_host_id.sql) — null이면 브랜드 자체 진행(수수료 정산 대상 아님)
  host_id?: string | null
  // 예상 방송시간(분) (supabase/lives_duration.sql) — null이면 미정
  duration_minutes?: number | null
  // 백화점 태그 (supabase/lives_dept_key.sql) — 홈 화면 백화점별 방송 박스/필터, /dept 담당자 페이지용
  dept_key?: 'hyundai' | 'ak' | null
  // 진행자 로그인 없는 링크 방송용 토큰 (supabase/lives_host_token.sql) — /host/go/:token
  // 공개 select 정책에는 절대 포함시키지 않음. get_live_by_host_token RPC로만 조회.
  host_token?: string
  created_at: string
}

// 브랜드(입점사) — 파트너센터 UI는 삭제됐지만 브랜드 식별·수수료·정산 기준 테이블로는 계속 사용.
// 로그인 계정은 관리자가 admin_link_partner_account RPC로 연결(자체 회원가입 없음).
export interface Partner {
  id: string
  user_id: string | null
  brand_name: string
  status: 'active' | 'pending' | 'suspended'
  commission_rate: number
  is_dept_store_brand: boolean // 백화점 입점 여부 — VVIP 할인율 산정 기준(supabase/vvip_members.sql)
  export_pitch: string | null // 브랜드가 직접 쓰는 수출 제안용 소개글 (supabase/partners_export_pitch.sql)
  export_pitch_en: string | null // export_pitch의 영문 번역 (supabase/partners_export_pitch_en.sql) — 공개 /export 페이지에 노출
  // 수출 상세정보 (supabase/partners_export_details.sql)
  export_certifications: string[]
  export_countries: string | null // 이미 수출 중인 국가(자유서술)
  export_moq_notes: string | null // 최소주문수량·샘플 정책 등
  export_logo_url: string | null // 브랜드 BI 로고 (supabase/partners_export_logo.sql)
  export_story_images: string[] // 캡션 없는 브랜드 스토리 사진, 최대 5장 (supabase/partners_export_story_images.sql)
  // 판매자(사업자) 정보 — 브랜드가 셀러센터에서 직접 입력/수정 (supabase/brand_company_info.sql)
  biz_no: string | null
  ceo_name: string | null
  biz_address: string | null
  contact_phone: string | null
  bank_name: string | null
  bank_account: string | null
  bank_holder: string | null
  created_at: string
}

// 브랜드 정산 (supabase/admin_ops.sql — settlements 테이블 + admin_generate_partner_settlement 등)
// 호스트와 달리 등급(tier) 없이 partners.commission_rate 고정값으로 계산.
export interface Settlement {
  id: string
  partner_id: string
  period: string
  total_sales: number
  commission: number
  payout_amount: number
  status: 'pending' | 'paid'
  created_at: string
}

// admin_list_partner_settlements() RPC 반환 행 — 브랜드명 조인 포함
export interface SettlementRow extends Settlement {
  brand_name: string
}

// 백화점 담당자 계정 (supabase/dept_accounts.sql) — 한 백화점(dept_key)에 여러 지점 계정이 있을 수
// 있음(예: display_name "AK플라자_광명"). 관리자는 가입코드만 발급하고, 담당자 본인이
// /dept/register에서 이메일·비밀번호를 만들어 셀프 가입(claim_dept_account RPC, 2026-08-15).
export interface DeptAccount {
  id: string
  user_id: string | null
  dept_key: 'hyundai' | 'ak'
  display_name: string
  status: 'active' | 'suspended'
  signup_code: string | null // 관리자가 발급한 1회용 가입코드 (supabase/dept_accounts_signup_code.sql) — user_id 연결되면 용도 끝
  created_at: string
}

// dept_live_sales_view 조회 결과 행 — 로그인한 담당자 본인의 dept_key로만 스코프됨(뷰 정의 안에서 필터)
export interface DeptSaleRow {
  live_id: string
  live_title: string
  live_scheduled_at: string | null
  dept_key: 'hyundai' | 'ak'
  total_amount: number
  total_quantity: number
  order_count: number
}

// partner_live_sales_view 조회 결과 행 — 구매자 PII 없음(host_sales_view와 동일 원칙)
export interface PartnerSaleRow {
  id: string
  live_id: string | null
  product_id: string | null
  amount: number
  quantity: number
  status: Order['status']
  created_at: string
  partner_id: string
  live_title: string | null
  live_scheduled_at: string | null
  dept_key: 'hyundai' | 'ak' | null
}

// 라이브 한정 쿠폰/특가 (supabase/live_coupons.sql)
export interface LiveCoupon {
  id: string
  live_id: string
  discount_type: 'amount' | 'percent'
  discount_value: number
  min_purchase: number
  qty_limit: number | null
  qty_used: number
  active: boolean
  created_at: string
}

export interface Order {
  id: string
  partner_id: string | null
  product_id: string | null
  live_id: string | null
  payment_id?: string | null
  order_name?: string | null
  user_id?: string | null
  buyer_name: string | null
  buyer_phone: string | null
  quantity: number
  amount: number
  // pending/failed = 결제 시도 단계, cancel_requested = 고객 취소요청(관리자 승인 시 cancelled)
  status: 'pending' | 'failed' | 'paid' | 'shipped' | 'done' | 'cancelled' | 'cancel_requested'
  option_label?: string | null // 선택한 옵션(색상 등, supabase/product_options.sql) — 없으면 옵션 없는 상품
  delivery_memo?: string | null
  tracking_number?: string | null
  tracking_carrier?: string | null
  // 배송지·배송 상태 (supabase/shipping.sql, 2026-08-27)
  recipient_name?: string | null
  recipient_phone?: string | null
  ship_address?: string | null
  ship_zip?: string | null
  ship_from?: string | null
  shipping_status?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
  created_at: string
}

// 진행자(라이브 호스트) — 브랜드 담당자 자체 방송이 아니라 뷰티그라운드가 섭외한
// 별도 인력. 여러 브랜드를 옮겨다니며 방송하고 매출 등급에 따라 수수료를 받는다.
// (supabase/hosts.sql)
export interface Host {
  id: string
  user_id: string | null
  name: string
  phone: string | null
  email: string | null
  status: 'pending' | 'active' | 'suspended'
  created_at: string
}

// 진행자 등급별 수수료율표 — 관리자가 자유롭게 추가/수정 (supabase/commission_tiers.sql)
export interface CommissionTier {
  id: string
  name: string
  min_sales: number
  commission_rate: number
  created_at: string
}

// 진행자 월별 정산 — 생성 시점의 등급/수수료율을 스냅샷으로 저장 (supabase/host_settlements.sql)
export interface HostSettlement {
  id: string
  host_id: string
  period: string
  total_sales: number
  tier_id: string | null
  tier_name: string | null
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'paid'
  paid_at: string | null
  created_at: string
}

// admin_list_host_settlements() RPC 반환 행 — 호스트 이름 조인 포함
export interface HostSettlementRow extends HostSettlement {
  host_name: string
}

// host_sales_view 조회 결과 행 — 구매자 PII(이름/연락처)는 의도적으로 포함하지 않음
export interface HostSaleRow {
  id: string
  live_id: string
  product_id: string | null
  amount: number
  quantity: number
  status: Order['status']
  created_at: string
  host_id: string
  live_title: string
  product_name: string | null
  partner_id: string | null
  brand_name: string | null
}

export const PRODUCT_CATEGORIES = [
  '스킨케어',
  '메이크업',
  '향수',
  '헤어·바디',
  '이너뷰티',
  '뷰티 디바이스',
  '퍼퓸 디퓨저',
] as const

// 해외 바이어 문의 (/export 페이지, supabase/export_inquiries.sql) — beautyground가
// 직접 수출자(재판매자)로서 보유 브랜드를 제안하는 채널. 브랜드-바이어 중개가 아님.
export interface ExportInquiry {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string | null
  country: string
  interested_categories: string[] | null
  message: string | null
  status: 'new' | 'contacted' | 'closed' // new=신규, contacted=연락완료, closed=종료
  created_at: string
}

// 공개 /export 페이지의 "Featured Brands" 섹션용 — export_brand_public 뷰(민감 컬럼 제외,
// supabase/partners_export_pitch_en.sql)에서 anon으로 직접 조회.
export interface ExportBrandPublic {
  id: string
  brand_name: string
  export_logo_url: string | null
  export_pitch_en: string | null
  export_certifications: string[]
  export_countries: string | null
  export_moq_notes: string | null
  export_story_images: string[]
}

// 해외 바이어 타겟(아웃바운드 CRM, /admin/export-buyers, supabase/export_buyers.sql) — 관리자 전용.
// 브랜드사는 이 데이터에 접근하지 않는다(바이어 정보 비공개 원칙).
export interface ExportBuyer {
  id: string
  company_name: string
  country: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  proposed_partner_ids: string[]
  status: 'target' | 'contacted' | 'responded' | 'declined' | 'won'
  notes: string | null
  created_at: string
}

// 활동 미션(참여 리워드, /admin/missions, supabase/missions.sql) — 걷기·일기·라이브시청 등.
// 코드 수정 없이 관리자 화면에서 미션을 만들고 켜고 끌 수 있게 설계됨("살아 움직이는 앱" 원칙).
// 포인트 지급은 기존 point_transactions 원장을 그대로 사용한다.
export interface MissionMilestone {
  value: number   // 구간 목표값 (예: 5000보)
  points: number  // 해당 구간 도달 시 지급 포인트
}

export interface Mission {
  id: string
  key: string
  title: string
  description: string | null
  icon: string | null
  type: 'daily' | 'streak' | 'cumulative' | 'once'
  metric: string            // steps | attendance | diary_post | review_post | live_minutes | custom
  target_value: number
  reward_points: number
  milestones: MissionMilestone[]
  reward_note: string | null
  max_per_day: number
  cooldown_sec: number
  starts_at: string | null
  ends_at: string | null
  point_expire_days: number
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface MissionProgress {
  id: number
  mission_id: string
  user_id: string
  progress_date: string
  current_value: number
  claim_count: number
  awarded_points: number
  last_claim_at: string | null
  completed_at: string | null
}
