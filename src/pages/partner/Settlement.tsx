import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Settlement, Partner } from '../../lib/types'
import { won } from '../../lib/format'

const STATUS_BADGE: Record<Settlement['status'], { label: string; bg: string; text: string }> = {
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

export default function PartnerSettlement() {
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [settlements, setSettlements] = useState<Settlement[]>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      const p = await getMyPartner()
      if (!active) return
      if (!p) { setPartner(null); setLoading(false); return }
      setPartner(p)

      const { data } = await supabase
        .from('settlements')
        .select('*')
        .eq('partner_id', p.id)
        .order('created_at', { ascending: false })

      if (!active) return
      setSettlements((data ?? []) as Settlement[])
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
        <p className="text-[14px] text-[#9a9080]">입점 심사가 완료되면 파트너 센터를 이용하실 수 있습니다.</p>
      </div>
    )
  }

  const thisKey = thisMonthKey()
  const prevKey = prevMonthKey()

  const thisMonthPending = settlements
    .filter(s => s.status === 'pending' && (s.period ?? '').startsWith(thisKey))
    .reduce((sum, s) => sum + s.payout_amount, 0)

  const lastMonthPaid = settlements
    .filter(s => s.status === 'paid' && (s.period ?? '').startsWith(prevKey))
    .reduce((sum, s) => sum + s.payout_amount, 0)

  const totalPaid = settlements
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + s.payout_amount, 0)

  return (
    <>
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {([
          { label: '이번 달 정산 예정액', value: thisMonthPending, color: '#b8924a' },
          { label: '지난 달 정산 완료액', value: lastMonthPaid, color: '#1D9E75' },
          { label: '누적 정산 총액',      value: totalPaid },
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

      {/* 수수료 안내 */}
      <div className="bg-[#f7f4ef] rounded-[14px] border border-[#e5e0d8] p-5 mb-6">
        <p className="text-[12px] font-semibold text-[#555] mb-2">정산 안내</p>
        <ul className="text-[12px] text-[#9a9080] space-y-1">
          <li>• 수수료율: <strong className="text-[#b8924a]">{partner.commission_rate}%</strong></li>
          <li>• 정산은 매월 익월 10일에 지급됩니다.</li>
          <li>• 환불/취소 건은 정산에서 자동 차감됩니다.</li>
        </ul>
      </div>

      {/* 정산 테이블 */}
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
                  {['정산 기간', '총매출', '수수료', '지급액', '상태'].map(col => (
                    <th key={col} className="text-left text-[11px] text-[#9a9080] font-medium px-5 py-4 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map(s => {
                  const badge = STATUS_BADGE[s.status]
                  return (
                    <tr key={s.id} className="border-b border-[#eee] hover:bg-[#fdf9f5] transition-colors">
                      <td className="px-5 py-4 text-[13px] text-[#111] whitespace-nowrap">{s.period ?? '-'}</td>
                      <td className="px-5 py-4 text-[13px] text-[#111] whitespace-nowrap">{won(s.total_sales)}</td>
                      <td className="px-5 py-4 text-[13px] text-[#9a9080] whitespace-nowrap">{won(s.commission)}</td>
                      <td className="px-5 py-4 text-[13px] font-semibold text-[#111] whitespace-nowrap">{won(s.payout_amount)}</td>
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
