import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconChevronRight, IconVideo } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyHost } from '../../lib/host'
import type { CommissionTier, Host, HostSaleRow, Live } from '../../lib/types'
import StatsCard from '../../components/partner/StatsCard'

const LIVE_STATUS_MAP: Record<Live['status'], { label: string; bg: string; text: string }> = {
  scheduled: { label: '예정',  bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: '진행중', bg: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
  ended:     { label: '완료',  bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
}

function formatScheduled(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function HostDashboard() {
  const [loading, setLoading] = useState(true)
  const [host, setHost] = useState<Host | null>(null)
  const [monthSales, setMonthSales] = useState(0)
  const [currentTier, setCurrentTier] = useState<CommissionTier | null>(null)
  const [recentLives, setRecentLives] = useState<Live[]>([])
  const [liveCount, setLiveCount] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      const h = await getMyHost()
      if (!active) return
      if (!h || h.status !== 'active') {
        setHost(h)
        setLoading(false)
        return
      }
      setHost(h)

      const now = new Date()
      const startISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [salesRes, tiersRes, livesRes, countRes] = await Promise.all([
        supabase.from('host_sales_view').select('amount,status').gte('created_at', startISO),
        supabase.from('commission_tiers').select('*').order('min_sales', { ascending: true }),
        supabase.from('lives').select('*').eq('host_id', h.id).order('scheduled_at', { ascending: false }).limit(3),
        supabase.from('lives').select('*', { count: 'exact', head: true }).eq('host_id', h.id),
      ])

      if (!active) return

      const salesRows = (salesRes.data ?? []) as Pick<HostSaleRow, 'amount' | 'status'>[]
      const total = salesRows
        .filter((o) => ['paid', 'shipped', 'done'].includes(o.status))
        .reduce((sum, o) => sum + (o.amount ?? 0), 0)
      setMonthSales(total)

      const tiers = (tiersRes.data ?? []) as CommissionTier[]
      const tier = tiers.filter((t) => t.min_sales <= total).sort((a, b) => b.min_sales - a.min_sales)[0] ?? null
      setCurrentTier(tier)

      setRecentLives((livesRes.data ?? []) as Live[])
      setLiveCount(countRes.count ?? 0)
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

  if (!host) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-2">진행자 계정을 찾을 수 없습니다</p>
        <p className="text-[14px] text-[#9a9080]">가입 신청이 필요합니다.</p>
      </div>
    )
  }

  if (host.status === 'pending') {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-2">가입 승인 대기 중입니다</p>
        <p className="text-[14px] text-[#9a9080]">승인이 완료되면 진행자 센터를 이용하실 수 있습니다.</p>
      </div>
    )
  }

  if (host.status === 'suspended') {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-2">이용이 정지된 계정입니다</p>
        <p className="text-[14px] text-[#9a9080]">자세한 내용은 뷰티그라운드로 문의해 주세요.</p>
      </div>
    )
  }

  const estimatedCommission = currentTier ? Math.round((monthSales * currentTier.commission_rate) / 100) : 0

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="이번 달 매출" value={monthSales} unit="원" color="#b8924a" />
        <StatsCard
          label="현재 적용 등급"
          value={currentTier ? currentTier.name : '-'}
          unit={currentTier ? `${currentTier.commission_rate}%` : undefined}
        />
        <StatsCard label="이번 달 예상 수수료" value={estimatedCommission} unit="원" color="#1D9E75" />
        <StatsCard label="누적 진행 방송" value={liveCount} unit="건" />
      </div>

      <div className="bg-[#f7f4ef] rounded-[14px] border border-[#e5e0d8] p-5 mb-6">
        <p className="text-[12px] text-[#9a9080] leading-relaxed">
          예상 수수료는 이번 달 매출을 기준으로 현재 등급을 적용한 참고값입니다. 실제 정산은
          매월 관리자가 생성하며,{' '}
          <Link to="/host/settlement" className="text-[#b8924a] hover:underline">정산 내역</Link>에서 확인할 수 있습니다.
        </p>
      </div>

      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[14px] font-bold text-[#111]">최근 방송</h2>
          <Link to="/host/lives" className="flex items-center gap-1 text-[12px] text-[#b8924a] hover:underline">
            전체 보기 <IconChevronRight size={13} />
          </Link>
        </div>

        {recentLives.length === 0 ? (
          <div className="text-center py-8">
            <IconVideo size={32} className="text-[#e5e0d8] mx-auto mb-2" />
            <p className="text-[13px] text-[#9a9080]">진행한 방송이 아직 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentLives.map((live) => {
              const badge = LIVE_STATUS_MAP[live.status]
              return (
                <Link
                  key={live.id}
                  to={`/host/live/${live.id}`}
                  className="block p-4 bg-[#f7f4ef] rounded-xl hover:bg-[#f0ece6] transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-[13px] font-semibold text-[#111] leading-tight">{live.title}</p>
                    <span className={`ml-2 shrink-0 text-[11px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#9a9080]">{formatScheduled(live.scheduled_at)}</p>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
