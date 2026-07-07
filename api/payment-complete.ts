import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 서버 전용 값 (Vercel 환경변수). 클라이언트로 절대 반환 금지.
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PORTONE_SECRET = process.env.PORTONE_V2_API_SECRET
const RESEND_API_KEY = process.env.RESEND_API_KEY
const MAIL_FROM = process.env.ORDER_MAIL_FROM || 'onboarding@resend.dev'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'POST 요청만 허용됩니다.' })
    return
  }
  if (!SERVICE_ROLE || !PORTONE_SECRET) {
    res.status(500).json({
      ok: false,
      reason:
        '서버 환경변수 누락: SUPABASE_SERVICE_ROLE_KEY / PORTONE_V2_API_SECRET 를 Vercel 에 추가하세요.',
    })
    return
  }

  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const paymentId = (body as { paymentId?: string } | null)?.paymentId
  if (!paymentId) {
    res.status(400).json({ ok: false, reason: 'paymentId 가 필요합니다.' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 1) 이 결제(payment_id)에 속한 주문행 전부 조회 (장바구니 다건 주문은 상품별로 여러 행)
  const { data: orderRows, error: selErr } = await supabase
    .from('orders')
    .select('id, product_id, quantity, amount, status, order_name, buyer_name, buyer_email, products(name)')
    .eq('payment_id', paymentId)

  if (selErr || !orderRows || orderRows.length === 0) {
    res.status(404).json({ ok: false, reason: '주문을 찾을 수 없습니다.' })
    return
  }
  if (orderRows[0].status === 'paid') {
    // 이미 처리된 결제(중복 콜백) — 성공으로 응답만
    res.status(200).json({ ok: true })
    return
  }
  const expectedAmount = orderRows.reduce((s, r) => s + (r.amount as number), 0)

  // 2) 포트원 실제 결제 조회
  let payment: {
    status?: string
    amount?: { total?: number }
    pgTxId?: string
    transactionId?: string
  }
  try {
    const r = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `PortOne ${PORTONE_SECRET}` } }
    )
    if (!r.ok) {
      const text = await r.text()
      console.error('[payment-complete] portone lookup failed', r.status, text)
      res.status(200).json({ ok: false, reason: `포트원 결제 조회 실패 (${r.status})` })
      return
    }
    payment = await r.json()
  } catch (e) {
    console.error('[payment-complete] portone request error', e)
    res.status(200).json({ ok: false, reason: '포트원 결제 조회 요청에 실패했습니다.' })
    return
  }

  const paidStatus = payment?.status
  const paidAmount = payment?.amount?.total
  const pgTxId = payment?.pgTxId ?? payment?.transactionId ?? null

  // 3) 검증: 결제완료 + 금액 일치 (위변조 방지, 여러 상품행의 합계와 비교)
  if (paidStatus !== 'PAID') {
    await supabase.from('orders').update({ status: 'failed' }).eq('payment_id', paymentId)
    res.status(200).json({ ok: false, reason: `결제 상태가 PAID 가 아닙니다. (${paidStatus ?? '알수없음'})` })
    return
  }
  if (paidAmount !== expectedAmount) {
    await supabase.from('orders').update({ status: 'failed' }).eq('payment_id', paymentId)
    res
      .status(200)
      .json({ ok: false, reason: `결제 금액 불일치 (기대 ${expectedAmount}, 실제 ${paidAmount})` })
    return
  }

  // 4) 성공 → 주문 확정
  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: 'paid', pg_tx_id: pgTxId })
    .eq('payment_id', paymentId)

  if (updErr) {
    console.error('[payment-complete] order update failed', updErr)
    res.status(200).json({ ok: false, reason: '주문 상태 업데이트에 실패했습니다.' })
    return
  }

  // 5) 재고 차감 (배송비 행은 product_id 가 없으므로 제외)
  for (const row of orderRows) {
    if (!row.product_id) continue
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', row.product_id)
      .single()
    if (!product) continue
    const nextStock = Math.max(0, (product.stock as number) - (row.quantity as number))
    await supabase
      .from('products')
      .update({ stock: nextStock, ...(nextStock === 0 ? { status: 'sold_out' } : {}) })
      .eq('id', row.product_id)
  }

  // 6) 주문 확인 이메일 발송 (RESEND_API_KEY 없으면 조용히 건너뜀 — 결제 성공 응답을 막지 않음)
  const buyerEmail = orderRows.find((r) => r.buyer_email)?.buyer_email as string | undefined
  if (RESEND_API_KEY && buyerEmail) {
    try {
      const buyerName = (orderRows.find((r) => r.buyer_name)?.buyer_name as string | undefined) ?? '고객'
      const orderName = (orderRows[0].order_name as string | undefined) ?? '주문 상품'
      const itemLines = orderRows
        .map((r) => {
          const productName = (r as unknown as { products?: { name?: string } | null }).products?.name ?? r.order_name
          return `<tr><td style="padding:8px 0;">${productName}</td><td style="padding:8px 0;text-align:center;">${r.quantity}</td><td style="padding:8px 0;text-align:right;">${(r.amount as number).toLocaleString('ko-KR')}원</td></tr>`
        })
        .join('')
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `뷰티그라운드 <${MAIL_FROM}>`,
          to: [buyerEmail],
          subject: `[뷰티그라운드] 주문이 완료되었습니다 - ${orderName}`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
              <h2 style="color:#b8924a;">주문이 완료되었습니다</h2>
              <p>${buyerName}님, 주문해 주셔서 감사합니다.</p>
              <table style="width:100%;border-collapse:collapse;margin-top:16px;">
                <thead><tr style="border-bottom:1px solid #e5e0d8;"><th style="text-align:left;padding:8px 0;">상품</th><th style="padding:8px 0;">수량</th><th style="text-align:right;padding:8px 0;">금액</th></tr></thead>
                <tbody>${itemLines}</tbody>
                <tfoot><tr style="border-top:1px solid #e5e0d8;font-weight:bold;"><td style="padding:8px 0;" colspan="2">총 결제금액</td><td style="text-align:right;padding:8px 0;">${expectedAmount.toLocaleString('ko-KR')}원</td></tr></tfoot>
              </table>
              <p style="color:#888;font-size:13px;margin-top:24px;">문의: beautyground.official@gmail.com</p>
            </div>
          `,
        }),
      })
    } catch (e) {
      console.error('[payment-complete] order email send failed', e)
      // 이메일 실패는 결제 성공 응답에 영향 주지 않음
    }
  }

  res.status(200).json({ ok: true })
}
