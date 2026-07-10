import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'

// 주문내역 — 같은 결제(payment_id) 단위로 묶어 보여준다.
// 결제 미완료(pending/failed) 행은 잔재이므로 표시하지 않는다.

interface OrderRow extends Order {
  products?: { name: string | null; thumbnail_url: string | null } | null
}

interface OrderGroup {
  paymentId: string
  createdAt: string
  status: Order['status']
  items: OrderRow[] // 배송비 행 제외
  shippingFee: number
  total: number
  trackingNumber: string | null
  trackingCarrier: string | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  paid: { label: '결제완료', cls: 'bg-gold/15 text-gold' },
  shipped: { label: '배송중', cls: 'bg-[#EEF3FE] text-[#2E5AAC]' },
  done: { label: '배송완료', cls: 'bg-[#E1F5EE] text-[#0B7A55]' },
  cancelled: { label: '취소됨', cls: 'bg-cream-3 text-text-hint' },
  cancel_requested: { label: '취소 요청됨', cls: 'bg-[#FDF0EC] text-[#B4472A]' },
}
const VISIBLE_STATUSES = new Set(Object.keys(STATUS_BADGE))

function groupOrders(rows: OrderRow[]): OrderGroup[] {
  const byPayment = new Map<string, OrderRow[]>()
  for (const r of rows) {
    if (!VISIBLE_STATUSES.has(r.status)) continue
    const key = r.payment_id ?? r.id
    if (!byPayment.has(key)) byPayment.set(key, [])
    byPayment.get(key)!.push(r)
  }
  const groups: OrderGroup[] = []
  for (const [paymentId, list] of byPayment) {
    const items = list.filter((r) => r.order_name !== '배송비' && r.product_id)
    const shippingFee = list
      .filter((r) => r.order_name === '배송비' || !r.product_id)
      .reduce((s, r) => s + r.amount, 0)
    const total = list.reduce((s, r) => s + r.amount, 0)
    const first = items[0] ?? list[0]
    const tracked = list.find((r) => r.tracking_number)
    groups.push({
      paymentId,
      createdAt: first.created_at,
      status: first.status,
      items,
      shippingFee,
      total,
      trackingNumber: tracked?.tracking_number ?? null,
      trackingCarrier: tracked?.tracking_carrier ?? null,
    })
  }
  groups.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return groups
}

export default function AppOrders() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [groups, setGroups] = useState<OrderGroup[]>([])
  const [msg, setMsg] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoggedIn(false); setLoading(false); return }
    const { data } = await supabase
      .from('orders')
      .select('*, products(name, thumbnail_url)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(300)
    setGroups(groupOrders((data ?? []) as OrderRow[]))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const requestCancel = async (g: OrderGroup) => {
    if (!window.confirm('이 주문의 취소를 요청할까요?\n판매자 확인 후 취소가 확정됩니다.')) return
    setCancelling(g.paymentId)
    setMsg('')
    const { data, error } = await supabase.rpc('request_order_cancel', { p_payment_id: g.paymentId })
    setCancelling(null)
    if (error || !data) {
      setMsg('취소 요청에 실패했습니다. 고객센터(02-897-8287)로 연락해 주세요.')
      return
    }
    setGroups((prev) => prev.map((x) => (x.paymentId === g.paymentId ? { ...x, status: 'cancel_requested' } : x)))
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-text-hint text-[14px]">불러오는 중...</div>
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-cream-4">
        <BackHeader title="주문 내역" />
        <div className="flex flex-col items-center justify-center px-8 pt-28 text-center">
          <p className="text-[15px] text-text mb-2 font-semibold">로그인이 필요해요</p>
          <p className="text-[13px] text-text-hint mb-6">주문 내역은 로그인 후 확인할 수 있어요.</p>
          <button onClick={() => navigate('/app/login')} className="bg-gold text-white font-semibold text-[14px] px-8 py-3.5 rounded-pill">
            로그인하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-4 pb-16">
      <BackHeader title="주문 내역" />

      {msg && (
        <div className="mx-4 mt-3 bg-[#FDF0EC] text-[#B4472A] text-[12.5px] rounded-md px-4 py-3">{msg}</div>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 pt-28 text-center">
          <div className="text-4xl mb-4" aria-hidden="true">📦</div>
          <p className="text-[15px] text-text font-semibold mb-2">아직 주문 내역이 없어요</p>
          <p className="text-[13px] text-text-hint mb-6">마음에 드는 상품을 찾아보세요.</p>
          <button onClick={() => navigate('/app/home')} className="bg-gold text-white font-semibold text-[14px] px-8 py-3.5 rounded-pill">
            쇼핑하러 가기
          </button>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          {groups.map((g) => {
            const badge = STATUS_BADGE[g.status] ?? STATUS_BADGE.paid
            const d = new Date(g.createdAt)
            const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
            return (
              <div key={g.paymentId} className="bg-white rounded-[14px] border border-cream-2 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-cream-3">
                  <span className="text-[12.5px] text-text-hint">{dateStr} 주문</span>
                  <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-pill ${badge.cls}`}>{badge.label}</span>
                </div>

                <div className="divide-y divide-cream-3">
                  {g.items.map((it) => (
                    <Link
                      key={it.id}
                      to={it.product_id ? `/app/product/${it.product_id}` : '#'}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="w-14 h-14 rounded-md bg-cream-3 overflow-hidden shrink-0">
                        {it.products?.thumbnail_url && (
                          <img src={it.products.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] text-text truncate">{it.products?.name ?? it.order_name ?? '상품'}</p>
                        <p className="text-[12px] text-text-hint mt-0.5">
                          {it.quantity}개 · {it.amount.toLocaleString('ko-KR')}원
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="px-4 py-3 bg-cream-4/60 border-t border-cream-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-text-hint">
                      {g.shippingFee > 0 ? `배송비 ${g.shippingFee.toLocaleString('ko-KR')}원 포함` : '무료배송'}
                    </span>
                    <span className="text-[14.5px] font-bold text-text">
                      총 {g.total.toLocaleString('ko-KR')}원
                    </span>
                  </div>

                  {g.trackingNumber && (
                    <p className="mt-2 text-[12.5px] text-text-sub">
                      🚚 {g.trackingCarrier ? `${g.trackingCarrier} ` : ''}운송장 <b className="select-all">{g.trackingNumber}</b>
                    </p>
                  )}

                  {g.status === 'paid' && (
                    <button
                      onClick={() => requestCancel(g)}
                      disabled={cancelling === g.paymentId}
                      className="mt-3 w-full text-[13px] text-text-sub border border-cream-2 rounded-md py-2.5 bg-white hover:bg-cream-4 transition disabled:opacity-50"
                    >
                      {cancelling === g.paymentId ? '요청 중...' : '주문 취소 요청'}
                    </button>
                  )}
                  {g.status === 'cancel_requested' && (
                    <p className="mt-2 text-[12px] text-[#B4472A]">판매자 확인 후 취소가 확정됩니다.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
