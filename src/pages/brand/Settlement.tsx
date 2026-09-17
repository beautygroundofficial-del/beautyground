import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner, Settlement } from '../../lib/types'
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

export default function BrandSettlement() {
  const [searchParams] = useSearchParams()
  const asPartnerId = searchParams.get('as') ?? undefined
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [settlements, setSettlements] = useState<Settlement[]>([])

  useEffect(() => {
    let active = true
    const load = async () => {
      const p = await getMyPartner(asPartnerId)
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
  }, [asPartnerId])

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

  const thisKey = thisMonthKey()
  const prevKey = prevMonthKey()

  const thisMonthPending = settlements
    .filter((s) => s.status === 'pending' && s.period.startsWith(thisKey))
    .reduce((sum, s) => sum + s.payout_amount, 0)

  const lastMonthPaid = settlements
    .filter((s) => s.status === 'paid' && s.period.startsWith(prevKey))
    .reduce((sum, s) => sum + s.payout_amount, 0)

  const totalPaid = settlements
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + s.payout_amount, 0)

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
          <li>• 수수료율은 현재 {partner.commission_rate}%가 적용됩니다.</li>
          <li>• 정산은 관리자가 매월 생성하며, 입금 예정일은 별도 안내드립니다.</li>
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
                  {['정산 기간', '총매출', '수수료', '지급액', '상태'].map((col) => (
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
