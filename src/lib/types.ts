// Supabase 테이블 타입 (STEP 0 SQL 스키마와 일치)

export interface PartnerApplication {
  id: string
  created_at: string
  user_id: string | null
  brand_name: string
  company_name: string | null
  biz_number: string | null
  owner_name: string | null
  phone: string
  email: string
  category: string[] | null // text[] (ARRAY)
  message: string | null
  doc_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  privacy_agreed: boolean | null
  terms_agreed: boolean | null
  agreed_at: string | null
}

export interface Partner {
  id: string
  user_id: string | null
  brand_name: string
  status: 'active' | 'suspended'
  commission_rate: number
  created_at: string
}

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
  created_at: string
}

// 리뷰 사진 1건 (썸네일 클릭 시 모달에 본문 표시)
export interface ReviewPhoto {
  url: string
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
  // pending/failed = 결제 시도 단계, cancel_requested = 고객 취소요청(파트너 승인 시 cancelled)
  status: 'pending' | 'failed' | 'paid' | 'shipped' | 'done' | 'cancelled' | 'cancel_requested'
  delivery_memo?: string | null
  tracking_number?: string | null
  tracking_carrier?: string | null
  created_at: string
}

export interface Settlement {
  id: string
  partner_id: string | null
  period: string | null
  total_sales: number
  commission: number
  payout_amount: number
  status: 'pending' | 'paid'
  created_at: string
}

export const PRODUCT_CATEGORIES = [
  '스킨케어',
  '메이크업',
  '향수',
  '헤어·바디',
  '이너뷰티',
  '뷰티 디바이스',
  '기타',
] as const
