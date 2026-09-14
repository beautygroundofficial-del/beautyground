import { supabase } from './supabase'
import { vvipPrice, getVvipDeptStoreMap } from './vvip'

export interface OrderItem {
  product_id: string
  name: string
  price: number
  quantity: number
  thumbnail?: string | null
  cart_item_id?: string
  option_label?: string | null
}

export interface OrderRow {
  payment_id: string
  order_name: string
  product_id: string | null
  partner_id: string | null
  live_id: string | null
  quantity: number
  amount: number
  buyer_name: string
  buyer_phone: string
  buyer_email: string | null
  status: string
  user_id: string | null
  delivery_memo: string | null
  recipient_name: string
  recipient_phone: string
  ship_address: string
  option_label: string | null
}

// 주문 상품 서버 재검증 — 장바구니에 담아둔 사이 가격·재고·판매상태가 바뀔 수 있으므로
// 화면에 보이는 값이 아니라 "지금 DB의 값"을 기준으로 주문한다.
// AppOrder.tsx의 revalidateItems()를 그대로 옮긴 것 — 로직 변경 없음(2026-09-14).
export async function revalidateOrderItems(
  current: OrderItem[]
): Promise<{ items: OrderItem[]; notices: string[]; blocked: string[]; isVvip: boolean }> {
  if (current.length === 0) return { items: current, notices: [], blocked: [], isVvip: false }
  const ids = current.map((i) => i.product_id)
  const [{ data }, { data: vvipData, error: vvipErr }] = await Promise.all([
    supabase.from('products').select('id, name, price, sale_price, stock, status, partner_id').in('id', ids),
    supabase.rpc('is_vvip'),
  ])
  const vvip = !vvipErr && vvipData === true
  const products = (data ?? []) as { id: string; name: string; price: number; sale_price: number | null; stock: number; status: string; partner_id: string | null }[]
  const byId = new Map(products.map((p) => [p.id, p]))

  // VVIP면 브랜드별 백화점 입점 여부로 할인율(20%/30%) 결정 — partner_id 없거나 조회 실패 시 백화점(20%)로 안전하게 처리
  const deptStoreMap = vvip
    ? await getVvipDeptStoreMap([...new Set(products.map((p) => p.partner_id).filter((v): v is string => !!v))])
    : new Map<string, boolean>()

  const notices: string[] = []
  const blocked: string[] = []
  const next: OrderItem[] = []
  for (const it of current) {
    const p = byId.get(it.product_id)
    if (!p || p.status !== 'on_sale' || p.stock <= 0) {
      blocked.push(p?.name ?? it.name)
      continue
    }
    let qty = it.quantity
    if (qty > p.stock) {
      qty = p.stock
      notices.push(`"${p.name}" 재고가 부족해 수량을 ${p.stock}개로 조정했어요.`)
    }
    const basePrice = p.sale_price ?? p.price
    if (basePrice !== it.price) {
      notices.push(`"${p.name}" 가격이 ${it.price.toLocaleString('ko-KR')}원 → ${basePrice.toLocaleString('ko-KR')}원으로 변경되었어요.`)
    }
    const isDeptStore = p.partner_id ? (deptStoreMap.get(p.partner_id) ?? true) : true
    const nowPrice = vvip ? vvipPrice(basePrice, isDeptStore) : basePrice
    next.push({ ...it, price: nowPrice, quantity: qty })
  }
  return { items: next, notices, blocked, isVvip: vvip }
}

// 주문(orders) 테이블 insert 행 조립 — 상품행 + 배송비/쿠폰할인/적립금/가입쿠폰 조정행.
// AppOrder.tsx의 handlePay() 안에 있던 행 조립 로직을 그대로 옮긴 것 — 로직 변경 없음(2026-09-14).
export function buildOrderRows(params: {
  items: OrderItem[]
  paymentId: string
  orderName: string
  partnerOf: Map<string, string | null>
  liveId: string | null
  buyerName: string
  buyerPhone: string
  buyerEmail: string | null
  memo: string | null
  fullAddress: string
  deliveryFee: number
  couponDiscount: number
  redeemedPoints: number
  redeemedCouponId: string | null
  signupCouponPreview: number
  selectedCouponLabel: string | null
  userId: string | null
}): OrderRow[] {
  const {
    items, paymentId, orderName, partnerOf, liveId, buyerName, buyerPhone, buyerEmail,
    memo, fullAddress, deliveryFee, couponDiscount, redeemedPoints, redeemedCouponId,
    signupCouponPreview, selectedCouponLabel, userId,
  } = params

  const base = {
    payment_id: paymentId,
    live_id: liveId,
    buyer_name: buyerName,
    buyer_phone: buyerPhone,
    buyer_email: buyerEmail,
    status: 'pending',
    user_id: userId,
    delivery_memo: memo,
    recipient_name: buyerName,
    recipient_phone: buyerPhone,
    ship_address: fullAddress,
  }

  const rows: OrderRow[] = items.map((i) => ({
    ...base,
    order_name: orderName,
    product_id: i.product_id,
    partner_id: partnerOf.get(i.product_id) ?? null,
    quantity: i.quantity,
    amount: i.price * i.quantity,
    option_label: i.option_label ?? null,
  }))

  // 배송비도 한 행으로 반영(상품 없는 배송비 행) — 합계 검증(payment-complete)과 일치시키기 위함
  if (deliveryFee > 0) {
    rows.push({ ...base, order_name: '배송비', product_id: null, partner_id: null, quantity: 1, amount: deliveryFee, option_label: null })
  }
  if (couponDiscount > 0) {
    rows.push({ ...base, order_name: '라이브 쿠폰 할인', product_id: null, partner_id: null, quantity: 1, amount: -couponDiscount, option_label: null })
  }
  if (redeemedPoints > 0) {
    rows.push({ ...base, order_name: '적립금 사용', product_id: null, partner_id: null, quantity: 1, amount: -redeemedPoints, option_label: null })
  }
  if (redeemedCouponId && signupCouponPreview > 0) {
    rows.push({ ...base, order_name: `쿠폰 할인 (${selectedCouponLabel ?? ''})`, product_id: null, partner_id: null, quantity: 1, amount: -signupCouponPreview, option_label: null })
  }

  return rows
}
