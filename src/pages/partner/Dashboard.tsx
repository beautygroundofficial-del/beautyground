import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Order, Partner } from '../../lib/types'
import { won, formatDateTime } from '../../lib/format'
import Button from '../../components/common/Button'

const CARD_STYLE = { borderColor: '#e5e0d8', borderWidth: '0.5px' } as const

const STATUS_LABEL: Record<Order['status'], string> = {
  paid: '결제완료',
  shipped: '배송중',
  done: '완료',
  cancelled: '취소',
}

const STATUS_CLASS: Record<Order['status'], string> = {
  paid: 'bg-gold/15 text-gold',
  shipped: 'bg-cream-3 text-text-sub',
  done: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: Order['status'] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-pill text-[12px] ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export default function PartnerDashboard() {
  const [loading, setLoading] = useState<boolean>(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [monthSales, setMonthSales] = useState<number>(0)
  const [orderCount, setOrderCount] = useState<number>(0)
  const [productCount, setProductCount] = useState<number>(0)
  const [liveCount, setLiveCount] = useState<number>(0)
  const [recentOrders, setRecentOrders] = useState<Order[]>([])

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

      const now = new Date()
      const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [salesRes, orderRes, productRes, liveRes, recentRes] = await Promise.all([
        supabase
          .from('orders')
          .select('amount,created_at,status')
          .eq('partner_id', p.id)
          .gte('created_at', startISO),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('partner_id', p.id),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('partner_id', p.id),
        supabase
          .from('lives')
          .select('*', { count: 'exact', head: true })
          .eq('partner_id', p.id)
          .eq('status', 'scheduled'),
        supabase
          .from('orders')
          .select('*, products(name)')
          .eq('partner_id', p.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (!active) return

      const salesRows = (salesRes.data ?? []) as Pick<
        Order,
        'amount' | 'status'
      >[]
      const total = salesRows
        .filter((o) => ['paid', 'shipped', 'done'].includes(o.status))
        .reduce((sum, o) => sum + (o.amount ?? 0), 0)

      setMonthSales(total)
      setOrderCount(orderRes.count ?? 0)
      setProductCount(productRes.count ?? 0)
      setLiveCount(liveRes.count ?? 0)
      setRecentOrders((recentRes.data ?? []) as Order[])
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text mb-6">대시보드</h1>
        <div className="text-[14px] text-text-sub">불러오는 중...</div>
      </div>
    )
  }

  if (!partner) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text mb-6">대시보드</h1>
        <div className="bg-white rounded-md border p-8 text-center" style={CARD_STYLE}>
          <p className="text-[16px] font-semibold text-text mb-2">입점 승인 대기 중입니다</p>
          <p className="text-[14px] text-text-sub">
            입점 심사가 완료되면 파트너 센터를 이용하실 수 있습니다.
          </p>
        </div>
      </div>
    )
  }

  const summaryCards: { label: string; value: string }[] = [
    { label: '이번 달 매출', value: won(monthSales) },
    { label: '누적 주문', value: `${orderCount}건` },
    { label: '등록 상품 수', value: `${productCount}개` },
    { label: '예정 라이브 수', value: `${liveCount}건` },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-[22px] font-bold text-text">대시보드</h1>
        <div className="flex items-center gap-2">
          <Link to="/partner/products/new">
            <Button variant="gold" size="sm" label="상품 등록" />
          </Link>
          <Link to="/partner/live/new">
            <Button variant="outline" size="sm" label="라이브 예약" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-md border p-5"
            style={CARD_STYLE}
          >
            <p className="text-[13px] text-text-sub mb-2">{card.label}</p>
            <p className="text-[20px] font-bold text-text">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-md border p-6" style={CARD_STYLE}>
        <h2 className="text-[16px] font-semibold text-text mb-4">최근 주문 5건</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-text-hint border-b" style={CARD_STYLE}>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">주문일</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">상품</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">구매자</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">수량</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">금액</th>
                <th className="py-3 font-medium whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-hint">
                    주문 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.id} className="border-b" style={CARD_STYLE}>
                    <td className="py-3 pr-4 text-text-sub whitespace-nowrap">
                      {formatDateTime(o.created_at)}
                    </td>
                    <td className="py-3 pr-4 text-text">
                      {(o as any).products?.name ?? '-'}
                    </td>
                    <td className="py-3 pr-4 text-text">{o.buyer_name ?? '-'}</td>
                    <td className="py-3 pr-4 text-text">{o.quantity}</td>
                    <td className="py-3 pr-4 text-text whitespace-nowrap">
                      {won(o.amount)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={o.status} />
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
