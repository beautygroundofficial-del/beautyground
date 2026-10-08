import { useEffect, useState } from 'react'
import { IconSearch, IconShoppingCart } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { Order } from '../../lib/types'
import { won, formatDateTime } from '../../lib/format'

type StatusFilter = Order['status'] | 'all'
type OrderRow = Order & { products: { name: string } | null; partners: { brand_name: string } | null }

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '입금대기' },
  { value: 'paid', label: '결제완료' },
  { value: 'cancel_requested', label: '취소요청' },
  { value: 'shipped', label: '배송중' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소' },
]

// payment_id가 "staff_"로 시작하면 직원 전용 구매(/app/staff-buy)의 무통장입금 주문,
// 그 외 값이 있으면 이니시스 카드결제. 무통장입금은 PG 없이도 지금 바로 운영 가능하다.
const paymentMethod = (o: OrderRow): '무통장입금' | '카드결제' | '-' => {
  if (!o.payment_id) return '-'
  return o.payment_id.startsWith('staff_') ? '무통장입금' : '카드결제'
}

// 강조는 원색 1개(signal-blue)만 — 취소요청(고객 대응 필요)만 danger(red)로 눈에 띄게, 나머지는 회색 톤.
const STATUS_BADGE: Partial<Record<Order['status'], { label: string; className: string }>> = {
  pending:          { label: '결제대기', className: 'bg-quiet text-ink-faint' },
  failed:           { label: '결제실패', className: 'bg-quiet text-ink-faint' },
  paid:             { label: '결제완료', className: 'bg-signal-blue/10 text-signal-blue' },
  cancel_requested: { label: '취소요청', className: 'bg-signal-red/10 text-signal-red' },
  shipped:          { label: '배송중', className: 'bg-quiet text-ink-soft' },
  done:             { label: '완료', className: 'bg-signal-blue/10 text-signal-blue' },
  cancelled:        { label: '취소', className: 'bg-quiet text-ink-faint' },
}

