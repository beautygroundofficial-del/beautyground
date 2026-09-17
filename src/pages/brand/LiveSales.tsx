import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner, PartnerSaleRow } from '../../lib/types'
import { comma, formatDateTime } from '../../lib/format'
import PeriodFilter from '../../components/common/PeriodFilter'
import { computePeriodRange, inRange, type PeriodKey } from '../../lib/period'

const SETTLED_STATUSES = ['paid', 'shipped', 'done']

interface LiveSalesGroup {
  live_id: string
  live_title: string
  live_scheduled_at: string | null
  total_amount: number
  total_quantity: number
}

// 브랜드가 "이 방송에서 몇 개/얼마 팔렸는지"를 라이브 방송별로 확인하는 화면.
export default function BrandLiveSales() {
  const [searchParams] = useSearchParams()
  const asPartnerId = searchParams.get('as') ?? undefined
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [rows, setRows] = useState<PartnerSaleRow[]>([])

  const [periodKey, setPeriodKey] = useState<PeriodKey>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const p = await getMyPartner(asPartnerId)
      if (!active) return
      if (!p) { setPartner(null); setLoading(false); return }
      setPartner(p)

      const { data } = asPartnerId
        ? await supabase.rpc('get_partner_live_sales', { p_partner_id: asPartnerId }).order('live_scheduled_at', { ascending: false })
        : await supabase.from('partner_live_sales_view').select('*').order('live_scheduled_at', { ascending: false })
      if (!active) return

      setRows(((data ?? []) as PartnerSaleRow[]).filter((r) => SETTLED_STATUSES.includes(r.status) && r.live_id))
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [asPartnerId])

  const groups = useMemo(() => {
    const range = computePeriodRange(periodKey, customStart, customEnd)
    const filtered = rows.filter((r) => inRange(r.created_at, range))
    const byLive = new Map<string, LiveSalesGroup>()
    filtered.forEach((r) => {
      const key = r.live_id as string
      const existing = byLive.get(key)
      if (existing) {
        existing.total_amount += r.amount
        existing.total_quantity += r.quantity
      } else {
        byLive.set(key, {
          live_id: key,
          live_title: r.live_title ?? '(제목 없음)',
          live_scheduled_at: r.live_scheduled_at,
          total_amount: r.amount,
          total_quantity: r.quantity,
        })
      }
    })
    return Array.from(byLive.values())
  }, [rows, periodKey, customStart, customEnd])

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

  const totalAmount = groups.reduce((sum, g) => sum + g.total_amount, 0)
  const totalQuantity = groups.reduce((sum, g) => sum + g.total_quantity, 0)

  return (
    <>
      <PeriodFilter
        value={periodKey} customStart={customStart} customEnd={customEnd}
        onChange={setPeriodKey}
        onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e) }}
        theme="gold"
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <p className="text-[12px] text-[#9a9080] mb-2">판매금액</p>
          <p className="font-serif text-[22px] font-bold text-[#111]">{comma(totalAmount)}원</p>
        </div>
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <p className="text-[12px] text-[#9a9080] mb-2">판매수량</p>
          <p className="font-serif text-[22px] font-bold text-[#111]">{comma(totalQuantity)}개</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[14px] border border-[#e5e0d8]">
          <p className="text-[14px] text-[#9a9080]">라이브 방송을 통한 판매 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eee]">
                  {['방송', '방송일시', '판매수량', '판매금액'].map((col) => (
                    <th key={col} className="text-left text-[11px] text-[#9a9080] font-medium px-5 py-4 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.live_id} className="border-b border-[#eee] hover:bg-[#fdf9f5] transition-colors">
                    <td className="px-5 py-4 text-[13px] text-[#111] max-w-[280px] truncate">{g.live_title}</td>
                    <td className="px-5 py-4 text-[13px] text-[#9a9080] whitespace-nowrap">{formatDateTime(g.live_scheduled_at)}</td>
                    <td className="px-5 py-4 text-[13px] text-[#9a9080] whitespace-nowrap">{comma(g.total_quantity)}개</td>
                    <td className="px-5 py-4 text-[13px] font-semibold text-[#111] whitespace-nowrap">{comma(g.total_amount)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
