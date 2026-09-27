import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 직원 전용 구매 링크(/staff) 주문 접수 — 몰 orders 기록 + ERP erp_sales·재고차감을 한 번에 처리.
// ERP 쪽은 [직원가-포스제외|정상가:NNNN] 태그로 남겨서, 정산 시(server/config/settlementMethods.js)
// 브랜드는 정상가 기준으로 정확히 정산받고 AK수수료 계산에서만 제외되게 한다(오프라인 직원가와 동일 원리).
// 온라인 주문은 특정 매장 픽업이 아니므로 재고·정산은 광명점 기준으로 고정한다.
const MALL_URL = process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const MALL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ERP_URL = process.env.ERP_SUPABASE_URL || 'https://ndhxicsfgaeqduxtqmmj.supabase.co'
const ERP_KEY = process.env.ERP_SUPABASE_SECRET_KEY
const ERP_STORE = '광명'

// 클라이언트는 상품 id 와 수량만 보낸다. 가격·브랜드·partner_id 는 서버가 DB 에서 다시 읽는다.
// (예전엔 employee_price·normal_price 를 요청값 그대로 써서 누구나 임의 가격으로 주문·ERP 매출·재고차감을 만들 수 있었다 — 2026-09-27 점검)
interface StaffOrderItemInput {
  product_id: string
  qty: number
}
interface StaffOrderItem {
  product_id: string
  partner_id: string | null
  name: string
  brand_name: string
  qty: number
  employee_price: number
  normal_price: number
}

