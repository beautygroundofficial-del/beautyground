import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ShopProductCard, { ShopProductCardSkeleton } from '../product/ShopProductCard'
import DesktopHeader from '../layout/DesktopHeader'
import DesktopFooter from '../layout/DesktopFooter'
import PromoBar from '../home/PromoBar'
import type { ShopProduct, ShopSort } from '../../hooks/useShopProducts'
import type { ShopBrand } from '../../hooks/useShopBrands'

const SORT_OPTIONS: { label: string; value: ShopSort }[] = [
  { label: '최신순', value: 'latest' },
  { label: '낮은가격순', value: 'price_asc' },
  { label: '높은가격순', value: 'price_desc' },
]

interface Props {
  title: string
  tabs: (string | null)[]
  selected: string | null
  onSelect: (t: string | null) => void
  brands: ShopBrand[]
  brandId: string | null
  onSelectBrand: (id: string | null) => void
  sortIdx: number
  onSort: (i: number) => void
  products: ShopProduct[]
  loading: boolean
  error: string | null
  hasMore: boolean
  onLoadMore: () => void
}

// PC 버전 — 카테고리 탭은 상단 전체 폭, 정렬은 우측 정렬, 상품은 4열 그리드로 넓게 펼친다.
export default function DesktopCategoryDetail({
  title,
  tabs,
  selected,
  onSelect,
  brands,
  brandId,
  onSelectBrand,
  sortIdx,
  onSort,
  products,
  loading,
  error,
  hasMore,
  onLoadMore,
}: Props) {
  const navigate = useNavigate()
  const [showBrand, setShowBrand] = useState(false)
  const brandBoxRef = useRef<HTMLDivElement>(null)
  const selectedBrandName = brandId ? brands.find((b) => b.id === brandId)?.name ?? '브랜드' : '브랜드 전체'

  // 드롭다운 바깥(다른 정렬·탭 버튼 포함)을 클릭하면 자동으로 접힌다.
  useEffect(() => {
    if (!showBrand) return
    const onClickOutside = (e: MouseEvent) => {
      if (brandBoxRef.current && !brandBoxRef.current.contains(e.target as Node)) {
        setShowBrand(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showBrand])

  return (
    <div className="bg-paper min-h-screen">
      <PromoBar />
      <DesktopHeader promoBarAbove />

      <div className="max-w-[1280px] mx-auto px-6 py-8">
        <h1 className="text-[22px] font-bold text-ink">{title}</h1>

        <div className="mt-5 flex items-center justify-between border-b border-rule pb-4">
          <div className="flex gap-2 flex-wrap">
            {tabs.map((t) => {
              const active = selected === t
              return (
                <button
                  key={t ?? '__all__'}
                  onClick={() => onSelect(t)}
                  aria-pressed={active}
                  className={`rounded-control px-3.5 py-1.5 text-[13px] font-bold focus:outline-none focus-visible:shadow-ring ${
                    active ? 'bg-ink text-paper' : 'bg-paper text-ink-soft border border-rule'
                  }`}
                >
                  {t ?? '전체'}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <p className="text-[13px] text-ink-soft tabular-nums">전체 {products.length}개</p>
            {brands.length > 0 && (
              <div className="relative" ref={brandBoxRef}>
                <button
                  onClick={() => setShowBrand(!showBrand)}
                  className="flex items-center gap-1.5 text-[13px] text-ink focus:outline-none focus-visible:shadow-ring"
                  aria-haspopup="listbox"
                  aria-expanded={showBrand}
                >
                  <span>{selectedBrandName}</span>
                  <span aria-hidden="true">{showBrand ? '▲' : '▼'}</span>
                </button>
                {showBrand && (
                  <div
                    className="absolute right-0 top-full mt-1 bg-paper border border-rule overflow-y-auto z-20 min-w-[160px] max-h-[320px]"
                    role="listbox"
                    aria-label="브랜드 옵션"
                  >
                    <button
                      role="option"
                      aria-selected={brandId === null}
                      onClick={() => { onSelectBrand(null); setShowBrand(false) }}
                      className={`block w-full px-4 py-2.5 text-[13px] text-left whitespace-nowrap focus:outline-none focus-visible:shadow-ring ${
                        brandId === null ? 'text-ink font-bold' : 'text-ink-soft'
                      }`}
                    >
                      브랜드 전체
                    </button>
                    {brands.map((b) => (
                      <button
                        key={b.id}
                        role="option"
                        aria-selected={brandId === b.id}
                        onClick={() => { onSelectBrand(b.id); setShowBrand(false) }}
                        className={`block w-full px-4 py-2.5 text-[13px] text-left whitespace-nowrap focus:outline-none focus-visible:shadow-ring ${
                          brandId === b.id ? 'text-ink font-bold' : 'text-ink-soft'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-1">
              {SORT_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => onSort(i)}
                  aria-pressed={sortIdx === i}
                  className={`px-2.5 py-1 text-[13px] focus:outline-none focus-visible:shadow-ring ${
                    sortIdx === i ? 'text-ink font-bold' : 'text-ink-faint'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && products.length === 0 ? (
          <div className="mt-6 grid grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ShopProductCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 text-ink-faint text-[14px]">{error}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-faint text-[14px]">상품이 준비 중입니다.</p>
            {selected && (
              <button onClick={() => onSelect(null)} className="text-ink font-bold mt-3 text-[13px] focus:outline-none focus-visible:shadow-ring">
                전체 상품 보기 →
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-4 gap-5">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => navigate(`/app/product/${product.id}`)}
                  className="text-left focus:outline-none focus-visible:shadow-ring"
                  aria-label={`${product.brand_name ?? ''} ${product.name}`}
                >
                  <ShopProductCard product={product} />
                </button>
              ))}
            </div>
            {hasMore && (
              <div className="pt-6 flex justify-center">
                <button
                  onClick={onLoadMore}
                  disabled={loading}
                  className="px-10 py-3 rounded-control border border-rule text-[14px] text-ink-soft disabled:opacity-50 focus:outline-none focus-visible:shadow-ring"
                >
                  {loading ? '불러오는 중…' : '더보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <DesktopFooter />
    </div>
  )
}
