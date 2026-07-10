import { supabase } from './supabase'

// 회원 등급제 — 누적 구매금액(결제완료 이후 상태의 주문 합계, 배송비 제외) 기준
// 적립률은 안내용(적립금 실사용은 결제 오픈 후 활성화)

export interface MembershipTier {
  key: 'BASIC' | 'SILVER' | 'GOLD' | 'VIP'
  label: string
  min: number // 누적 구매금액 하한(원)
  rewardRate: number // 적립률(%)
  color: string // 배지 색
  bg: string
}

export const TIERS: MembershipTier[] = [
  { key: 'BASIC', label: 'BASIC', min: 0, rewardRate: 1, color: '#6b7280', bg: '#f3f4f6' },
  { key: 'SILVER', label: 'SILVER', min: 100_000, rewardRate: 2, color: '#64748b', bg: '#eef2f7' },
  { key: 'GOLD', label: 'GOLD', min: 300_000, rewardRate: 3, color: '#a16207', bg: '#fdf3d7' },
  { key: 'VIP', label: 'VIP', min: 700_000, rewardRate: 5, color: '#7c2d5e', bg: '#fbe9f3' },
]

// 누적 구매금액으로 등급 산정
export function calcTier(totalSpent: number): MembershipTier {
  let tier = TIERS[0]
  for (const t of TIERS) if (totalSpent >= t.min) tier = t
  return tier
}

// 다음 등급과 남은 금액 (VIP 면 null)
export function nextTierInfo(totalSpent: number): { next: MembershipTier; remain: number } | null {
  const next = TIERS.find((t) => t.min > totalSpent)
  if (!next) return null
  return { next, remain: next.min - totalSpent }
}

export interface MembershipInfo {
  totalSpent: number
  tier: MembershipTier
  next: { next: MembershipTier; remain: number } | null
}

// 내 등급 조회 — 결제완료(paid) 이후 단계(shipped/done 포함)의 주문 합계.
// 배송비 행(order_name='배송비', product_id 없음)은 구매금액에서 제외.
export async function getMyMembership(): Promise<MembershipInfo> {
  const { data: { session } } = await supabase.auth.getSession()
  const empty: MembershipInfo = { totalSpent: 0, tier: TIERS[0], next: nextTierInfo(0) }
  if (!session) return empty

  const { data } = await supabase
    .from('orders')
    .select('amount, status, product_id, order_name')
    .eq('user_id', session.user.id)
    .in('status', ['paid', 'shipped', 'done'])

  const rows = (data ?? []) as { amount: number; product_id: string | null; order_name: string | null }[]
  const totalSpent = rows
    .filter((r) => r.product_id && r.order_name !== '배송비')
    .reduce((s, r) => s + (r.amount || 0), 0)

  return { totalSpent, tier: calcTier(totalSpent), next: nextTierInfo(totalSpent) }
}
