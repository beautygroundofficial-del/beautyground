import { supabase } from './supabase'
import type { Product } from './types'

export interface MyReview {
  id: string
  productId: string
  rating: number
  reviewText: string
  createdAt: string
  product: Product | null
  replyContent: string | null
  repliedAt: string | null
}

// 관리자 "리뷰 관리" 화면(상품별 구매후기 답변)에서 쓰는 리뷰 1건
export interface AdminProductReview {
  id: string
  userId: string
  authorName: string
  rating: number
  reviewText: string
  createdAt: string
  replyContent: string | null
  repliedAt: string | null
}

export interface ReviewableOrder {
  orderId: string
  productId: string
  deliveredAt: string | null
  product: Product | null
}

// 리뷰를 이미 쓴 상품 id 목록 — 작성 가능 목록에서 제외할 때 사용
async function getReviewedProductIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('product_reviews').select('product_id').eq('user_id', userId)
  return new Set((data ?? []).map((r) => (r as { product_id: string }).product_id))
}

// 배송완료(status='done') 주문 중 아직 리뷰를 안 쓴 상품 — "리뷰 작성 가능" 목록
export async function getReviewableOrders(): Promise<ReviewableOrder[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return []

  const [{ data: orderRows }, reviewedIds] = await Promise.all([
    supabase
      .from('orders')
      .select('id, product_id, delivered_at, products(*)')
      .eq('user_id', userId)
      .eq('status', 'done')
      .not('product_id', 'is', null)
      .order('delivered_at', { ascending: false }),
    getReviewedProductIds(userId),
  ])

  const rows = (orderRows ?? []) as unknown as { id: string; product_id: string; delivered_at: string | null; products: Product | null }[]
  const seen = new Set<string>() // 같은 상품 여러 번 주문했으면 가장 최근 주문 1건만 노출
  const result: ReviewableOrder[] = []
  for (const row of rows) {
    if (!row.product_id || reviewedIds.has(row.product_id) || seen.has(row.product_id)) continue
    seen.add(row.product_id)
    result.push({ orderId: row.id, productId: row.product_id, deliveredAt: row.delivered_at, product: row.products })
  }
  return result
}

export async function getMyReviews(): Promise<MyReview[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return []
  const { data } = await supabase
    .from('product_reviews')
    .select('id, product_id, rating, review_text, created_at, reply_content, replied_at, products(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as unknown as { id: string; product_id: string; rating: number; review_text: string; created_at: string; reply_content: string | null; replied_at: string | null; products: Product | null }[])
    .map((row) => ({
      id: row.id,
      productId: row.product_id,
      rating: row.rating,
      reviewText: row.review_text,
      createdAt: row.created_at,
      product: row.products,
      replyContent: row.reply_content,
      repliedAt: row.replied_at,
    }))
}

// 관리자 "리뷰 관리" 모달에서 상품 1개의 회원 구매후기(product_reviews) 전체를 불러온다.
export async function getProductReviews(productId: string): Promise<AdminProductReview[]> {
  const { data } = await supabase
    .from('product_reviews')
    .select('id, user_id, author_name, rating, review_text, created_at, reply_content, replied_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as { id: string; user_id: string; author_name: string; rating: number; review_text: string; created_at: string; reply_content: string | null; replied_at: string | null }[])
    .map((row) => ({
      id: row.id,
      userId: row.user_id,
      authorName: row.author_name,
      rating: row.rating,
      reviewText: row.review_text,
      createdAt: row.created_at,
      replyContent: row.reply_content,
      repliedAt: row.replied_at,
    }))
}

// 리뷰 답변 등록/수정 — RLS: product_reviews_update_admin 정책(관리자만) 필요(supabase/product_reviews_reply.sql).
export async function replyToProductReview(reviewId: string, replyText: string): Promise<{ error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase
    .from('product_reviews')
    .update({ reply_content: replyText, replied_at: new Date().toISOString(), replied_by: session?.user?.id ?? null })
    .eq('id', reviewId)
  if (error) return { error: error.message }
  return {}
}

export async function submitReview(
  orderId: string,
  rating: number,
  text: string,
  authorName: string
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('submit_product_review', {
    p_order_id: orderId,
    p_rating: rating,
    p_text: text,
    p_author_name: authorName,
  })
  if (error) return { error: error.message }
  return {}
}
