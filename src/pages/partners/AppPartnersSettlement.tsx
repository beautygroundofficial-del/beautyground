import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import PartnersGate from '../../components/partners/PartnersGate'
import { formatDateOnly, won } from '../../lib/format'
import {
  getMySummary, getTiers, listMySales, listMySettlements, ORDER_STATUS_LABEL,
  type AffiliateSale, type AffiliateSettlement, type AffiliateSummary, type AffiliateTier,
} from '../../lib/affiliate'

// 판매 내역 · 정산 — 이달 요약, 등급표, 월별 정산(관리자가 생성·지급확정), 최근 판매 건.
// 구매자 이름·연락처는 뷰 자체에 없어 화면에도 없다(affiliate_sales_view).
export default function AppPartnersSettlement() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AffiliateSummary | null>(null)
  const [tiers, setTiers] = useState<AffiliateTier[]>([])
  const [settlements, setSettlements] = useState<AffiliateSettlement[]>([])
  const [sales, setSales] = useState<AffiliateSale[]>([])

  useEffect(() => {
    void Promise.all([getMySummary(), getTiers(), listMySettlements(), listMySales()]).then(([s, t, st, sa]) => {
      setSummary(s); setTiers(t); setSettlements(st); setSales(sa)
    })
  }, [])

  return (
    <PartnersGate title="판매 내역 · 정산">
      {() => (
        <AppFrame>
          <BackHeader title="판매 내역 · 정산" onBack={() => navigate('/app/partners/home')} />

          <section className="px-5 pt-5">
            <div className="rounded-control border border-rule p-4">
              <p className="text-[12px] text-ink-faint">{summary?.period ?? ''} 이달</p>
              <div className="flex items-baseline gap-3 mt-1">
                <p className="text-[20px] font-bold text-ink tabular-nums">{won(summary?.total_sales ?? 0)}</p>
                <p className="text-[13px] text-ink-soft">예상 수수료 <b className="text-ink tabular-nums">{won(summary?.estimated_commission ?? 0)}</b></p>
              </div>
              <p className="text-[12px] text-ink-faint mt-1">{summary?.tier_name ?? '기본'} 등급 · 수수료 {summary?.commission_rate ?? 5}% · 결제완료 이상 주문 기준</p>
            </div>
          </section>

          {tiers.length > 0 && (
            <section className="px-5 pt-6">
              <h2 className="text-[14px] font-bold text-ink mb-2">판매 등급</h2>
              <ul className="rounded-control border border-rule divide-y divide-rule">
                {tiers.map((t) => (
                  <li key={t.id} className={`flex items-center justify-between px-4 py-2.5 text-[13px] ${summary?.tier_name === t.name ? 'bg-quiet font-semibold' : ''}`}>
                    <span className="text-ink">{t.name}</span>
                    <span className="text-ink-soft">월 {won(t.min_sales)} 이상 · {t.commission_rate}%</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="px-5 pt-6">
            <h2 className="text-[14px] font-bold text-ink mb-2">월별 정산</h2>
            {settlements.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-3">아직 정산된 달이 없어요. 매월 초에 지난달 판매를 정산해요.</p>
            ) : (
              <ul className="rounded-control border border-rule divide-y divide-rule">
                {settlements.map((s) => (
                  <li key={s.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[13.5px] text-ink">{s.period}</p>
                      <p className="text-[12px] text-ink-faint">판매 {won(s.total_sales)} · {s.tier_name ?? '기본'} {s.commission_rate}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-bold text-ink tabular-nums">{won(s.commission_amount)}</p>
                      <p className={`text-[11.5px] ${s.status === 'paid' ? 'text-accent-deep' : 'text-ink-faint'}`}>{s.status === 'paid' ? `지급완료 ${formatDateOnly(s.paid_at)}` : '지급 예정'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="px-5 pt-6 pb-10">
            <h2 className="text-[14px] font-bold text-ink mb-2">최근 판매</h2>
            {sales.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-3">아직 내 링크로 들어온 주문이 없어요.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {sales.map((o) => (
                  <li key={o.id} className="py-3 flex items-center gap-3">
                    {o.thumbnail_url ? <img src={o.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-quiet shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-quiet shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-ink truncate">{o.product_name ?? '상품'}</p>
                      <p className="text-[11.5px] text-ink-faint">{formatDateOnly(o.created_at)} · {o.quantity}개 · {ORDER_STATUS_LABEL[o.status] ?? o.status}</p>
                    </div>
                    <p className="text-[13px] font-semibold text-ink tabular-nums shrink-0">{won(o.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </AppFrame>
      )}
    </PartnersGate>
  )
}
