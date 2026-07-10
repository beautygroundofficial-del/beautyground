import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconPlus, IconChevronRight, IconVideo, IconPackage, IconCash } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Order, Partner, Live } from '../../lib/types'
import StatsCard from '../../components/partner/StatsCard'

const LIVE_STATUS_MAP: Record<Live['status'], { label: string; bg: string; text: string }> = {
  scheduled: { label: '예정', bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: '진행중', bg: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
  ended:     { label: '완료', bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
}

const ORDER_STATUS_MAP: Partial<Record<Order['status'], { label: string; bg: string; text: string }>> = {
  pending:          { label: '결제대기', bg: 'bg-[#F3F3F0]', text: 'text-[#777]' },
  failed:           { label: '결제실패', bg: 'bg-[#F3F3F0]', text: 'text-[#777]' },
  paid:             { label: '결제완료', bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  cancel_requested: { label: '취소요청', bg: 'bg-[#FDE8E2]', text: 'text-[#9E2F12]' },
  shipped:          { label: '배송중',   bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
  done:             { label: '완료',     bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
  cancelled:        { label: '취소',     bg: 'bg-[#FAECE7]', text: 'text-[#712B13]' },
}

function formatScheduled(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function PartnerDashboard() {
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [monthSales, setMonthSales] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [productCount, setProductCount] = useState(0)
  const [scheduledLives, setScheduledLives] = useState<Live[]>([])
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

      const [salesRes, orderRes, productRes, livesRes, recentRes] = await Promise.all([
        supabase
          .from('orders')
          .select('amount,status')
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
          .select('*')
          .eq('partner_id', p.id)
          .eq('status', 'scheduled')
          .order('scheduled_at', { ascending: true })
          .limit(3),
        supabase
          .from('orders')
          .select('*, products(name)')
          .eq('partner_id', p.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (!active) return

      const salesRows = (salesRes.data ?? []) as Pick<Order, 'amount' | 'status'>[]
      const total = salesRows
        .filter((o) => ['paid', 'shipped', 'done'].includes(o.status))
        .reduce((sum, o) => sum + (o.amount ?? 0), 0)

      setMonthSales(total)
      setOrderCount(orderRes.count ?? 0)
      setProductCount(productRes.count ?? 0)
      setScheduledLives((livesRes.data ?? []) as Live[])
      setRecentOrders((recentRes.data ?? []) as Order[])
      setLoading(false)
    }

    load()
    return () => { active = false }
  }, [])

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
        <p className="text-[14px] text-[#9a9080]">
          입점 심사가 완료되면 파트너 센터를 이용하실 수 있습니다.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="이번 달 매출" value={monthSales} unit="원" color="#b8924a" />
        <StatsCard label="총 주문 수" value={orderCount} unit="건" />
        <StatsCard label="등록 상품 수" value={productCount} unit="개" />
        <StatsCard label="예정된 라이브" value={scheduledLives.length} unit="건" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 예정된 라이브 */}
        <div className="lg:col-span-1 bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[14px] font-bold text-[#111]">예정된 라이브</h2>
            <Link
              to="/partner/live/new"
              className="flex items-center gap-1 text-[12px] text-[#b8924a] hover:underline"
            >
              <IconPlus size={13} />
              라이브 예약
            </Link>
          </div>

          {scheduledLives.length === 0 ? (
            <div className="text-center py-8">
              <IconVideo size={32} className="text-[#e5e0d8] mx-auto mb-2" />
              <p className="text-[13px] text-[#9a9080]">예정된 라이브가 없습니다.</p>
              <Link
                to="/partner/live/new"
                className="text-[12px] text-[#b8924a] hover:underline mt-1 inline-block"
              >
                라이브 예약하기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledLives.map((live) => {
                const badge = LIVE_STATUS_MAP[live.status]
                return (
                  <Link
                    key={live.id}
                    to={`/partner/live/${live.id}`}
                    className="block p-4 bg-[#f7f4ef] rounded-xl hover:bg-[#f0ece6] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-[13px] font-semibold text-[#111] leading-tight">
                        {live.title}
                      </p>
                      <span
                        className={`ml-2 shrink-0 text-[11px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#9a9080]">
                      {formatScheduled(live.scheduled_at)}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 최근 주문 */}
        <div className="lg:col-span-2 bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[14px] font-bold text-[#111]">최근 주문</h2>
            <Link
              to="/partner/orders"
              className="flex items-center gap-1 text-[12px] text-[#b8924a] hover:underline"
            >
              전체 보기 <IconChevronRight size={13} />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eee]">
                  {['주문번호', '상품명', '금액', '상태', '주문일'].map((col) => (
                    <th
                      key={col}
                      className="text-left text-[11px] text-[#9a9080] uppercase tracking-wider pb-3 font-medium pr-4"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[13px] text-[#9a9080]">
                      주문 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => {
                    const badge = ORDER_STATUS_MAP[order.status] ?? { label: order.status, bg: 'bg-[#F3F3F0]', text: 'text-[#777]' }
                    const d = new Date(order.created_at)
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-[#eee] hover:bg-[#fdf3e7] transition-colors"
                      >
                        <td className="py-3.5 pr-4 text-[12px] text-[#555] font-mono">
                          {order.id.slice(0, 8)}
                        </td>
                        <td className="py-3.5 pr-4 text-[13px] text-[#111] max-w-[140px] truncate">
                          {(order as any).products?.name ?? '-'}
                        </td>
                        <td className="py-3.5 pr-4 text-[13px] text-[#111] font-medium">
                          {order.amount.toLocaleString()}원
                        </td>
                        <td className="py-3.5 pr-4">
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3.5 text-[12px] text-[#9a9080]">
                          {d.getMonth() + 1}/{d.getDate()}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 빠른 실행 버튼 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '상품 등록하기', to: '/partner/products/new', icon: IconPackage },
          { label: '라이브 예약하기', to: '/partner/live/new', icon: IconVideo },
          { label: '정산 내역 확인', to: '/partner/settlement', icon: IconCash },
        ].map(({ label, to, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-center gap-2 bg-white border border-[#e5e0d8] rounded-xl py-4 text-[13px] font-medium text-[#555] hover:border-[#b8924a] hover:text-[#b8924a] transition-colors"
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </div>
    </>
  )
}
