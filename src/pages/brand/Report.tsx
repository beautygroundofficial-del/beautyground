import { useEffect, useMemo, useState } from 'react'
import { IconChartBar } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner } from '../../lib/types'
import { won } from '../../lib/format'

// 브랜드 셀러센터 — 성과 리포트 (2026-09-12)
// 로드맵 "브랜드 셀러센터 메뉴 구조 확정" 3번(판매관리) 중 남아있던 성과 리포트.
// 새 RPC 없이 get_my_orders()(brand_orders_view.sql) 결과를 화면에서 집계만 한다 —
// 주문 500건 한도라 클라이언트 집계로 충분, 서버 부하·추가 스키마 불필요.

interface MyOrderRow {
  id: string
  product_id: string
  product_name: string
  quantity: number
  amount: number
  status: string
  created_at: string
}

const SETTLED_STATUSES = ['paid', 'shipped', 'done']
const PERIODS = [
  { key: '7', label: '최근 7일', days: 7 },
  { key: '30', label: '최근 30일', days: 30 },
  { key: '90', label: '최근 90일', days: 90 },
  { key: 'all', label: '전체', days: null as number | null },
]

const card = 'bg-white rounded-[14px] border border-[#e5e0d8]'

function dateKey(iso: string) {
  return iso.slice(0, 10)
}

export default function BrandReport() {
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [orders, setOrders] = useState<MyOrderRow[]>([])
  const [period, setPeriod] = useState<string>('30')
  const [err, setErr] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getMyPartner()
      if (!active) return
      setPartner(p)
      if (!p) { setLoading(false); return }
      const { data, error } = await supabase.rpc('get_my_orders')
      if (!active) return
      if (error) setErr(error.message)
      setOrders((data ?? []) as MyOrderRow[])
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const settled = orders.filter((o) => SETTLED_STATUSES.includes(o.status))
    const p = PERIODS.find((x) => x.key === period)
    if (!p || p.days == null) return settled
    const cutoff = Date.now() - p.days * 86400_000
    return settled.filter((o) => new Date(o.created_at).getTime() >= cutoff)
  }, [orders, period])

  const summary = useMemo(() => {
    const totalAmount = filtered.reduce((s, o) => s + o.amount, 0)
    const totalQty = filtered.reduce((s, o) => s + o.quantity, 0)
    const orderCount = filtered.length
    const avg = orderCount > 0 ? Math.round(totalAmount / orderCount) : 0
    return { totalAmount, totalQty, orderCount, avg }
  }, [filtered])

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; amount: number }>()
    for (const o of filtered) {
      const cur = map.get(o.product_id) ?? { name: o.product_name, qty: 0, amount: 0 }
      cur.qty += o.quantity
      cur.amount += o.amount
      map.set(o.product_id, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 10)
  }, [filtered])

  const byDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of filtered) {
      const k = dateKey(o.created_at)
      map.set(k, (map.get(k) ?? 0) + o.amount)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 14)
  }, [filtered])

  const maxDayAmount = Math.max(1, ...byDay.map(([, v]) => v))
  const maxProductAmount = Math.max(1, ...byProduct.map((p) => p.amount))

  if (loading) {
    return <div className="flex items-center justify-center py-24"><p className="text-[14px] text-[#9a9080]">불러오는 중...</p></div>
  }

  if (!partner) {
    return (
      <div className={`max-w-md mx-auto mt-16 ${card} p-10 text-center`}>
        <p className="text-[16px] font-semibold text-[#111] mb-2">브랜드 계정을 찾을 수 없습니다</p>
        <p className="text-[14px] text-[#9a9080]">뷰티그라운드 담당자에게 문의해 주세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-2 mb-5 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition ${
              period === p.key ? 'bg-[#111] text-white' : 'bg-white border border-[#e5e0d8] text-[#6b6355]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {err && <p className="text-[13px] text-[#a32118] mb-3">{err}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className={`${card} p-5`}>
          <p className="text-[12px] text-[#9a9080] mb-1">판매 금액</p>
          <p className="text-[18px] font-bold text-[#111] tabular-nums">{won(summary.totalAmount)}</p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-[12px] text-[#9a9080] mb-1">판매 수량</p>
          <p className="text-[18px] font-bold text-[#111] tabular-nums">{summary.totalQty.toLocaleString('ko-KR')}개</p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-[12px] text-[#9a9080] mb-1">주문 건수</p>
          <p className="text-[18px] font-bold text-[#111] tabular-nums">{summary.orderCount.toLocaleString('ko-KR')}건</p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-[12px] text-[#9a9080] mb-1">건당 평균</p>
          <p className="text-[18px] font-bold text-[#111] tabular-nums">{won(summary.avg)}</p>
        </div>
      </div>

      <div className={`${card} p-6 mb-6`}>
        <h2 className="text-[14px] font-bold text-[#111] mb-4">일별 판매 추이</h2>
        {byDay.length === 0 ? (
          <p className="text-[13px] text-[#9a9080] text-center py-6">해당 기간 판매 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {byDay.map(([day, amount]) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-[76px] shrink-0 text-[11.5px] text-[#9a9080] tabular-nums">{day.slice(5)}</span>
                <div className="flex-1 h-5 bg-[#f7f4ef] rounded overflow-hidden">
                  <div
                    className="h-full bg-[#b8924a] rounded"
                    style={{ width: `${Math.max(4, Math.round((amount / maxDayAmount) * 100))}%` }}
                  />
                </div>
                <span className="w-[84px] shrink-0 text-right text-[12px] text-[#111] font-semibold tabular-nums">{won(amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-[#111]">상품별 판매 순위</h2>
          <span className="text-[12px] text-[#9a9080]">상위 10개</span>
        </div>
        {byProduct.length === 0 ? (
          <div className="text-center py-10">
            <IconChartBar size={30} className="text-[#e5e0d8] mx-auto mb-2" />
            <p className="text-[13px] text-[#9a9080]">해당 기간 판매 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {byProduct.map((p, i) => (
              <div key={p.name + i} className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-[12px] font-bold text-[#b8924a] tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[#111] truncate">{p.name}</p>
                  <div className="h-1.5 bg-[#f7f4ef] rounded overflow-hidden mt-1">
                    <div
                      className="h-full bg-[#b8924a] rounded"
                      style={{ width: `${Math.max(4, Math.round((p.amount / maxProductAmount) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12.5px] font-semibold text-[#111] tabular-nums">{won(p.amount)}</p>
                  <p className="text-[11px] text-[#9a9080] tabular-nums">{p.qty}개</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
