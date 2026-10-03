import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import PartnersGate from '../../components/partners/PartnersGate'
import BestProductRow from '../../components/partners/BestProductRow'
import { useShopCategories } from '../../hooks/useShopCategories'
import { useShopProducts } from '../../hooks/useShopProducts'
import { listBestProducts, type BestProduct } from '../../lib/affiliate'

// 인기 제품 — 개인 파트너스 페이지의 메뉴 [인기 제품 TOP 10]에서 들어온다.
// 처음엔 TOP 10(판매·찜·리뷰 점수 순)만 보여주고, [더보기]를 누르면 카테고리별 전체 상품 탐색으로 전환된다.
export default function AppPartnersBest() {
  const navigate = useNavigate()
  const [browsing, setBrowsing] = useState(false)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }

  return (
    <PartnersGate title="인기 제품">
      {() => (
        <AppFrame>
          <BackHeader title="인기 제품" onBack={() => navigate('/app/partners/home')} />
          {browsing ? (
            <CategoryBrowse onToast={showToast} />
          ) : (
            <Top10 onMore={() => setBrowsing(true)} onToast={showToast} />
          )}
          {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>}
        </AppFrame>
      )}
    </PartnersGate>
  )
}

function Top10({ onMore, onToast }: { onMore: () => void; onToast: (m: string) => void }) {
  const [items, setItems] = useState<BestProduct[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { void listBestProducts(10).then((r) => { setItems(r); setLoading(false) }) }, [])
  return (
    <section className="px-5 pt-4 pb-10">
      <p className="text-[12px] text-ink-faint mb-1">판매·찜·리뷰 기준 인기 순, 브랜드별 대표 제품 · [내 링크]를 누르면 바로 만들어지고 복사돼요</p>
      {loading ? (
        <p className="text-[13px] text-ink-faint py-10 text-center">불러오는 중…</p>
      ) : (
        <ul className="divide-y divide-rule">
          {items.map((p) => <BestProductRow key={p.id} p={p} onToast={onToast} />)}
        </ul>
      )}
      <button type="button" onClick={onMore}
        className="mt-4 w-full rounded-control border border-rule text-ink text-[13.5px] font-semibold py-3">
        더보기 — 카테고리별로 보기
      </button>
    </section>
  )
}

function CategoryBrowse({ onToast }: { onToast: (m: string) => void }) {
  const { categories } = useShopCategories()
  const [selected, setSelected] = useState<string | null>(null)
  const { products, loading, hasMore, loadMore } = useShopProducts({ category: selected ?? undefined, sort: 'latest', pageSize: 20 })
  const tabs = [null, ...categories]

  return (
    <>
      <div className="px-5 pt-3 pb-2 flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map((cat) => (
          <button key={cat ?? 'all'} type="button" onClick={() => setSelected(cat)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12.5px] font-semibold whitespace-nowrap ${
              selected === cat ? 'bg-ink text-paper' : 'bg-quiet text-ink-soft'
            }`}>
            {cat ?? '전체'}
          </button>
        ))}
      </div>
      <section className="px-5 pt-2 pb-10">
        {products.length === 0 && !loading ? (
          <p className="text-[13px] text-ink-faint py-10 text-center">상품이 없어요.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {products.map((p, i) => (
              <BestProductRow
                key={p.id}
                p={{ id: p.id, name: p.name, thumbnail_url: p.thumbnail_url, price: p.price, sale_price: p.sale_price, sold_qty: 0, rank: i + 1 }}
                onToast={onToast}
              />
            ))}
          </ul>
        )}
        {hasMore && (
          <button type="button" onClick={loadMore} disabled={loading}
            className="mt-4 w-full rounded-control border border-rule text-ink text-[13.5px] font-semibold py-3 disabled:opacity-50">
            {loading ? '불러오는 중…' : '더 보기'}
          </button>
        )}
      </section>
    </>
  )
}
