import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyHost } from '../../lib/host'
import type { Host, HostSettlement } from '../../lib/types'
import { won } from '../../lib/format'

const STATUS_BADGE: Record<HostSettlement['status'], { label: string; bg: string; text: string }> = {
  pending: { label: '정산 대기', bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  paid:    { label: '지급 완료', bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
}

function thisMonthKey() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function prevMonthKey() {
  const n = new Date()
  const m = n.getMonth() === 0 ? 12 : n.getMonth()
  const y = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear()
  return `${y}-${String(m).padStart(2, '0')}`
}

export default function HostSettlementPage() {
  const [loading, setLoading] = useState(true)
  const [host, setHost] = useState<Host | null>(null)
  const [settlements, setSettlements] = useState<HostSettlement[]>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      const h = await getMyHost()
      if (!active) return
      if (!h) { setHost(null); setLoading(false); return }
      setHost(h)

      const { data } = await supabase
        .from('host_settlements')
        .select('*')
        .eq('host_id', h.id)
        .order('created_at', { ascending: false })

      if (!active) return
      setSettlements((data ?? []) as HostSettlement[])
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
        <p className="text-[16px] font-semibold text-[#111] mb-2">가입 승인 대기 중입니다</p>
        <p className="text-[14px] text-[#9a9080]">승인이 완료되면 정산 내역을 확인하실 수 있습니다.</p>
      </div>
    )
  }

  const thisKey = thisMonthKey()
  const prevKey = prevMonthKey()

  const thisMonthPending = settlements
    .filter((s) => s.status === 'pending' && s.period.startsWith(thisKey))
    .reduce((sum, s) => sum + s.commission_amount, 0)

  const lastMonthPaid = settlements
    .filter((s) => s.status === 'paid' && s.period.startsWith(prevKey))
    .reduce((sum, s) => sum + s.commission_amount, 0)

  const totalPaid = settlements
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + s.commission_amount, 0)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {([
          { label: '이번 달 정산 예정액', value: thisMonthPending, color: '#b8924a' },
          { label: '지난 달 정산 완료액', value: lastMonthPaid, color: '#1D9E75' },
          { label: '누적 정산 총액', value: totalPaid },
        ] as { label: string; value: number; color?: string }[]).map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-[14px] border border-[#e5e0d8] p-6"
            style={color ? { borderTop: `3px solid ${color}` } : undefined}
          >
            <p className="text-[12px] text-[#9a9080] mb-2">{label}</p>
            <p className="font-serif text-[22px] font-bold text-[#111]">{won(value)}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#f7f4ef] rounded-[14px] border border-[#e5e0d8] p-5 mb-6">
        <p className="text-[12px] font-semibold text-[#555] mb-2">정산 안내</p>
        <ul className="text-[12px] text-[#9a9080] space-y-1">
          <li>• 수수료율은 매출 등급에 따라 달라집니다(등급표는 대시보드에서 확인).</li>
          <li>• 정산은 관리자가 매월 등급 판정 후 생성합니다.</li>
          <li>• 취소 건은 매출 집계에서 자동 차감됩니다.</li>
        </ul>
      </div>

      {settlements.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[14px] border border-[#e5e0d8]">
          <p className="text-[14px] text-[#9a9080]">정산 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eee]">
                  {['정산 기간', '총매출', '적용 등급', '수수료율', '지급액', '상태'].map((col) => (
                    <th key={col} className="text-left text-[11px] text-[#9a9080] font-medium px-5 py-4 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => {
                  const badge = STATUS_BADGE[s.status]
                  return (
                    <tr key={s.id} className="border-b border-[#eee] hover:bg-[#fdf9f5] transition-colors">
                      <td className="px-5 py-4 text-[13px] text-[#111] whitespace-nowrap">{s.period}</td>
                      <td className="px-5 py-4 text-[13px] text-[#111] whitespace-nowrap">{won(s.total_sales)}</td>
                      <td className="px-5 py-4 text-[13px] text-[#9a9080] whitespace-nowrap">{s.tier_name ?? '-'}</td>
                      <td className="px-5 py-4 text-[13px] text-[#9a9080] whitespace-nowrap">{s.commission_rate}%</td>
                      <td className="px-5 py-4 text-[13px] font-semibold text-[#111] whitespace-nowrap">{won(s.commission_amount)}</td>
                      <td className="px-5 py-4">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
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