function kstDateParts() {
  const now = new Date()
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${kst.getFullYear()}-${pad(kst.getMonth() + 1)}-${pad(kst.getDate())}`
  const time = `${pad(kst.getHours())}:${pad(kst.getMinutes())}`
  return `${date} (${days[kst.getDay()]}) ${time}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'POST 요청만 허용됩니다.' })
    return
  }
  if (!MALL_KEY || !ERP_KEY) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY 또는 ERP_SUPABASE_SECRET_KEY)' })
    return
  }

  const { items: rawItems, name, phone, address, addressDetail, memo } = req.body as {
    items: StaffOrderItemInput[]
    name: string
    phone: string
    address: string
    addressDetail?: string
    memo?: string
  }
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    res.status(400).json({ ok: false, reason: '품목이 없습니다.' })
    return
  }
  if (!name?.trim() || !phone?.trim() || !address?.trim()) {
    res.status(400).json({ ok: false, reason: '이름·연락처·배송지를 모두 입력해 주세요.' })
    return
  }

  const mall = createClient(MALL_URL, MALL_KEY)
  const erp = createClient(ERP_URL, ERP_KEY)

  // 인증: 로그인 토큰의 주인이 직원(app_staff, supabase/staff_members.sql)이어야 한다.
  // 화면(StaffPurchase.tsx)은 is_staff() 로 가리고 있었지만 이 API 자체는 누구나 호출할 수 있었다.
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
    return
  }
  const { data: userData } = await mall.auth.getUser(token)
  const staffEmail = userData?.user?.email?.toLowerCase().trim()
  if (!staffEmail) {
    res.status(401).json({ ok: false, reason: '인증에 실패했습니다. 다시 로그인해 주세요.' })
    return
  }
  const { data: staffRow } = await mall.from('app_staff').select('email').ilike('email', staffEmail).maybeSingle()
  if (!staffRow) {
    res.status(403).json({ ok: false, reason: '직원 계정만 이용할 수 있습니다.' })
    return
  }

  // 가격·브랜드는 DB 기준으로 재구성 — 직원가(employee_price)가 없는 상품·판매중 아닌 상품·재고 부족은 거절
  const qtyById = new Map<string, number>()
  for (const it of rawItems) {
    const q = Math.floor(Number(it?.qty))
    if (!it?.product_id || !Number.isFinite(q) || q <= 0) {
      res.status(400).json({ ok: false, reason: '품목 정보가 올바르지 않습니다.' })
      return
    }
    qtyById.set(it.product_id, (qtyById.get(it.product_id) ?? 0) + q)
  }
  const { data: productRows, error: prodErr } = await mall
    .from('products')
    .select('id, name, price, sale_price, employee_price, partner_id, stock, status, partners(brand_name)')
    .in('id', [...qtyById.keys()])
  if (prodErr) {
    res.status(500).json({ ok: false, reason: `상품 조회 실패: ${prodErr.message}` })
    return
  }
  type ProdRow = { id: string; name: string; price: number; sale_price: number | null; employee_price: number | null; partner_id: string | null; stock: number; status: string; partners?: { brand_name?: string } | { brand_name?: string }[] | null }
  const items: StaffOrderItem[] = []
  for (const [pid, qty] of qtyById) {
    const p = ((productRows ?? []) as unknown as ProdRow[]).find((r) => r.id === pid)
    if (!p) { res.status(400).json({ ok: false, reason: '존재하지 않는 상품이 있습니다.' }); return }
    if (p.employee_price == null) { res.status(400).json({ ok: false, reason: `"${p.name}"은 직원가 상품이 아닙니다.` }); return }
    if (p.status !== 'on_sale') { res.status(400).json({ ok: false, reason: `"${p.name}"은 현재 판매중이 아닙니다.` }); return }
    if (typeof p.stock === 'number' && p.stock < qty) { res.status(400).json({ ok: false, reason: `"${p.name}" 재고가 부족합니다. (재고 ${p.stock})` }); return }
    const partner = Array.isArray(p.partners) ? p.partners[0] : p.partners
    items.push({
      product_id: p.id,
      partner_id: p.partner_id,
      name: p.name,
      brand_name: partner?.brand_name ?? '',
      qty,
      employee_price: Math.round(Number(p.employee_price)),
      normal_price: Math.round(Number(p.sale_price ?? p.price)),
    })
  }

  const total = items.reduce((s, i) => s + i.employee_price * i.qty, 0)
  const paymentId = `staff_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  const orderName = items.length > 1 ? `[직원가] ${items[0].name} 외 ${items.length - 1}건` : `[직원가] ${items[0].name}`
  const fullMemo = `배송지: ${address} ${addressDetail || ''}`.trim() + (memo?.trim() ? `\n${memo.trim()}` : '')

  const orderRows = items.map((i) => ({
    payment_id: paymentId,
    order_name: orderName,
    product_id: i.product_id,
    partner_id: i.partner_id,
    live_id: null,
    quantity: i.qty,
    amount: i.employee_price * i.qty,
    buyer_name: name.trim(),
    buyer_phone: phone.trim(),
    buyer_email: null,
    status: 'pending' as const,
    user_id: null,
    delivery_memo: fullMemo,
    recipient_name: name.trim(),
    recipient_phone: phone.trim(),
    ship_address: `${address} ${addressDetail || ''}`.trim(),
  }))

  const { error: orderErr } = await mall.from('orders').insert(orderRows)
  if (orderErr) {
    res.status(500).json({ ok: false, reason: `주문 접수 실패: ${orderErr.message}` })
    return
  }

  // ERP 판매기록·재고차감 — 실패해도 주문 자체는 이미 접수됐으니 로그만 남기고 계속 진행
  let erpOk = true
  for (const i of items) {
    try {
      const note = `[직원가-포스제외|정상가:${Math.round(i.normal_price)}]`
      const lineTotal = i.employee_price * i.qty
      const { data: lastRows } = await erp.from('erp_sales').select('no').order('no', { ascending: false }).limit(1)
      const no = (lastRows?.[0]?.no || 0) + 1

      const { error: saleErr } = await erp.from('erp_sales').insert([
        {
          no,
          date: kstDateParts(),
          brand: i.brand_name,
          name: i.name,
          qty: i.qty,
          price: i.employee_price,
          total: lineTotal,
          pay_method: '계좌이체',
          note,
          customer_name: '',
          phone: '',
          point_used: 0,
          point_earned: 0,
          final_pay: lineTotal,
          staff: '온라인(직원링크)',
          store: ERP_STORE,
          gender: '',
          age_group: '',
        },
      ])
      if (saleErr) { erpOk = false; console.error('[staff-order] erp_sales insert failed', i.name, saleErr.message); continue }

      const { data: prodRows } = await erp
        .from('erp_products')
        .select('id,name,stock')
        .eq('store', ERP_STORE)
        .eq('brand', i.brand_name)
      const hit = prodRows?.find((r) => String(r.name || '').trim() === i.name.trim())
      if (hit) {
        const before = parseInt(String(hit.stock ?? '').trim(), 10)
        if (!isNaN(before)) {
          await erp.from('erp_products').update({ stock: String(Math.max(0, before - i.qty)) }).eq('id', hit.id)
        }
      }
    } catch (e) {
      erpOk = false
      console.error('[staff-order] ERP sync exception', i.name, e)
    }
  }

  res.status(200).json({ ok: true, total, erpSynced: erpOk })
}
