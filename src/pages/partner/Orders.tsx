import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Order, Partner } from '../../lib/types'
import { won, formatDateTime } from '../../lib/format'

const CARD_STYLE = { borderColor: '#e5e0d8', borderWidth: '0.5px' } as const

const STATUS_OPTIONS: { value: Order['status']; label: string }[] = [
  { value: 'paid', label: '결제완료' },
  { value: 'shipped', label: '배송중' },
  { value: 'done', label: '완료' },
  { value: 'cancelled', label: '취소' },
]

export default function PartnerOrders() {
  const [loading, setLoading] = useState<boolean>(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    let active = true

    const load = async () => {
      const p = await getMyPartner()
      if (!active) return

      if (!p) {
        setPartner(null)
        setLoading(false)
        return
      }
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
    return () => {
      active = false
    }
  }, [])

  const handleStatusChange = async (
    order: Order,
    newStatus: Order['status']
  ) => {
    const prev = order.status
    setOrders((list) =>
      list.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
    )

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id)

    if (error) {
      // 실패 시 롤백
      setOrders((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: prev } : o))
      )
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text mb-6">주문 관리</h1>
        <div className="text-[14px] text-text-sub">불러오는 중...</div>
      </div>
    )
  }

  if (!partner) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text mb-6">주문 관리</h1>
        <div className="bg-white rounded-md border p-8 text-center" style={CARD_STYLE}>
          <p className="text-[16px] font-semibold text-text mb-2">입점 승인 대기 중입니다</p>
          <p className="text-[14px] text-text-sub">
            입점 심사가 완료되면 파트너 센터를 이용하실 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold text-text mb-6">주문 관리</h1>

      <div className="bg-white rounded-md border p-6" style={CARD_STYLE}>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-text-hint border-b" style={CARD_STYLE}>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">주문일</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">상품</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">구매자</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">연락처</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">수량</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">금액</th>
                <th className="py-3 font-medium whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-hint">
                    주문 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b" style={CARD_STYLE}>
                    <td className="py-3 pr-4 text-text-sub whitespace-nowrap">
                      {formatDateTime(o.created_at)}
                    </td>
                    <td className="py-3 pr-4 text-text">
                      {(o as any).products?.name ?? '-'}
                    </td>
                    <td className="py-3 pr-4 text-text">{o.buyer_name ?? '-'}</td>
                    <td className="py-3 pr-4 text-text whitespace-nowrap">
                      {o.buyer_phone ?? '-'}
                    </td>
                    <td className="py-3 pr-4 text-text">{o.quantity}</td>
                    <td className="py-3 pr-4 text-text whitespace-nowrap">
                      {won(o.amount)}
                    </td>
                    <td className="py-3">
                      <select
                        value={o.status}
                        onChange={(e) =>
                          handleStatusChange(o, e.target.value as Order['status'])
                        }
                        className="bg-white border border-cream-2 rounded-md px-2 py-1 text-[13px] text-text focus:outline-none focus:shadow-focus transition"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
