import { useEffect, useState } from 'react'
import { IconSearch, IconShoppingCart } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Order, Partner } from '../../lib/types'
import { won } from '../../lib/format'

type StatusFilter = Order['status'] | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'paid', label: '결제완료' },
  { value: 'cancel_requested', label: '취소요청' },
  { value: 'shipped', label: '배송중' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소' },
]

const STATUS_MAP: Partial<Record<Order['status'], { label: string; bg: string; text: string }>> = {
  pending:          { label: '결제대기', bg: 'bg-[#F3F3F0]', text: 'text-[#777]' },
  failed:           { label: '결제실패', bg: 'bg-[#F3F3F0]', text: 'text-[#777]' },
  paid:             { label: '결제완료', bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  cancel_requested: { label: '취소요청', bg: 'bg-[#FDE8E2]', text: 'text-[#9E2F12]' },
  shipped:          { label: '배송중',   bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
  done:             { label: '완료',     bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
  cancelled:        { label: '취소',     bg: 'bg-[#FAECE7]', text: 'text-[#712B13]' },
}

const STATUS_OPTIONS: { value: Order['status']; label: string }[] = [
  { value: 'paid', label: '결제완료' },
  { value: 'cancel_requested', label: '취소요청(고객)' },
  { value: 'shipped', label: '배송중' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소' },
]

export default function PartnerOrders() {
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const p = await getMyPartner()
      if (!active) return
      if (!p) { setPartner(null); setLoading(false); return }
      setPartner(p)

      const { data } = await supabase
        .from('orders')
        .select('*, products(name)')
        .eq('partner_id', p.id)
        .order('created_at', { ascending: false })

      if (!active) return
      setOrders((data ?? []) as Order[])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  // 취소 확정 = 실환불 — 포트원 취소 + 재고 복구 + 같은 결제의 전체 행 취소 (서버 API가 일괄 처리)
  const confirmCancel = async (order: Order) => {
    const paid = ['paid', 'cancel_requested', 'shipped', 'done'].includes(order.status)
    const msg = paid
      ? '이 주문을 취소 확정할까요?\n결제된 금액이 즉시 환불되고 재고가 복구됩니다.'
      : '이 주문을 취소 처리할까요? (미결제 주문이라 환불 없이 상태만 변경됩니다)'
    if (!window.confirm(msg)) return
    // 결제ID가 없는 옛 주문(수기 등록 등)은 환불 대상이 아니므로 상태만 변경
    if (!order.payment_id) {
      const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
      if (!error) setOrders(list => list.map(o => o.id === order.id ? { ...o, status: 'cancelled' } : o))
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.alert('로그인이 만료되었습니다. 다시 로그인해주세요.'); return }
    try {
      const r = await fetch('/api/order-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId: order.payment_id }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) {
        window.alert(data.reason || '취소 처리에 실패했습니다. 잠시 후 다시 시도해주세요.')
        return
      }
      // 같은 결제(payment_id)로 묶인 행 전부 취소됨
      setOrders(list => list.map(o => o.payment_id === order.payment_id ? { ...o, status: 'cancelled' } : o))
      window.alert(paid ? '취소 완료 — 환불 및 재고 복구까지 처리되었습니다.' : '취소 처리되었습니다.')
    } catch {
      window.alert('취소 요청에 실패했습니다. 네트워크를 확인해주세요.')
    }
  }

  const handleStatusChange = async (order: Order, next: Order['status']) => {
    const prev = order.status
    if (next === 'cancelled') { await confirmCancel(order); return }

    // 배송중 전환 시 운송장 입력(선택) — 고객 주문내역에 그대로 표시됨
    let patch: Record<string, string | null> = { status: next }
    if (next === 'shipped') {
      const tn = window.prompt('운송장 번호를 입력하세요 (없으면 비워두세요)', order.tracking_number ?? '')
      if (tn === null) return // 취소
      const carrier = tn.trim()
        ? window.prompt('택배사명 (예: CJ대한통운)', order.tracking_carrier ?? 'CJ대한통운')
        : null
      patch = { status: next, tracking_number: tn.trim() || null, tracking_carrier: carrier?.trim() || null }
    }

    setOrders(list => list.map(o => o.id === order.id ? { ...o, ...patch } as Order : o))
    let { error } = await supabase.from('orders').update(patch).eq('id', order.id)
    if (error && /tracking_/i.test(error.message)) {
      // orders_customer_flow.sql 미실행 환경 폴백 — 상태만이라도 변경
      ;({ error } = await supabase.from('orders').update({ status: next }).eq('id', order.id))
    }
    if (error) setOrders(list => list.map(o => o.id === order.id ? { ...o, status: prev } : o))
  }

  const visible = orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      (o.buyer_name ?? '').toLowerCase().includes(q) ||
      ((o as any).products?.name ?? '').toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (!partner) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-2">입점 승인 대기 중입니다</p>
        <p className="text-[14px] text-[#9a9080]">입점 심사가 완료되면 파트너 센터를 이용하실 수 있습니다.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#bbb]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="구매자명 또는 상품명 검색"
            className="w-full pl-9 pr-4 py-2.5 border border-[#e5e0d8] rounded-lg text-[13px] focus:outline-none focus:border-[#b8924a] transition-colors bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-4 py-2.5 rounded-lg text-[13px] border transition-colors ${
                statusFilter === value
                  ? 'bg-[#b8924a] text-white border-[#b8924a]'
                  : 'bg-white text-[#555] border-[#e5e0d8] hover:border-[#b8924a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[14px] border border-[#e5e0d8]">
          <IconShoppingCart size={40} className="text-[#e5e0d8] mx-auto mb-3" />
          <p className="text-[14px] text-[#9a9080]">
            {search || statusFilter !== 'all' ? '조건에 맞는 주문이 없습니다' : '주문 내역이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eee]">
                  {['주문일', '상품명', '구매자', '연락처', '수량', '금액', '상태'].map(col => (
                    <th key={col} className="text-left text-[11px] text-[#9a9080] font-medium px-5 py-4 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(o => {
                  const badge = STATUS_MAP[o.status] ?? { label: o.status, bg: 'bg-[#F3F3F0]', text: 'text-[#777]' }
                  const d = new Date(o.created_at)
                  return (
                    <tr key={o.id} className="border-b border-[#eee] hover:bg-[#fdf9f5] transition-colors">
                      <td className="px-5 py-4 text-[12px] text-[#9a9080] whitespace-nowrap">
                        {d.getMonth() + 1}/{d.getDate()} {d.getHours().toString().padStart(2, '0')}:{d.getMinutes().toString().padStart(2, '0')}
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#111] max-w-[140px]">
                        <p className="truncate">{(o as any).products?.name ?? '-'}</p>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[#111] whitespace-nowrap">
                        {o.buyer_name ?? '-'}
                        {o.delivery_memo && (
                          <p className="text-[11px] text-[#9a9080] font-normal max-w-[160px] truncate" title={o.delivery_memo}>
                            📝 {o.delivery_memo}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[12px] text-[#9a9080] whitespace-nowrap">{o.buyer_phone ?? '-'}</td>
                      <td className="px-5 py-4 text-[13px] text-[#111] text-center">{o.quantity}</td>
                      <td className="px-5 py-4 text-[13px] font-semibold text-[#111] whitespace-nowrap">{won(o.amount)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                          {o.tracking_number && (
                            <span className="text-[10.5px] text-[#9a9080] whitespace-nowrap" title={`${o.tracking_carrier ?? ''} ${o.tracking_number}`}>
                              🚚 {o.tracking_number}
                            </span>
                          )}
                          <select
                            value={o.status}
                            onChange={e => handleStatusChange(o, e.target.value as Order['status'])}
                            className="border border-[#e5e0d8] rounded-lg px-2 py-1 text-[11px] text-[#555] focus:outline-none focus:border-[#b8924a] transition-colors bg-white"
                          >
                            {STATUS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
