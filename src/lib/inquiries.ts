import { supabase } from './supabase'
import type { Product } from './types'

// 마이페이지 "내 문의·리뷰 답변" — 2026-09-16 알림시스템 전수조사 발견 사항.
// 상품문의(product_questions)·구매후기(product_reviews)에 답변이 달려도 우연히 상품 상세를
// 재방문해야만 발견할 수 있었다. 두 테이블을 합쳐 "내가 남긴 글 + 답변 여부"를 한 화면에서 보여준다.
export interface MyInquiry {
  id: string
  kind: 'question' | 'review'
  productId: string
  product: Product | null
  content: string
  isSecret: boolean
  createdAt: string
  answer: string | null
  answeredAt: string | null
}

export async function getMyInquiries(): Promise<MyInquiry[]> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return []

  const [{ data: questionRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from('product_questions')
      .select('id, product_id, question, is_secret, answer, answered_at, created_at, products(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('product_reviews')
      .select('id, product_id, review_text, reply_content, replied_at, created_at, products(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const questions: MyInquiry[] = (
    (questionRows ?? []) as unknown as {
      id: string; product_id: string; question: string; is_secret: boolean
      answer: string | null; answered_at: string | null; created_at: string; products: Product | null
    }[]
  ).map((q) => ({
    id: q.id,
    kind: 'question',
    productId: q.product_id,
    product: q.products,
    content: q.question,
    isSecret: q.is_secret,
    createdAt: q.created_at,
    answer: q.answer,
    answeredAt: q.answered_at,
  }))

  const reviews: MyInquiry[] = (
    (reviewRows ?? []) as unknown as {
      id: string; product_id: string; review_text: string
      reply_content: string | null; replied_at: string | null; created_at: string; products: Product | null
    }[]
  ).map((r) => ({
    id: r.id,
    kind: 'review',
    productId: r.product_id,
    product: r.products,
    content: r.review_text,
    isSecret: false,
    createdAt: r.created_at,
    answer: r.reply_content,
    answeredAt: r.replied_at,
  }))

  return [...questions, ...reviews].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}
