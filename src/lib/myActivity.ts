import { supabase } from './supabase'
import { getMyBoardPosts } from './board'

// 마이페이지 "나의 활동" 화면 — 대표님 지시(2026-09-13): 모임 가입/클래스 신청처럼
// 우리 앱에 없는 개념 대신, 내가 커뮤니티에 글을 남긴 날짜(출석)와 보유 포인트로
// 지금 살 수 있는 상품 추천을 보여준다. "자주 방문하면 좋은 게 보인다"는 동기부여 설계.

export interface ActivityDayItem {
  kind: 'diary' | 'board'
  id: string
  content: string
  createdAt: string
}

// 이번 달(monthStart~monthEndExclusive, 'YYYY-MM-DD')에 내가 쓴 이야기·속 이야기를
// 날짜별로 묶어서 돌려준다. 두 테이블 다 양이 적은 초기 단계라 클라이언트에서 합친다.
export async function getMyActivityByDate(
  monthStart: string, monthEndExclusive: string,
): Promise<Map<string, ActivityDayItem[]>> {
  const [diaryRes, boardPosts] = await Promise.all([
    supabase
      .from('diaries')
      .select('id, content, created_at')
      .gte('created_at', monthStart)
      .lt('created_at', monthEndExclusive),
    getMyBoardPosts(100),
  ])

  const byDate = new Map<string, ActivityDayItem[]>()
  const push = (date: string, item: ActivityDayItem) => {
    const list = byDate.get(date) ?? []
    list.push(item)
    byDate.set(date, list)
  }

  for (const row of (diaryRes.data ?? []) as { id: string; content: string; created_at: string }[]) {
    push(row.created_at.slice(0, 10), { kind: 'diary', id: row.id, content: row.content, createdAt: row.created_at })
  }
  for (const p of boardPosts) {
    const date = p.created_at.slice(0, 10)
    if (date < monthStart.slice(0, 10) || date >= monthEndExclusive.slice(0, 10)) continue
    push(date, { kind: 'board', id: p.id, content: p.content, createdAt: p.created_at })
  }
  return byDate
}

export interface PointsProduct {
  id: string
  name: string
  price: number
  salePrice: number | null
  thumbnailUrl: string | null
}

// 보유 포인트로 살 수 있는 상품 — 판매가(할인가 우선) 기준으로 포인트 이하 상품 중 비싼 순
// (가장 알차게 다 쓸 수 있는 상품을 먼저 보여준다).
export async function getPointsRecommendedProducts(points: number, limit = 4): Promise<PointsProduct[]> {
  if (points <= 0) return []

  const runQuery = (priceCol: 'effective_price' | 'price') =>
    supabase
      .from('products')
      .select('id,name,price,sale_price,thumbnail_url')
      .eq('status', 'on_sale')
      .lte(priceCol, points)
      .order(priceCol, { ascending: false })
      .limit(limit)

  let { data, error } = await runQuery('effective_price')
  if (error) ({ data, error } = await runQuery('price'))
  if (error || !data) return []

  return (data as { id: string; name: string; price: number; sale_price: number | null; thumbnail_url: string | null }[])
    .map((r) => ({ id: r.id, name: r.name, price: r.price, salePrice: r.sale_price, thumbnailUrl: r.thumbnail_url }))
}
