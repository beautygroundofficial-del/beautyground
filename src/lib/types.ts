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
}

export interface Partner {
  id: string
  user_id: string | null
  brand_name: string
  status: 'active' | 'suspended'
  commission_rate: number
  created_at: string
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
  detail_images: string[] | null
  created_at: string
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
  buyer_name: string | null
  buyer_phone: string | null
  quantity: number
  amount: number
  status: 'paid' | 'shipped' | 'done' | 'cancelled'
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
