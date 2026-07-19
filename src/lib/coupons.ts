import type { LiveCoupon } from './types'

// 쿠폰 할인액 계산 — amount 는 구매액을 넘지 않게, percent 는 반올림.
export function couponDiscountAmount(coupon: LiveCoupon, subtotal: number): number {
  const raw =
    coupon.discount_type === 'percent'
      ? Math.round((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value
  return Math.min(raw, subtotal)
}

export function couponRemaining(coupon: LiveCoupon): number | null {
  if (coupon.qty_limit === null) return null
  return Math.max(coupon.qty_limit - coupon.qty_used, 0)
}

export function couponSoldOut(coupon: LiveCoupon): boolean {
  return coupon.qty_limit !== null && coupon.qty_used >= coupon.qty_limit
}

export function couponEligible(coupon: LiveCoupon, subtotal: number): boolean {
  return coupon.active && !couponSoldOut(coupon) && subtotal >= coupon.min_purchase
}

// 배너/안내 문구용 짧은 설명 (예: "5,000원 할인" / "10% 할인")
export function couponLabel(coupon: LiveCoupon): string {
  return coupon.discount_type === 'percent'
    ? `${coupon.discount_value}% 할인`
    : `${coupon.discount_value.toLocaleString()}원 할인`
}
