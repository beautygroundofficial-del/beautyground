import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { won, comma } from '../../lib/format'
import HomeAdReport from '../../components/admin/HomeAdReport'

type Row = {
  source: string
  visits: number
  signups: number
  orders: number
  revenue: number
}

const RANGE_OPTIONS = [
  { label: '오늘', days: 1 },
  { label: '최근 7일', days: 7 },
  { label: '최근 30일', days: 30 },
  { label: '최근 90일', days: 90 },
]

function pct(numerator: number, denominator: number): string {
  if (!denominator) return '-'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

export default function AdminMarketing() {
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    const to = new Date()
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
    supabase
      .rpc('admin_traffic_summary', { p_from: from.toISOString(), p_to: to.toISOString() })
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) { setError(`조회 실패: ${err.message}`); setLoading(false); return }
        setRows((data ?? []) as Row[])
        setLoading(false)
      })
    return () => { active = false }
  }, [days])

  const totals = rows.reduce(
    (acc, r) => ({
      visits: acc.visits + r.visits,
      signups: acc.signups + r.signups,
      orders: acc.orders + r.orders,
      revenue: acc.revenue + r.revenue,
    }),
    { visits: 0, signups: 0, orders: 0, revenue: 0 },
  )
  const maxVisits = Math.max(1, ...rows.map((r) => r.visits))

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">마케팅 센터</p>
      </header>

      <main className="max-w-[1200px] p-8">
        <HomeAdReport />
        <h1 className="text-[22px] font-bold text-ink mb-2">유입경로 분석</h1>
        <p className="text-[13px] text-ink-soft mb-5">
          네이버·구글 검색, 인스타그램·페이스북, 카카오 등 어느 경로로 들어온 손님이 실제 회원가입·구매까지
          이어지는지 채널별로 보여줍니다. 광고 링크에 <code className="text-[12px] bg-quiet px-1 py-0.5 rounded">?utm_source=인스타그램&utm_medium=광고&utm_campaign=8월프로모션</code>
          같은 태그를 붙여 배포하면 캠페인 단위로도 구분됩니다.
        </p>

        <div className="flex gap-2 mb-6">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-4 py-2 rounded-control text-[13px] font-medium border transition-colors ${
                days === opt.days ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{error}</div>
        )}

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-paper border border-rule rounded-md p-5">
            <p className="text-[12px] text-ink-faint mb-1">전체 방문</p>
            <p className="text-[22px] font-bold text-ink">{comma(totals.visits)}</p>
          </div>
          <div className="bg-paper border border-rule rounded-md p-5">
            <p className="text-[12px] text-ink-faint mb-1">회원가입</p>
            <p className="text-[22px] font-bold text-ink">{comma(totals.signups)}</p>
            <p className="text-[11.5px] text-ink-faint mt-1">방문 대비 {pct(totals.signups, totals.visits)}</p>
          </div>
          <div className="bg-paper border border-rule rounded-md p-5">
            <p className="text-[12px] text-ink-faint mb-1">구매 건수</p>
            <p className="text-[22px] font-bold text-ink">{comma(totals.orders)}</p>
            <p className="text-[11.5px] text-ink-faint mt-1">가입 대비 {pct(totals.orders, totals.signups)}</p>
          </div>
          <div className="bg-paper border border-rule rounded-md p-5">
            <p className="text-[12px] text-ink-faint mb-1">매출</p>
            <p className="text-[22px] font-bold text-ink">{won(totals.revenue)}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">이 기간에는 기록된 방문이 없습니다.</div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">유입 경로</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">방문</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">가입</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">가입전환율</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">구매</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">구매전환율</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">매출</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.source} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3 text-ink font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{r.source}</span>
                      </div>
                      <div className="h-1.5 mt-1.5 rounded-full bg-quiet overflow-hidden w-[120px]">
                        <div className="h-full bg-signal-blue" style={{ width: `${(r.visits / maxVisits) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{comma(r.visits)}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{comma(r.signups)}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{pct(r.signups, r.visits)}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{comma(r.orders)}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{pct(r.orders, r.signups)}</td>
                    <td className="px-4 py-3 text-ink font-semibold whitespace-nowrap">{won(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
