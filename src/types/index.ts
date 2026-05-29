export type DeptKey = 'lotte' | 'shinsegae' | 'hyundai'
export type AgeGroup = '30s' | '40s' | '50s'
export type CategoryId = 'skincare' | 'makeup' | 'perfume' | 'hair' | 'body'

export interface LiveSlide {
  id: number
  hostName: string
  deptName: string
  deptKey: DeptKey
  viewers: number
  productName: string
  price: number
  originalPrice?: number
  bgColor: string
  avatarColor: string
  avatarInitial: string
}

export interface LiveCard {
  id: number
  brand: string
  deptName: string
  deptKey: DeptKey
  productName: string
  price: number
  viewers: number
  isLive: boolean
  thumbColor: string
}

export interface ProductCard {
  id: number
  brand: string
  name: string
  price: number
  originalPrice?: number
  deptName: string
  deptKey: DeptKey
  thumbIcon: string
  thumbColor: string
}

export interface DeptCard {
  key: DeptKey
  name: string
  brandCount: number
  isVip?: boolean
  bgColor: string
  textColor: string
  accentColor: string
}

export interface CategoryChip {
  id: CategoryId
  label: string
  icon: string
  bg: string
  color: string
}

export interface AgeSegment {
  group: AgeGroup
  label: string
  keywords: string[]
  bgColor: string
  textColor: string
  accentColor: string
}

export interface LiveStream extends LiveCard {
  hostName: string
  hostDesc: string
  avatarInitial: string
  avatarColor: string
  bgColor: string
  originalPrice?: number
  scheduledAt?: string
  products: ProductCard[]
  likes: number
}

export interface ChatMessage {
  id: number
  user: string
  message: string
  userColor: string
  isHost?: boolean
  isSystem?: boolean
}

export interface Brand {
  id: number
  name: string
  deptKey: DeptKey
  deptName: string
  description: string
  categoryId: CategoryId
  icon: string
  bgColor: string
  accentColor: string
  textColor: string
  productCount: number
  products: ProductCard[]
}

export interface CartItem {
  id: number
  productId: number
  brand: string
  name: string
  price: number
  quantity: number
  thumbIcon: string
  thumbColor: string
  deptName: string
  deptKey: DeptKey
}

export interface UserProfile {
  name: string
  email: string
  tier: 'BASIC' | 'VIP' | 'VVIP'
  points: number
  coupons: number
  orders: number
  wishlist: number
}

export interface OrderSummary {
  items: CartItem[]
  deliveryFee: number
  discount: number
  total: number
  address: string
  paymentMethod: string
}
