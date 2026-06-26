import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Settlement, Partner } from '../../lib/types'
import { won } from '../../lib/format'

const CARD_STYLE = { borderColor: '#e5e0d8', borderWidth: '0.5px' } as const

const STATUS_LABEL: Record<Settlement['status'], string> = {
  pending: '정산 대기',
  paid: '지급 완료',
}

const STATUS_CLASS: Record<Settlement['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-green-100 text-green-700',
}

function StatusBadge({ status }: { status: Settlement['status'] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-pill text-[12px] ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export default function PartnerSettlement() {
  const [loading, setLoading] = useState<boolean>(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [settlements, setSettlements] = useState<Settlement[]>([])

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
        .from('settlements')
        .select('*')
        .eq('partner_id', p.id)
        .order('created_at', { ascending: false })

      if (!active) return
      setSettlements((data ?? []) as Settlement[])
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
        <h1 className="text-[22px] font-bold text-text mb-6">정산 내역</h1>
        <div className="text-[14px] text-text-sub">불러오는 중...</div>
      </div>
    )
  }

  if (!partner) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text mb-6">정산 내역</h1>
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
      <h1 className="text-[22px] font-bold text-text mb-6">정산 내역</h1>

      <div className="bg-white rounded-md border p-6" style={CARD_STYLE}>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-text-hint border-b" style={CARD_STYLE}>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">기간</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">총매출</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">수수료</th>
                <th className="py-3 pr-4 font-medium whitespace-nowrap">지급액</th>
                <th className="py-3 font-medium whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-hint">
                    정산 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="border-b" style={CARD_STYLE}>
                    <td className="py-3 pr-4 text-text whitespace-nowrap">
                      {s.period ?? '-'}
                    </td>
                    <td className="py-3 pr-4 text-text whitespace-nowrap">
                      {won(s.total_sales)}
                    </td>
                    <td className="py-3 pr-4 text-text whitespace-nowrap">
                      {won(s.commission)}
                    </td>
                    <td className="py-3 pr-4 text-text whitespace-nowrap">
                      {won(s.payout_amount)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={s.status} />
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
