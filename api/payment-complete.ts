import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// 서버 전용 값 (Vercel 환경변수). 클라이언트로 절대 반환 금지.
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PORTONE_SECRET = process.env.PORTONE_V2_API_SECRET
// 메일은 Gmail SMTP(앱 비밀번호)로 보낸다. Resend 는 API 키를 끝내 등록하지 않아
// "키 없으면 조용히 건너뜀" 상태로 주문확인 메일이 한 통도 안 나가고 있었다(2026-09-09).
// GMAIL_USER / GMAIL_APP_PASSWORD 는 api/export-brand.ts 가 이미 쓰고 있는 값이라 추가 설정이 없다.
const GMAIL_USER = process.env.GMAIL_USER || 'beautyground.official@gmail.com'
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || ''
// 주문·취소가 나면 대표님이 바로 아셔야 한다(2026-09-09 지시). 손님 메일과 별개로 사본을 보낸다.
const ADMIN_MAIL = 'beautyground.official@gmail.com'
// 대사 작업(?job=reconcile)은 Vercel 크론만 호출할 수 있게 막는다
const CRON_SECRET = process.env.CRON_SECRET

// 배송정책 상수 — src/constants/index.ts 와 동일하게 유지할 것(불일치 시 정상결제가 거부되는 방향이라 안전).
// 2026-08-12 대표님 지시: 배송비 3,000원 · 3만원 이상 무료
const SHIPPING_FEE = 3000
const FREE_SHIPPING_THRESHOLD = 30000

// 메일 발송은 절대 결제 처리를 막지 않는다 — 메일이 안 나가는 것보다 결제가 안 되는 게 훨씬 큰 사고다.
// 그래서 모든 예외를 여기서 삼키고 로그만 남긴다.
async function sendMail(to: string, subject: string, html: string) {
  if (!GMAIL_APP_PASSWORD) {
    console.error('[payment-complete] GMAIL_APP_PASSWORD 없음 — 메일 건너뜀:', subject)
    return
  }
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
    await transporter.sendMail({ from: `"뷰티그라운드" <${GMAIL_USER}>`, to, subject, html })
  } catch (e) {
    console.error('[payment-complete] 메일 발송 실패', subject, e)
  }
}

const won = (n: number) => `${(n || 0).toLocaleString('ko-KR')}원`