const STATUS_OPTIONS: { value: Order['status']; label: string }[] = [
  { value: 'pending', label: '입금대기' },
  { value: 'paid', label: '결제완료(입금확인)' },
  { value: 'cancel_requested', label: '취소요청(고객)' },
  { value: 'shipped', label: '배송중' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소' },
]

export default function AdminOrders() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, products(name), partners(brand_name)')
      .order('created_at', { ascending: false })
      .limit(500)
    setOrders((data ?? []) as OrderRow[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const cancelRequestedCount = orders.filter((o) => o.status === 'cancel_requested').length
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const paidStatuses: Order['status'][] = ['paid', 'shipped', 'done']
  const paidOrders = orders.filter((o) => paidStatuses.includes(o.status))
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled')
  const totalPaidAmount = paidOrders.reduce((sum, o) => sum + o.amount, 0)
  const totalCancelledAmount = cancelledOrders.reduce((sum, o) => sum + o.amount, 0)

  const confirmCancel = async (order: OrderRow) => {
    const paid = ['paid', 'cancel_requested', 'shipped', 'done'].includes(order.status)
    const ok = window.confirm(
      paid ? '이 주문을 취소 확정할까요?\n결제된 금액이 즉시 환불되고 재고가 복구됩니다.' : '이 주문을 취소 처리할까요? (미결제 주문이라 환불 없이 상태만 변경됩니다)'
    )
    if (!ok) return
    if (!order.payment_id) {
      const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
      if (!error) setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: 'cancelled' } : o)))
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('로그인이 만료되었습니다. 다시 로그인해 주세요.'); return }
    setMsg('')
    try {
      const r = await fetch('/api/order-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId: order.payment_id }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) { setMsg(data.reason || '취소 처리에 실패했습니다.'); return }
      setOrders((list) => list.map((o) => (o.payment_id === order.payment_id ? { ...o, status: 'cancelled' } : o)))
    } catch {
      setMsg('취소 요청에 실패했습니다. 네트워크를 확인해 주세요.')
    }
  }

  const handleStatusChange = async (order: OrderRow, next: Order['status']) => {
    if (next === 'cancelled') { void confirmCancel(order); return }
    const prev = order.status
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: next } : o)))
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id)
    if (error) setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: prev } : o)))
  }

  // 취소요청 철회 — 실제 PG 취소가 집행된 적 없는(status가 아직 'cancel_requested'인) 건을
  // 결제완료로 되돌린다. PG는 전혀 건드리지 않는다(2026-10-08, 취소한도초과로 막힌 실사례 대응).
  // "이 주문을 결제완료로 되돌릴까요?" 같은 모호한 문구 대신, PG 미집행임을 명확히 안내해
  // 혹시라도 실제 취소가 이미 된 건에 잘못 눌러 돈이 중복 환불되는 오해를 막는다.
  const withdrawCancelRequest = async (order: OrderRow) => {
    const ok = window.confirm(
      '이 주문의 취소 요청을 철회하고 결제완료 상태로 되돌릴까요?\n\n' +
      'PG(결제사) 쪽 취소는 아직 집행되지 않은 상태라는 전제입니다 — 실제로 환불이 이미 처리된 건이면 절대 누르지 마세요.'
    )
    if (!ok) return
    const prev = order.status
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: 'paid' } : o)))
    const { error } = await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id)
    if (error) {
      setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, status: prev } : o)))
      setMsg('철회에 실패했습니다. 다시 시도해주세요.')
    }
  }

  const visible = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const q = search.trim().toLowerCase()
    const matchSearch =
      !q ||
      (o.buyer_name ?? '').toLowerCase().includes(q) ||
      (o.products?.name ?? '').toLowerCase().includes(q) ||
      (o.partners?.brand_name ?? '').toLowerCase().includes(q) ||
      (o.payment_id ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">전체 주문 관리</p>
      </header>

      <main className="max-w-[1300px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">전체 주문 관리</h1>
        <p className="text-[13px] text-ink-soft mb-6">
          전체 브랜드의 주문을 한 곳에서 확인·처리합니다.
          {pendingCount > 0 && (
            <span className="ml-2 text-signal-blue font-semibold">입금확인 필요 {pendingCount}건</span>
          )}
          {cancelRequestedCount > 0 && (
            <span className="ml-2 text-signal-red font-semibold">취소요청 {cancelRequestedCount}건 대기 중</span>
          )}
        </p>

        {/* 결제 현황 요약 — PG(이니시스) 승인 전까지는 실제 결제완료 건수가 0일 수 있음 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <div className="bg-paper border border-rule rounded-md px-4 py-3">
            <p className="text-[11.5px] text-ink-faint mb-1">결제완료 매출</p>
            <p className="text-[16px] font-bold text-ink">{won(totalPaidAmount)}</p>
          </div>
          <div className="bg-paper border border-rule rounded-md px-4 py-3">
            <p className="text-[11.5px] text-ink-faint mb-1">결제완료 건수</p>
            <p className="text-[16px] font-bold text-ink">{paidOrders.length}건</p>
          </div>
          <div className="bg-paper border border-rule rounded-md px-4 py-3">
            <p className="text-[11.5px] text-ink-faint mb-1">입금대기(무통장)</p>
            <p className={`text-[16px] font-bold ${pendingCount > 0 ? 'text-signal-blue' : 'text-ink'}`}>{pendingCount}건</p>
          </div>
          <div className="bg-paper border border-rule rounded-md px-4 py-3">
            <p className="text-[11.5px] text-ink-faint mb-1">취소요청 대기</p>
            <p className={`text-[16px] font-bold ${cancelRequestedCount > 0 ? 'text-signal-red' : 'text-ink'}`}>{cancelRequestedCount}건</p>
          </div>
          <div className="bg-paper border border-rule rounded-md px-4 py-3">
            <p className="text-[11.5px] text-ink-faint mb-1">취소·환불 누계</p>
            <p className="text-[16px] font-bold text-ink">{won(totalCancelledAmount)}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="구매자명·상품명·브랜드명·결제ID 검색"
              className="w-full pl-9 pr-4 py-2.5 border border-rule rounded-control text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors bg-paper"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-4 py-2.5 rounded-pill text-[13px] border transition-colors ${
                  statusFilter === value ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{msg}</div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-24 bg-paper rounded-md border border-rule">
            <IconShoppingCart size={40} className="text-rule mx-auto mb-3" />
            <p className="text-[14px] text-ink-faint">{search || statusFilter !== 'all' ? '조건에 맞는 주문이 없습니다' : '주문 내역이 없습니다'}</p>
          </div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">주문일</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">브랜드</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상품명</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">구매자</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">연락처</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">수량</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">금액</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">결제수단</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">결제ID</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((o) => {
                  const badge = STATUS_BADGE[o.status] ?? { label: o.status, className: 'bg-quiet text-ink-faint' }
                  return (
                    <tr key={o.id} className="border-b border-rule last:border-b-0">
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{o.partners?.brand_name ?? '-'}</td>
                      <td className="px-4 py-3 text-ink max-w-[160px] truncate">
                        {o.products?.name ?? '-'}
                        {o.option_label && <p className="text-[11px] text-ink-faint truncate">옵션: {o.option_label}</p>}
                      </td>
                      <td className="px-4 py-3 text-ink whitespace-nowrap">
                        {o.buyer_name ?? '-'}
                        {o.delivery_memo && <p className="text-[11px] text-ink-faint truncate max-w-[160px]" title={o.delivery_memo}>📝 {o.delivery_memo}</p>}
                      </td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{o.buyer_phone ?? '-'}</td>
                      <td className="px-4 py-3 text-ink text-center">{o.quantity}</td>
                      <td className="px-4 py-3 text-ink font-semibold whitespace-nowrap">{won(o.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[12px] ${paymentMethod(o) === '무통장입금' ? 'text-ink-soft font-semibold' : 'text-ink-faint'}`}>
                          {paymentMethod(o)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-faint whitespace-nowrap max-w-[140px] truncate" title={o.payment_id ?? ''}>
                        {o.payment_id ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium ${badge.className}`}>{badge.label}</span>
                        {o.tracking_number && (
                          <span className="block text-[10.5px] text-ink-faint mt-1 whitespace-nowrap" title={`${o.tracking_carrier ?? ''} ${o.tracking_number}`}>
                            🚚 {o.tracking_number}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <select
                            value={o.status}
                            onChange={(e) => void handleStatusChange(o, e.target.value as Order['status'])}
                            className="border border-rule rounded-control px-2 py-1.5 text-[12px] text-ink-soft focus:outline-none focus:border-ink transition-colors bg-paper"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          {o.status === 'cancel_requested' && (
                            <button
                              onClick={() => void withdrawCancelRequest(o)}
                              title="PG 취소가 아직 집행 안 된 건을 결제완료로 되돌립니다(PG 미호출)"
                              className="text-[11.5px] text-signal-blue border border-signal-blue/40 rounded-control px-2 py-1.5 whitespace-nowrap hover:bg-signal-blue/5"
                            >
                              취소요청 철회
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
