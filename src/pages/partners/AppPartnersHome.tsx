import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import PartnersGate from '../../components/partners/PartnersGate'
import BestProductRow from '../../components/partners/BestProductRow'
import { won } from '../../lib/format'
import {
  affiliateLinkUrl, createAffiliateLink, getMySummary, listBestProducts, listMyLinks, parseProductIdFromUrl,
  type Affiliate, type AffiliateLink, type AffiliateSummary, type BestProduct,
} from '../../lib/affiliate'

// 개인 파트너스 페이지 — 정보 등록이 끝난 파트너의 내 페이지.
// 핵심은 하나: 앱의 판매 제품 링크를 넣으면 개인 링크가 만들어진다. 그 아래 내 링크 표, 이달 성과, 판매·정산·정보 메뉴.
export default function AppPartnersHome() {
  return (
    <PartnersGate title="내 파트너스">
      {({ affiliate }) => (affiliate ? <Home affiliate={affiliate} /> : null)}
    </PartnersGate>
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

function Home({ affiliate }: { affiliate: Affiliate }) {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<AffiliateSummary | null>(null)
  const [links, setLinks] = useState<AffiliateLink[]>([])
  const [best, setBest] = useState<BestProduct[]>([])
  const [aboutOpen, setAboutOpen] = useState(false)
  const [input, setInput] = useState('')
  const [making, setMaking] = useState(false)
  const [made, setMade] = useState<AffiliateLink | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }

  const load = async () => {
    const [s, l, b] = await Promise.all([getMySummary(), listMyLinks(), listBestProducts(10)])
    setSummary(s); setLinks(l); setBest(b)
  }
  useEffect(() => { void load() }, [])

  const make = async () => {
    setError(''); setMade(null)
    const pid = parseProductIdFromUrl(input)
    if (!pid) { setError('앱의 제품 페이지 링크를 붙여넣어 주세요. (예: beautyground.co.kr/app/product/…)'); return }
    setMaking(true)
    const res = await createAffiliateLink(pid)
    setMaking(false)
    if (!res.ok) { setError(res.message); return }
    setMade(res.link); setInput('')
    void load()
  }

  const share = async (link: AffiliateLink) => {
    const url = affiliateLinkUrl(link.code)
    if (navigator.share) { try { await navigator.share({ title: link.product?.name ?? '뷰티그라운드', url }); return } catch { /* 취소 */ } }
    if (await copyText(url)) showToast('링크를 복사했어요')
  }

  const rate = summary?.commission_rate ?? 5

  return (
    <AppFrame>
      <BackHeader title="내 파트너스" onBack={() => navigate('/app/mypage')} />

      <section className="px-5 pt-5">
        <p className="text-[12.5px] text-ink-soft">{affiliate.name} 파트너 · 코드 <b className="text-ink">{affiliate.code}</b></p>
      </section>

      {/* 파트너스란? — 상단 간단 설명(2026-09-26 대표님). 기본은 한 줄, 누르면 펼침 */}
      <section className="px-5 pt-4">
        <div className="rounded-control bg-quiet px-4 py-3.5">
          <button type="button" onClick={() => setAboutOpen((v) => !v)} aria-expanded={aboutOpen} className="w-full flex items-center justify-between text-left focus:outline-none focus-visible:shadow-ring">
            <span className="text-[14px] font-bold text-ink">파트너스란?</span>
            <span className={`text-ink-faint text-[12px] transition-transform ${aboutOpen ? 'rotate-180' : ''}`} aria-hidden="true">⌄</span>
          </button>
          <p className="text-[13px] text-ink-soft mt-1.5 leading-relaxed">
            앱 제품을 <b className="text-ink">내 링크</b>로 소개하고, 그 링크로 구매가 생기면 판매금액의 <b className="text-ink">{rate}%</b>를 받는 제도예요.
          </p>
          {aboutOpen && (
            <ul className="mt-2 space-y-1 text-[12.5px] text-ink-soft leading-relaxed list-disc pl-4">
              <li>제품 링크를 붙여넣거나 아래 잘 팔리는 제품에서 [내 링크]를 누르면 바로 만들어져요.</li>
              <li>내 링크로 들어온 손님이 7일 안에 구매하면 내 판매로 잡혀요. 취소·환불은 제외.</li>
              <li>매월 정산해 등록한 계좌로 보내드려요. 재고·배송·비용 부담이 없어요.</li>
              <li>다른 파트너를 모집하거나 하위 판매 수당을 받는 방식은 아니에요.</li>
            </ul>
          )}
        </div>
      </section>

      {/* 개인 링크 만들기 — 이 페이지의 핵심 */}
      <section className="px-5 pt-5">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">앱의 판매 제품 링크를 붙여넣으면</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">내 개인 링크가 만들어져요</h2>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void make() }}
            placeholder="https://beautyground.co.kr/app/product/…"
            className="flex-1 min-w-0 rounded-control bg-paper border border-rule px-4 py-3 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring"
          />
          <button type="button" onClick={() => void make()} disabled={making}
            className="shrink-0 px-4 rounded-control bg-ink text-paper text-[13.5px] font-semibold disabled:opacity-50">
            {making ? '…' : '만들기'}
          </button>
        </div>
        {error && <p className="text-[12.5px] text-signal-red mt-2" role="alert">{error}</p>}
        <p className="text-[12px] text-ink-faint mt-2">제품 페이지에서 공유 → 링크 복사한 뒤 여기 붙여넣으세요.</p>

        {made && (
          <div className="mt-4 rounded-control border border-rule p-4">
            <p className="text-[12px] text-ink-faint mb-1">내 개인 링크</p>
            <p className="text-[13.5px] font-semibold text-ink break-all">{affiliateLinkUrl(made.code)}</p>
            {made.product?.name && <p className="text-[12.5px] text-ink-soft mt-1">{made.product.name}</p>}
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={async () => { if (await copyText(affiliateLinkUrl(made.code))) showToast('링크를 복사했어요') }} className="flex-1 rounded-control bg-ink text-paper text-[13px] font-semibold py-2.5">복사</button>
              <button type="button" onClick={() => void share(made)} className="flex-1 rounded-control border border-ink text-ink text-[13px] font-semibold py-2.5">공유</button>
            </div>
          </div>
        )}
      </section>

      {/* 잘 팔리는 제품 TOP 10 — 링크 붙이는 곳 바로 아래(2026-09-26 대표님). [내 링크]로 한 번에 생성·복사 */}
      {best.length > 0 && (
        <section className="px-5 pt-7">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[15px] font-bold text-ink">잘 팔리는 제품 TOP 10</h2>
            <Link to="/app/partners/best" className="text-[12.5px] text-ink-soft underline underline-offset-2">더보기</Link>
          </div>
          <p className="text-[12px] text-ink-faint mb-1">앱에서 잘 팔리는 순 · 추천 제품으로 내 링크를 만들어 보세요</p>
          <ul className="divide-y divide-rule">
            {best.map((p) => <BestProductRow key={p.id} p={p} onToast={showToast} onMade={() => void load()} />)}
          </ul>
        </section>
      )}

      {/* 내 링크 표 */}
      <section className="px-5 pt-7">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] font-bold text-ink">내 링크 {links.length > 0 && <span className="text-ink-faint font-normal text-[13px]">{links.length}개</span>}</h2>
          {links.length > 5 && <Link to="/app/partners/links" className="text-[12.5px] text-ink-soft underline underline-offset-2">전체 보기</Link>}
        </div>
        {links.length === 0 ? (
          <p className="text-[13px] text-ink-faint py-4">아직 만든 링크가 없어요. 위에서 첫 링크를 만들어 보세요.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11.5px] text-ink-faint border-b border-rule">
                <th className="text-left font-normal py-2">제품</th>
                <th className="text-right font-normal py-2 w-12 whitespace-nowrap">클릭</th>
                <th className="text-right font-normal py-2 w-14"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {links.slice(0, 5).map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {l.product?.thumbnail_url ? <img src={l.product.thumbnail_url} alt="" className="w-9 h-9 rounded-md object-cover bg-quiet shrink-0" /> : <div className="w-9 h-9 rounded-md bg-quiet shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-ink truncate">{l.product?.name ?? '상품'}</p>
                        <p className="text-[11.5px] text-ink-faint truncate">{affiliateLinkUrl(l.code).replace(/^https?:\/\//, '')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-ink-soft whitespace-nowrap">{l.clicks}</td>
                  <td className="py-2.5 text-right">
                    <button type="button" onClick={async () => { if (await copyText(affiliateLinkUrl(l.code))) showToast('링크를 복사했어요') }} className="text-[12px] font-semibold text-ink border border-rule rounded-control px-2.5 py-1 whitespace-nowrap">복사</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 이달 성과 */}
      <section className="px-5 pt-7">
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
            <p className="text-[11.5px] opacity-70 mt-2">{won(summary.next_tier_min_sales - summary.total_sales)} 더 팔면 {summary.next_tier_name} 등급</p>
          )}
        </div>
      </section>

      <section className="px-5 pt-6 pb-10">
        <div className="rounded-control border border-rule divide-y divide-rule">
          {[
            { label: '내 링크 전체', path: '/app/partners/links' },
            { label: '판매 내역 · 정산', path: '/app/partners/settlement' },
            { label: '개인정보 · 계좌 수정', path: '/app/partners/info' },
          ].map((m) => (
            <button key={m.path} type="button" onClick={() => navigate(m.path)} className="w-full flex items-center justify-between px-4 py-3.5 text-[14px] text-ink focus:outline-none focus-visible:shadow-ring">
              <span>{m.label}</span><span className="text-ink-faint" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className="text-[11.5px] text-ink-faint mt-4 leading-relaxed">내 링크로 들어온 손님이 7일 안에 구매하면 내 판매로 잡혀요. 취소·환불은 제외돼요.</p>
      </section>

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>}
    </AppFrame>
  )
}