// ── ?job=reconcile ────────────────────────────────────────────────────────
// 하루 한 번 DB 와 포트원 원장을 맞춰본다.
//
// 왜 필요한가: 우리 주문 상태는 ①브라우저 콜백 ②포트원 웹훅 두 경로로만 갱신된다.
// 둘 다 네트워크 너머의 일이라 언젠가는 빠진다 — 웹훅 구독이 빠져 있거나, 배포 중이라
// 응답을 못 하거나, 재전송이 모두 실패하는 경우다. 그러면 DB 와 실제 돈이 어긋난 채로
// 아무도 모르게 남는다. 특히 '포트원은 취소됐는데 우리는 paid' 는 재고와 정산이 같이 틀어진다.
//
// 그래서 웹훅을 믿지 않고, 최근 주문을 직접 조회해 어긋난 것만 바로잡는다.
// 고친 게 있으면 대표님께 메일로 알린다. 조용히 고치면 왜 바뀌었는지 아무도 모른다.
async function reconcileHandler(req: VercelRequest, res: VercelResponse) {
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    res.status(401).json({ ok: false, reason: '인증 실패' })
    return
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE as string)
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('orders')
    .select('payment_id, status')
    .gte('created_at', since)
    .not('payment_id', 'is', null)
  type R = { payment_id: string; status: string }
  const list = (rows ?? []) as unknown as R[]

  // payment_id 하나가 여러 행(상품·배송비)으로 쪼개져 있으므로 결제 단위로 묶는다
  const byPid = new Map<string, string[]>()
  for (const r of list) {
    if (!r.payment_id.startsWith('order')) continue // staff_* 는 무통장입금이라 PG 원장이 없다
    byPid.set(r.payment_id, [...(byPid.get(r.payment_id) ?? []), r.status])
  }

  // 포트원 상태 → 우리가 가져야 할 상태. shipped/done 은 배송이 진행된 것이라 건드리지 않는다.
  const want = (pgStatus: string): string | null =>
    pgStatus === 'PAID' ? 'paid' : pgStatus === 'CANCELLED' ? 'cancelled' : pgStatus === 'FAILED' ? 'failed' : null

  const fixed: string[] = []
  const alerts: string[] = []
  let checked = 0
  for (const [pid, statuses] of byPid) {
    let pg: { status?: string; amount?: { total?: number } }
    try {
      const r = await fetch(`https://api.portone.io/payments/${encodeURIComponent(pid)}`, {
        headers: { Authorization: `PortOne ${PORTONE_SECRET}` },
      })
      if (!r.ok) continue
      pg = await r.json()
    } catch {
      continue
    }
    checked++
    const target = want(pg.status ?? '')
    if (!target) continue
    const current = statuses[0]
    if (current === target) continue
    if (['shipped', 'done'].includes(current)) {
      // 배송이 나간 뒤 PG 에서 취소된 건 — 자동으로 되돌리면 안 된다. 사람이 판단할 일이다.
      if (target === 'cancelled') alerts.push(`${pid}: 배송(${current}) 뒤 PG 취소됨 — 확인 필요`)
      continue
    }
    // cancel_requested 는 손님이 요청만 한 상태라, PG 가 아직 PAID 면 그대로 둔다
    if (current === 'cancel_requested' && target === 'paid') continue
    const { data: flipped } = await supabase
      .from('orders')
      .update({ status: target })
      .eq('payment_id', pid)
      .neq('status', target)
      .select('id')
    if ((flipped ?? []).length > 0) fixed.push(`${pid}: ${current} → ${target} (PG=${pg.status})`)
  }

  if (fixed.length > 0 || alerts.length > 0) {
    await sendMail(
      ADMIN_MAIL,
      `[주문 대사] ${fixed.length}건 정정${alerts.length ? ` · ${alerts.length}건 확인필요` : ''}`,
      `<div style="font-family:sans-serif">
         <h3>포트원 원장과 어긋난 주문을 맞췄습니다</h3>
         <p style="color:#888">최근 14일 · 결제 ${checked}건 확인</p>
         ${fixed.length ? `<h4>정정됨</h4><ul>${fixed.map((s) => `<li>${s}</li>`).join('')}</ul>` : ''}
         ${alerts.length ? `<h4>🔴 사람이 확인해야 함</h4><ul>${alerts.map((s) => `<li>${s}</li>`).join('')}</ul>` : ''}
       </div>`
    )
  }
  res.status(200).json({ ok: true, checked, fixed, alerts })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.job === 'reconcile') {
    if (!SERVICE_ROLE || !PORTONE_SECRET) {
      res.status(500).json({ ok: false, reason: '서버 환경변수 누락' })
      return
    }
    await reconcileHandler(req, res)
    return
  }
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
  // 두 경로 지원: ①결제 직후 브라우저가 호출({paymentId}) ②포트원 V2 웹훅({type, data:{paymentId}})
  // 웹훅은 사용자가 결제창 닫고 이탈해도 서버가 직접 통보받아 주문확정·재고차감이 누락되지 않게 하는 안전망.
  // 위변조 걱정 없음 — 어느 경로든 아래에서 포트원 API로 실제 결제 상태·금액을 재조회해 검증함.
  const webhookType = (body as { type?: string } | null)?.type
  // 결제창을 못 띄웠거나 사용자가 닫은 경우 브라우저가 이 플래그로 알려온다(2026-09-01).
  // 예전엔 브라우저가 orders 를 직접 update 했는데, RLS 상 아무 역할도 UPDATE 권한이 없어
  // 회원·비회원 모두 조용히 실패하고 pending 행이 계속 쌓였다. 서버(service role)에서 처리한다.
  const markFailed = (body as { markFailed?: boolean } | null)?.markFailed === true
  const paymentId =
    (body as { paymentId?: string } | null)?.paymentId ??
    (body as { data?: { paymentId?: string } } | null)?.data?.paymentId
  // 예전엔 Transaction.Paid 외의 웹훅을 전부 무시했다. 그 결과 두 가지가 새고 있었다(2026-09-09 점검):
  //  ① 결제창을 그냥 닫으면 아무도 알려주지 않아 pending 행이 영구히 남았다(실제로 22건 누적).
  //  ② 가맹점관리자(KG이니시스)에서 직접 취소하면 우리 DB 는 계속 paid 라 재고가 안 돌아오고 정산에 잡혔다.
  // 이제 Failed 는 주문을 failed 로, Cancelled 는 cancelled + 재고복구까지 처리한다.
  const WEBHOOK_FAILED = ['Transaction.Failed']
  const WEBHOOK_CANCELLED = ['Transaction.Cancelled', 'Transaction.PartialCancelled']
  const handledWebhook =
    !webhookType ||
    webhookType === 'Transaction.Paid' ||
    WEBHOOK_FAILED.includes(webhookType) ||
    WEBHOOK_CANCELLED.includes(webhookType)
  if (!handledWebhook) {
    // Ready 등 상태를 바꿀 필요가 없는 웹훅 — 200 으로 받아만 준다(재전송 폭주 방지)
    res.status(200).json({ ok: true, skipped: webhookType })
    return
  }
  if (!paymentId) {
    res.status(400).json({ ok: false, reason: 'paymentId 가 필요합니다.' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  if (webhookType && webhookType !== 'Transaction.Paid') {
    const isCancel = WEBHOOK_CANCELLED.includes(webhookType)
    const { data: rows } = await supabase
      .from('orders')
      .select('id, product_id, quantity, status, order_name, buyer_name, amount')
      .eq('payment_id', paymentId)
    if (!rows || rows.length === 0) {
      // 포트원 콘솔 '호출 테스트'(가짜 결제ID)도 여기로 온다 — 200 으로 조용히 넘긴다
      res.status(200).json({ ok: true, skipped: 'order_not_found' })
      return
    }
    type Row = { id: string; product_id: string | null; quantity: number; status: string; order_name: string | null; buyer_name: string | null; amount: number }
    const list = rows as unknown as Row[]

    if (!isCancel) {
      // 결제 실패 — pending 인 행만 내린다. 이미 paid 인 건을 실패로 덮어쓰면 주문이 사라진다.
      const { data: flipped } = await supabase
        .from('orders')
        .update({ status: 'failed' })
        .eq('payment_id', paymentId)
        .eq('status', 'pending')
        .select('id')
      res.status(200).json({ ok: true, marked: 'failed', rows: (flipped ?? []).length })
      return
    }

    // 취소 — 아직 cancelled 가 아닌 행만 뒤집는다. 이 조건 덕분에 관리자 화면의 취소(api/order-cancel.ts)와
    // 웹훅이 동시에 들어와도 재고가 두 번 복구되지 않는다.
    const hadPayment = list.some((r) => ['paid', 'cancel_requested', 'shipped', 'done'].includes(r.status))
    const { data: flipped } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('payment_id', paymentId)
      .neq('status', 'cancelled')
      .select('id, product_id, quantity')
    const flippedRows = (flipped ?? []) as unknown as { id: string; product_id: string | null; quantity: number }[]
    if (flippedRows.length === 0) {
      res.status(200).json({ ok: true, already: 'cancelled' })
      return
    }
    if (hadPayment) {
      for (const row of flippedRows) {
        if (!row.product_id) continue
        const { data: product } = await supabase
          .from('products')
          .select('stock, status')
          .eq('id', row.product_id)
          .single()
        if (!product) continue
        const nextStock = (product.stock as number) + row.quantity
        await supabase
          .from('products')
          .update({ stock: nextStock, ...(product.status === 'sold_out' && nextStock > 0 ? { status: 'on_sale' } : {}) })
          .eq('id', row.product_id)
      }
    }
    // 우리 화면을 거치지 않은 취소(가맹점관리자에서 직접 취소 등)일 수 있으므로 대표님께 알린다
    const total = list.reduce((s, r) => s + (r.amount || 0), 0)
    await sendMail(
      ADMIN_MAIL,
      `[뷰티그라운드] 결제 취소 발생 — ${list[0].order_name ?? '주문'} ${won(total)}`,
      `<div style="font-family:sans-serif"><h3>결제가 취소되었습니다</h3>
       <p>포트원 웹훅(${webhookType})으로 통보받았습니다. 관리자 화면을 거치지 않은 취소일 수 있습니다.</p>
       <ul><li>주문번호: ${paymentId}</li><li>구매자: ${list[0].buyer_name ?? '-'}</li>
       <li>금액: ${won(total)}</li><li>재고 복구: ${hadPayment ? '완료' : '해당없음(미결제 주문)'}</li></ul></div>`
    )
    res.status(200).json({ ok: true, marked: 'cancelled', rows: flippedRows.length })
    return
  }

  // 1) 이 결제(payment_id)에 속한 주문행 전부 조회 (장바구니 다건 주문은 상품별로 여러 행)
  const { data: orderRows, error: selErr } = await supabase
    .from('orders')
    .select('id, product_id, partner_id, quantity, amount, status, order_name, buyer_name, buyer_email, buyer_phone, live_id, user_id, products(name, price, sale_price)')
    .eq('payment_id', paymentId)

  if (selErr || !orderRows || orderRows.length === 0) {
    // 웹훅 경로는 200으로 응답 — 포트원 콘솔 '호출 테스트'(가짜 결제ID)와 재전송 폭주 방지.
    // 브라우저 검증 경로는 기존대로 404 유지(클라이언트가 실패를 알아야 함).
    res.status(webhookType ? 200 : 404).json({ ok: false, reason: '주문을 찾을 수 없습니다.' })
    return
  }
  // 결제 실패/취소 기록 — pending 인 주문만, 그리고 포트원에 실제 결제가 없을 때만 failed 로 내린다.
  // (실제로 승인된 결제를 실패로 덮어쓰면 주문이 사라지므로 반드시 PG 상태를 먼저 확인한다)
  if (markFailed) {
    if (!orderRows.every((r) => r.status === 'pending')) {
      res.status(200).json({ ok: true, skipped: 'not_pending' })
      return
    }
    try {
      const pr = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `PortOne ${PORTONE_SECRET}` },
      })
      if (pr.ok) {
        const pay = (await pr.json()) as { status?: string }
        if (pay?.status === 'PAID') {
          // 실제로는 결제가 된 건 — 실패로 내리면 안 된다
          res.status(200).json({ ok: false, reason: '결제가 완료된 주문입니다.' })
          return
        }
      }
    } catch {
      // 포트원 조회 실패는 무시하고 진행 — pending 이었던 것은 확인했다
    }
    const { error: failErr } = await supabase
      .from('orders')
      .update({ status: 'failed' })
      .eq('payment_id', paymentId)
      .eq('status', 'pending')
    if (failErr) {
      res.status(200).json({ ok: false, reason: '주문 상태 변경에 실패했습니다.' })
      return
    }
    res.status(200).json({ ok: true, marked: 'failed' })
    return
  }

  if (orderRows[0].status === 'paid') {
    // 이미 처리된 결제(중복 콜백) — 성공으로 응답만
    res.status(200).json({ ok: true })
    return
  }
  // ⚠️ 결제 금액 위변조 방지 — 클라이언트가 orders.amount 에 써넣은 값을 절대 신뢰하지 않고,
  // 서버가 DB의 실제 상품가격(products.sale_price ?? price)·배송비·쿠폰으로 기대금액을 직접 재산출한다.
  // (예전엔 orderRows 의 amount 를 그대로 합산해, 손님이 30만원 상품을 100원으로 주문·결제할 수 있었음)
  type JoinedRow = {
    product_id: string | null
    partner_id: string | null
    quantity: number
    live_id?: string | null
    user_id?: string | null
    buyer_email?: string | null
    products?: { price?: number; sale_price?: number | null } | null
  }
  const rows = orderRows as unknown as JoinedRow[]

  // VVIP 할인(백화점 입점 20% / 온라인 전용 30%, 적립 없음) — src/lib/vvip.ts와 동일 공식을 유지할 것
  // (클라이언트 AppOrder.tsx가 요청한 결제금액과 여기서 재산출한 금액이 같아야 결제가 통과됨).
  // app_vvip은 이메일 화이트리스트라 service role로 직접 조회(is_vvip() RPC는 JWT 세션 필요라 여기선 못 씀).
  const buyerEmailForVvip = (rows.find((r) => r.buyer_email)?.buyer_email as string | undefined)?.toLowerCase().trim()
  let buyerIsVvip = false
  if (buyerEmailForVvip) {
    const { data: vvipRow } = await supabase
      .from('app_vvip')
      .select('email')
      .eq('email', buyerEmailForVvip)
      .maybeSingle()
    buyerIsVvip = !!vvipRow
  }
  const deptStoreMap = new Map<string, boolean>()
  if (buyerIsVvip) {
    const partnerIds = [...new Set(rows.map((r) => r.partner_id).filter((v): v is string => !!v))]
    if (partnerIds.length > 0) {
      const { data: partnerRows } = await supabase
        .from('partners')
        .select('id, is_dept_store_brand')
        .in('id', partnerIds)
      for (const p of (partnerRows ?? []) as { id: string; is_dept_store_brand: boolean }[]) {
        deptStoreMap.set(p.id, p.is_dept_store_brand)
      }
    }
  }
  const vvipUnitPrice = (unit: number, partnerId: string | null): number => {
    if (!buyerIsVvip) return unit
    const isDeptStore = partnerId ? (deptStoreMap.get(partnerId) ?? true) : true
    const rate = isDeptStore ? 0.2 : 0.3
    return Math.round(unit * (1 - rate))
  }

  // 1) 상품 소계 = Σ (실제 판매가 × 수량, VVIP면 브랜드별 할인 반영). product_id 없는 행(배송비/쿠폰 행)은 서버가 별도 재계산하므로 무시.
  let authoritativeSubtotal = 0
  for (const r of rows) {
    if (!r.product_id || !r.products) continue
    const baseUnit = r.products.sale_price ?? r.products.price ?? 0
    const unit = vvipUnitPrice(baseUnit, r.partner_id)
    authoritativeSubtotal += unit * (r.quantity as number)
  }

  // 2) 배송비 = 소계 기준 재계산 (클라이언트 배송비 행 무시)
  const shippingFee =
    authoritativeSubtotal > 0 && authoritativeSubtotal < FREE_SHIPPING_THRESHOLD ? SHIPPING_FEE : 0

  // 3) 라이브 쿠폰 할인 = DB 쿠폰으로 재계산 (활성·최소구매액 충족 시에만). 클라이언트 쿠폰 행 무시.
  let couponDiscount = 0
  const liveId = rows.find((r) => r.live_id)?.live_id ?? null
  if (liveId) {
    const { data: coupon } = await supabase
      .from('live_coupons')
      .select('discount_type, discount_value, min_purchase, active')
      .eq('live_id', liveId)
      .eq('active', true)
      .maybeSingle()
    const c = coupon as { discount_type?: string; discount_value?: number; min_purchase?: number } | null
    if (c && c.discount_value && authoritativeSubtotal >= (c.min_purchase ?? 0)) {
      const raw =
        c.discount_type === 'percent'
          ? Math.round((authoritativeSubtotal * c.discount_value) / 100)
          : c.discount_value
      couponDiscount = Math.min(raw, authoritativeSubtotal)
    }
  }

  // 4) 적립금 사용액 = 결제 직전 redeem_points RPC로 이미 원자 확정된 값을 그대로 신뢰(라이브쿠폰과 동일 관례 —
  //    클라이언트가 만든 order 행이 아니라 point_transactions 원장 자체를 조회).
  const { data: pointRows } = await supabase
    .from('point_transactions')
    .select('amount')
    .eq('payment_id', paymentId)
    .lt('amount', 0)
  let pointsDiscount = (pointRows ?? []).reduce((s, r) => s + Math.abs((r as { amount: number }).amount), 0)

  // 적립금 사용 조건: 3만원 이상 구매에만 허용 (2026-08-18 대표님 확정) — 미달이면 차감분을 되돌리고 미적용 처리
  const POINTS_MIN_ORDER = 30000
  if (pointsDiscount > 0 && authoritativeSubtotal < POINTS_MIN_ORDER) {
    await supabase.from('point_transactions').delete().eq('payment_id', paymentId).lt('amount', 0)
    pointsDiscount = 0
  }

  // 5) 가입 쿠폰(첫구매 등) 사용분 = user_coupons에서 이 결제로 확정된 쿠폰을 조회해 서버가 직접 재계산(클라이언트 금액 불신).
  const { data: usedCoupon } = await supabase
    .from('user_coupons')
    .select('id, coupon_templates(discount_type, discount_value, max_discount, min_order_amount)')
    .eq('payment_id', paymentId)
    .not('used_at', 'is', null)
    .maybeSingle()
  type CouponTemplate = { discount_type: string; discount_value: number; max_discount: number | null; min_order_amount: number }
  // supabase-js 타입 추론이 조인 결과를 배열로 보는 것과 실제 단일 객체 응답이 어긋나 unknown 경유 캐스팅(런타임 동작 동일)
  const ct = (usedCoupon as unknown as { coupon_templates?: CouponTemplate | null } | null)?.coupon_templates ?? null
  let signupCouponDiscount = 0
  let signupFreeShip = false
  if (ct && authoritativeSubtotal >= ct.min_order_amount) {
    if (ct.discount_type === 'free_shipping') {
      signupFreeShip = true
    } else if (ct.discount_type === 'percent') {
      const raw = Math.round((authoritativeSubtotal * ct.discount_value) / 100)
      signupCouponDiscount = Math.min(raw, ct.max_discount ?? raw, authoritativeSubtotal)
    } else {
      signupCouponDiscount = Math.min(ct.discount_value, authoritativeSubtotal)
    }
  }
  const finalShippingFee = signupFreeShip ? 0 : shippingFee

  const expectedAmount = authoritativeSubtotal + finalShippingFee - couponDiscount - pointsDiscount - signupCouponDiscount

  // 결제 실패/금액불일치 시 적립금·쿠폰 사용을 되돌리는 헬퍼(사용자가 손해보지 않게)
  const releaseRewards = async () => {
    if (pointsDiscount > 0) await supabase.from('point_transactions').delete().eq('payment_id', paymentId).lt('amount', 0)
    if (usedCoupon) await supabase.from('user_coupons').update({ used_at: null, payment_id: null }).eq('payment_id', paymentId)
  }

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
    await releaseRewards()
    res.status(200).json({ ok: false, reason: `결제 상태가 PAID 가 아닙니다. (${paidStatus ?? '알수없음'})` })
    return
  }
  if (paidAmount !== expectedAmount) {
    // 여기는 PG 가 PAID 라고 답한 상태다 — 즉 손님 카드에서 돈이 이미 빠져나갔다.
    // 예전엔 주문만 failed 로 내리고 끝나서, 돈은 우리가 들고 있는데 주문은 없는 상태가 됐다.
    // 금액이 안 맞으면 그 결제는 성립시킬 수 없으므로 즉시 전액 환불한다(2026-09-09).
    let refunded = false
    try {
      const cr = await fetch(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`, {
        method: 'POST',
        headers: { Authorization: `PortOne ${PORTONE_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: `결제금액 불일치 자동취소 (기대 ${expectedAmount}, 실제 ${paidAmount})` }),
      })
      refunded = cr.ok
      if (!cr.ok) console.error('[payment-complete] 금액불일치 자동환불 실패', cr.status, await cr.text())
    } catch (e) {
      console.error('[payment-complete] 금액불일치 자동환불 요청 오류', e)
    }
    await supabase.from('orders').update({ status: refunded ? 'cancelled' : 'failed' }).eq('payment_id', paymentId)
    await releaseRewards()
    // 자동환불까지 실패하면 사람이 손으로 처리해야 한다 — 반드시 알린다
    await sendMail(
      ADMIN_MAIL,
      `[뷰티그라운드] ${refunded ? '금액불일치 자동환불' : '🚨 금액불일치 환불실패 — 수동처리 필요'} ${paymentId}`,
      `<div style="font-family:sans-serif"><h3>결제 금액이 서버 재계산값과 다릅니다</h3>
       <ul><li>주문번호: ${paymentId}</li><li>서버 기대금액: ${won(expectedAmount)}</li>
       <li>실제 결제금액: ${won(paidAmount ?? 0)}</li>
       <li>자동환불: ${refunded ? '성공 (주문 cancelled)' : '❌ 실패 — 포트원 콘솔에서 직접 취소하세요'}</li></ul></div>`
    )
    res
      .status(200)
      .json({ ok: false, reason: `결제 금액 불일치 (기대 ${expectedAmount}, 실제 ${paidAmount})`, refunded })
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

  // 4.5) 구매 적립금 지급 — 회원등급(membership_tiers.reward_rate)만큼 실결제금액 기준 적립
  // (2026-08-23 대표님 확정: BASIC 1%부터 시작). 비회원(게스트) 주문은 적립 대상 아님.
  // 등급은 "이 주문 이전까지의" 누적 결제금액 기준으로 산정(이번 주문으로 오른 등급은 다음 구매부터 적용).
  // 실패해도 결제 성공 응답에는 영향 주지 않음(포인트는 나중에 수기 보정 가능, 결제 자체가 우선).
  const buyerUserId = (orderRows.find((r) => r.user_id)?.user_id as string | undefined) ?? null
  // VVIP는 할인만 받고 적립은 없음(2026-09-03 대표님 확정) — 등급 적립률과 무관하게 이 주문은 건너뜀.
  if (buyerUserId && paidAmount > 0 && !buyerIsVvip) {
    try {
      const { data: tiers } = await supabase
        .from('membership_tiers')
        .select('min_spent, reward_rate')
        .order('min_spent', { ascending: false })
      const { data: priorOrders } = await supabase
        .from('orders')
        .select('amount, product_id, order_name')
        .eq('user_id', buyerUserId)
        .in('status', ['paid', 'shipped', 'done'])
        .neq('payment_id', paymentId)
      const priorSpent = ((priorOrders ?? []) as { amount: number; product_id: string | null; order_name: string | null }[])
        .filter((o) => o.product_id && o.order_name !== '배송비')
        .reduce((s, o) => s + (o.amount || 0), 0)
      const tierList = (tiers ?? []) as { min_spent: number; reward_rate: number }[]
      const rewardRate = tierList.find((t) => priorSpent >= t.min_spent)?.reward_rate ?? 0
      const rewardPoints = Math.round((paidAmount * rewardRate) / 100)
      if (rewardPoints > 0) {
        await supabase.from('point_transactions').insert({
          user_id: buyerUserId,
          amount: rewardPoints,
          reason: 'purchase_reward',
          payment_id: paymentId,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
      }
    } catch (e) {
      console.error('[payment-complete] purchase reward grant failed', e)
    }
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

  // 6) 주문 확인 메일 — 손님에게 1통, 대표님(관리자)에게 1통.
  //    손님 메일은 이메일이 있을 때만, 관리자 메일은 결제가 났으면 무조건 보낸다(비회원 주문 포함).
  const buyerEmail = orderRows.find((r) => r.buyer_email)?.buyer_email as string | undefined
  const buyerName = (orderRows.find((r) => r.buyer_name)?.buyer_name as string | undefined) ?? '고객'
  const buyerPhone = (orderRows.find((r) => (r as unknown as { buyer_phone?: string }).buyer_phone) as unknown as { buyer_phone?: string } | undefined)?.buyer_phone ?? '-'
  const orderName = (orderRows[0].order_name as string | undefined) ?? '주문 상품'
  const itemLines = orderRows
    .map((r) => {
      const productName = (r as unknown as { products?: { name?: string } | null }).products?.name ?? r.order_name
      return `<tr><td style="padding:8px 0;">${productName}</td><td style="padding:8px 0;text-align:center;">${r.quantity}</td><td style="padding:8px 0;text-align:right;">${won(r.amount as number)}</td></tr>`
    })
    .join('')
  const itemTable = `
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead><tr style="border-bottom:1px solid #e5e0d8;"><th style="text-align:left;padding:8px 0;">상품</th><th style="padding:8px 0;">수량</th><th style="text-align:right;padding:8px 0;">금액</th></tr></thead>
        <tbody>${itemLines}</tbody>
        <tfoot><tr style="border-top:1px solid #e5e0d8;font-weight:bold;"><td style="padding:8px 0;" colspan="2">총 결제금액</td><td style="text-align:right;padding:8px 0;">${won(expectedAmount)}</td></tr></tfoot>
      </table>`

  if (buyerEmail) {
    await sendMail(
      buyerEmail,
      `[뷰티그라운드] 주문이 완료되었습니다 - ${orderName}`,
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
         <h2 style="color:#b8924a;">주문이 완료되었습니다</h2>
         <p>${buyerName}님, 주문해 주셔서 감사합니다.</p>
         ${itemTable}
         <p style="color:#888;font-size:13px;margin-top:24px;">주문번호: ${paymentId}<br/>문의: beautyground.official@gmail.com</p>
       </div>`
    )
  }
  // 관리자 알림 — 대표님이 주문 발생을 바로 아셔야 한다(2026-09-09 지시)
  await sendMail(
    ADMIN_MAIL,
    `[주문] ${buyerName}님 ${won(expectedAmount)} — ${orderName}`,
    `<div style="font-family:sans-serif;max-width:520px;">
       <h3 style="margin:0 0 12px">새 주문이 결제되었습니다</h3>
       <p style="margin:0">구매자 ${buyerName} · ${buyerPhone} · ${buyerEmail ?? '이메일없음'}</p>
       <p style="margin:4px 0 0;color:#888;font-size:13px">주문번호 ${paymentId}</p>
       ${itemTable}
       <p style="margin-top:20px"><a href="https://beautyground.co.kr/admin/orders" style="background:#1a1e36;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">주문 관리 열기</a></p>
     </div>`
  )

  res.status(200).json({ ok: true })
}
