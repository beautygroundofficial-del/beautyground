import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 주문 취소 확정(환불) — 파트너(해당 주문 판매자) 또는 관리자만 호출 가능.
// 포트원 실취소 → 주문 상태 cancelled → 재고 복구까지 한 번에 처리한다.
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PORTONE_SECRET = process.env.PORTONE_V2_API_SECRET
const ADMIN_EMAILS = ['beautyground.official@gmail.com']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'POST 요청만 허용됩니다.' })
    return
  }
  if (!SERVICE_ROLE || !PORTONE_SECRET) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY / PORTONE_V2_API_SECRET)' })
    return
  }

  let body: unknown = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const paymentId = (body as { paymentId?: string } | null)?.paymentId
  if (!paymentId) {
    res.status(400).json({ ok: false, reason: 'paymentId 가 필요합니다.' })
    return
  }

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userErr || !user) {
    res.status(401).json({ ok: false, reason: '인증에 실패했습니다.' })
    return
  }

  const { data: orderRows, error: selErr } = await supabase
    .from('orders')
    .select('id, product_id, partner_id, quantity, status')
    .eq('payment_id', paymentId)
  if (selErr || !orderRows || orderRows.length === 0) {
    res.status(404).json({ ok: false, reason: '주문을 찾을 수 없습니다.' })
    return
  }

  // 권한: 관리자이거나, 이 주문 상품의 판매 파트너 본인
  const isAdmin = ADMIN_EMAILS.includes(user.email ?? '')
  if (!isAdmin) {
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    const pid = partner?.id
    const owns = !!pid && orderRows.some((r) => r.partner_id === pid)
    const foreign = orderRows.some((r) => r.partner_id && r.partner_id !== pid)
    if (!owns || foreign) {
      res.status(403).json({ ok: false, reason: '이 주문을 취소할 권한이 없습니다.' })
      return
    }
  }

  if (orderRows.every((r) => r.status === 'cancelled')) {
    res.status(200).json({ ok: true, already: true })
    return
  }

  // 실결제가 있었던 주문이면 포트원 취소(환불) — pending/failed 는 결제 자체가 없으므로 상태만 변경
  const hadPayment = orderRows.some((r) => ['paid', 'cancel_requested', 'shipped', 'done'].includes(r.status))
  if (hadPayment) {
    try {
      const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`, {
        method: 'POST',
        headers: { Authorization: `PortOne ${PORTONE_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '판매자 취소 승인' }),
      })
      if (!r.ok) {
        const text = await r.text()
        // 이미 전액 취소된 결제면 그대로 진행 (멱등)
        if (!/ALREADY_CANCELLED|CANCELLED_PAYMENT/i.test(text)) {
          console.error('[order-cancel] portone cancel failed', r.status, text)
          res.status(200).json({ ok: false, reason: `포트원 환불에 실패했습니다 (${r.status}). 잠시 후 다시 시도해주세요.` })
          return
        }
      }
    } catch (e) {
      console.error('[order-cancel] portone request error', e)
      res.status(200).json({ ok: false, reason: '포트원 환불 요청에 실패했습니다.' })
      return
    }
  }

  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('payment_id', paymentId)
  if (updErr) {
    console.error('[order-cancel] order update failed', updErr)
    res.status(200).json({ ok: false, reason: '환불은 됐지만 주문 상태 변경에 실패했습니다. 새로고침 후 확인해주세요.' })
    return
  }

  // 재고 복구 — 결제 시 차감됐던 수량을 되돌린다 (배송비 행 등 product_id 없는 행 제외)
  if (hadPayment) {
    for (const row of orderRows) {
      if (!row.product_id) continue
      const { data: product } = await supabase
        .from('products')
        .select('stock, status')
        .eq('id', row.product_id)
        .single()
      if (!product) continue
      const nextStock = (product.stock as number) + (row.quantity as number)
      await supabase
        .from('products')
        .update({ stock: nextStock, ...(product.status === 'sold_out' && nextStock > 0 ? { status: 'on_sale' } : {}) })
        .eq('id', row.product_id)
    }
  }

  res.status(200).json({ ok: true })
}
