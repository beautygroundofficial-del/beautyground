import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import SellerGate from '../../components/seller/SellerGate'
import { won } from '../../lib/format'
import {
  affiliateLinkUrl, createAffiliateLink, getMySummary, listMyLinks, parseProductIdFromUrl,
  type Affiliate, type AffiliateLink, type AffiliateSummary,
} from '../../lib/affiliate'

// 링크 셀러 홈 — 이달 성과 카드 + 링크 만들기 + 최근 링크 + 메뉴.
// 화면 하나에서 "링크를 만든다 → 복사한다"까지 끝나야 한다(4060 고객, 단순화).
export default function AppSeller() {
  return (
    <SellerGate title="링크 셀러">
      {({ affiliate }) => (affiliate ? <SellerHome affiliate={affiliate} /> : null)}
    </SellerGate>
  )
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch {
    try {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select()
      const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok
    } catch { return false }
  }
}

function SellerHome({ affiliate }: { affiliate: Affiliate }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AffiliateSummary | null>(null)
  const [links, setLinks] = useState<AffiliateLink[]>([])
  const [input, setInput] = useState('')
  const [making, setMaking] = useState(false)
  const [made, setMade] = useState<AffiliateLink | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }

  const load = async () => {
    const [s, l] = await Promise.all([getMySummary(), listMyLinks()])
    setSummary(s); setLinks(l)
  }
  useEffect(() => { void load() }, [])

  const make = async () => {
    setError(''); setMade(null)
    const pid = parseProductIdFromUrl(input)
    if (!pid) { setError('상품 페이지 링크를 붙여넣어 주세요. (예: beautyground.co.kr/app/product/…)'); return }
    setMaking(true)
    const res = await createAffiliateLink(pid)
    setMaking(false)
    if (!res.ok) { setError(res.message); return }
    setMade(res.link); setInput('')
    void load()
  }

  const share = async (link: AffiliateLink) => {
    const url = affiliateLinkUrl(link.code)
    const title = link.product?.name ?? '뷰티그라운드'
    if (navigator.share) { try { await navigator.share({ title, url }); return } catch { /* 취소 */ } }
    if (await copyText(url)) showToast('링크를 복사했어요')
  }

  const rate = summary?.commission_rate ?? 5

  return (
    <AppFrame>
      <BackHeader title="링크 셀러" onBack={() => navigate('/app/mypage')} />

      {/* 이달 성과 */}
      <section className="px-5 pt-5">
        <div className="rounded-control bg-ink text-paper p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[12px] opacity-80">{summary?.period ?? ''} 이달 판매</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-paper/15">{summary?.tier_name ?? '기본'} · 수수료 {rate}%</span>
          </div>
          <p className="text-[26px] font-bold mt-1 tabular-nums">{won(summary?.total_sales ?? 0)}</p>
          <div className="flex gap-5 mt-3 text-[12.5px] opacity-90">
            <span>예상 수수료 <b className="tabular-nums">{won(summary?.estimated_commission ?? 0)}</b></span>
            <span>주문 {summary?.order_count ?? 0}건</span>
            <span>클릭 {summary?.click_count ?? 0}</span>
          </div>
          {summary?.next_tier_name && summary.next_tier_min_sales != null && (
            <p className="text-[11.5px] opacity-70 mt-2">
              {won(summary.next_tier_min_sales - summary.total_sales)} 더 팔면 {summary.next_tier_name} 등급
            </p>
          )}
        </div>
      </section>

      {/* 링크 만들기 */}
      <section className="px-5 pt-6">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">상품 페이지 링크를 붙여넣으면</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">내 링크가 만들어져요</h2>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void make() }}
            placeholder="https://beautyground.co.kr/app/product/…"
            className="flex-1 min-w-0 rounded-control bg-paper border border-rule px-4 py-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring"
          />
          <button
            type="button"
            onClick={() => void make()}
            disabled={making}
            className="shrink-0 px-4 rounded-control bg-ink text-paper text-[13.5px] font-semibold disabled:opacity-50"
          >
            {making ? '…' : '만들기'}
          </button>
        </div>
        {error && <p className="text-[12.5px] text-signal-red mt-2" role="alert">{error}</p>}
        <p className="text-[12px] text-ink-faint mt-2">상품 페이지에서 공유 → 링크 복사한 뒤 여기 붙여넣으세요.</p>

        {made && (
          <div className="mt-4 rounded-control border border-rule p-4">
            <p className="text-[12px] text-ink-faint mb-1">내 링크</p>
            <p className="text-[13.5px] font-semibold text-ink break-all">{affiliateLinkUrl(made.code)}</p>
            {made.product?.name && <p className="text-[12.5px] text-ink-soft mt-1">{made.product.name}</p>}
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={async () => { if (await copyText(affiliateLinkUrl(made.code))) showToast('링크를 복사했어요') }} className="flex-1 rounded-control bg-ink text-paper text-[13px] font-semibold py-2.5">복사</button>
              <button type="button" onClick={() => void share(made)} className="flex-1 rounded-control border border-ink text-ink text-[13px] font-semibold py-2.5">공유</button>
            </div>
          </div>
        )}
      </section>

      {/* 최근 링크 */}
      <section className="px-5 pt-7">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-bold text-ink">내 링크 {links.length > 0 && <span className="text-ink-faint font-normal text-[13px]">{links.length}개</span>}</h2>
          {links.length > 3 && <Link to="/app/seller/links" className="text-[12.5px] text-ink-soft underline underline-offset-2">전체 보기</Link>}
        </div>
        {links.length === 0 ? (
          <p className="text-[13px] text-ink-faint py-4">아직 만든 링크가 없어요. 위에서 첫 링크를 만들어 보세요.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {links.slice(0, 3).map((l) => (
              <li key={l.id} className="py-3 flex items-center gap-3">
                {l.product?.thumbnail_url ? (
                  <img src={l.product.thumbnail_url} alt="" className="w-11 h-11 rounded-lg object-cover bg-quiet shrink-0" />
                ) : <div className="w-11 h-11 rounded-lg bg-quiet shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] text-ink truncate">{l.product?.name ?? '상품'}</p>
                  <p className="text-[12px] text-ink-faint">클릭 {l.clicks} · {l.code}</p>
                </div>
                <button type="button" onClick={async () => { if (await copyText(affiliateLinkUrl(l.code))) showToast('링크를 복사했어요') }} className="shrink-0 text-[12.5px] font-semibold text-ink border border-rule rounded-control px-3 py-1.5">복사</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 메뉴 */}
      <section className="px-5 pt-7 pb-10">
        <div className="rounded-control border border-rule divide-y divide-rule">
          {[
            { label: '내 링크 전체', path: '/app/seller/links' },
            { label: '판매 내역 · 정산', path: '/app/seller/settlement' },
            { label: '내 정보 · 정산 계좌', path: '/app/seller/profile' },
          ].map((m) => (
            <button key={m.path} type="button" onClick={() => navigate(m.path)} className="w-full flex items-center justify-between px-4 py-3.5 text-[14px] text-ink focus:outline-none focus-visible:shadow-ring">
              <span>{m.label}</span><span className="text-ink-faint" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-faint mt-4 leading-relaxed">
          셀러 코드 {affiliate.code} · 링크로 들어온 손님이 7일 안에 구매하면 내 판매로 잡혀요. 취소·환불은 제외돼요.
        </p>
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>
      )}
    </AppFrame>
  )
}
