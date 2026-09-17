import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { IconChevronRight, IconVideo } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner, PartnerSaleRow } from '../../lib/types'
import StatsCard from '../../components/host/StatsCard'

const SETTLED_STATUSES = ['paid', 'shipped', 'done']

function formatScheduled(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function BrandDashboard() {
  const [searchParams] = useSearchParams()
  const asPartnerId = searchParams.get('as') ?? undefined
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [monthSales, setMonthSales] = useState(0)
  const [recentLives, setRecentLives] = useState<{ id: string; title: string; scheduled_at: string | null }[]>([])
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      const p = await getMyPartner(asPartnerId)
      if (!active) return
      if (!p) { setPartner(null); setLoading(false); return }
      setPartner(p)

      const now = new Date()
      const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      // 관리자가 다른 브랜드를 보는 중이면(p.id가 asPartnerId) admin-aware RPC로,
      // 아니면 기존처럼 뷰를 그대로 쓴다 — 정상 경로 성능·안정성 그대로 유지.
      const { data } = asPartnerId
        ? await supabase.rpc('get_partner_live_sales', { p_partner_id: asPartnerId }).order('created_at', { ascending: false })
        : await supabase.from('partner_live_sales_view').select('*').order('created_at', { ascending: false })
      if (!active) return

      const rows = (data ?? []) as PartnerSaleRow[]
      const monthTotal = rows
        .filter((r) => SETTLED_STATUSES.includes(r.status) && r.created_at >= startISO)
        .reduce((sum, r) => sum + (r.amount ?? 0), 0)
      setMonthSales(monthTotal)

      const liveMap = new Map<string, { id: string; title: string; scheduled_at: string | null }>()
      rows.forEach((r) => {
        if (r.live_id && r.live_title && !liveMap.has(r.live_id)) {
          liveMap.set(r.live_id, { id: r.live_id, title: r.live_title, scheduled_at: r.live_scheduled_at })
        }
      })
      const lives = Array.from(liveMap.values())
      setLiveCount(lives.length)
      setRecentLives(lives.slice(0, 3))

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
        <p className="text-[16px] font-semibold text-[#111] mb-2">브랜드 계정을 찾을 수 없습니다</p>
        <p className="text-[14px] text-[#9a9080]">뷰티그라운드 담당자에게 문의해 주세요.</p>
      </div>
    )
  }

  const estimatedCommission = Math.round((monthSales * partner.commission_rate) / 100)

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="이번 달 매출" value={monthSales} unit="원" />
        <StatsCard label="수수료율" value={`${partner.commission_rate}%`} />
        <StatsCard label="이번 달 예상 수수료" value={estimatedCommission} unit="원" />
        <StatsCard label="판매된 방송 수" value={liveCount} unit="건" />
      </div>

      <div className="bg-[#f7f4ef] rounded-[14px] border border-[#e5e0d8] p-5 mb-6">
        <p className="text-[12px] text-[#9a9080] leading-relaxed">
          예상 수수료는 이번 달 매출에 현재 수수료율({partner.commission_rate}%)을 적용한 참고값입니다.
          실제 정산은 매월 관리자가 생성하며,{' '}
          <Link to="/brand/settlement" className="text-[#b8924a] hover:underline">정산내역</Link>에서 확인할 수 있습니다.
        </p>
      </div>

      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[14px] font-bold text-[#111]">최근 판매된 방송</h2>
          <Link to="/brand/sales" className="flex items-center gap-1 text-[12px] text-[#b8924a] hover:underline">
            전체 보기 <IconChevronRight size={13} />
          </Link>
        </div>

        {recentLives.length === 0 ? (
          <div className="text-center py-8">
            <IconVideo size={32} className="text-[#e5e0d8] mx-auto mb-2" />
            <p className="text-[13px] text-[#9a9080]">라이브 방송을 통한 판매가 아직 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLives.map((live) => (
              <div key={live.id} className="block p-4 bg-[#f7f4ef] rounded-xl">
                <p className="text-[13px] font-semibold text-[#111] leading-tight">{live.title}</p>
                <p className="text-[12px] text-[#9a9080] mt-1">{formatScheduled(live.scheduled_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
