import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import PromoBar from '../components/home/PromoBar'
import DesktopCategoryDetail from '../components/category/DesktopCategoryDetail'
import { useViewMode } from '../lib/viewMode'
import ShopProductCard, { ShopProductCardSkeleton } from '../components/product/ShopProductCard'
import { useShopProducts, type ShopSort } from '../hooks/useShopProducts'
import { useShopCategories } from '../hooks/useShopCategories'
import { useShopBrands } from '../hooks/useShopBrands'
import { IconSearch } from '../components/common/Icon'

// 소비자 카테고리 슬러그 → 실제 products.category 저장값 (초기 탭 결정용)
const SLUG_TO_CATEGORY: Record<string, string> = {
  skincare: '스킨케어',
  makeup: '메이크업',
  perfume: '향수',
  hair: '헤어·바디',
  body: '헤어·바디',
  device: '뷰티 디바이스',
}

const SORT_OPTIONS: { label: string; value: ShopSort }[] = [
  { label: '최신순', value: 'latest' },
  { label: '낮은가격순', value: 'price_asc' },
  { label: '높은가격순', value: 'price_desc' },
]

export default function AppCategoryDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const [sortIdx, setSortIdx] = useState(0)
  const [showSort, setShowSort] = useState(false)
  const [showBrand, setShowBrand] = useState(false)
  const [brandId, setBrandId] = useState<string | null>(null)
  const sortBoxRef = useRef<HTMLDivElement>(null)
  const brandBoxRef = useRef<HTMLDivElement>(null)

  // 드롭다운 바깥(다른 버튼 포함)을 클릭하면 자동으로 접힌다.
  useEffect(() => {
    if (!showSort && !showBrand) return
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (showSort && sortBoxRef.current && !sortBoxRef.current.contains(target)) setShowSort(false)
      if (showBrand && brandBoxRef.current && !brandBoxRef.current.contains(target)) setShowBrand(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showSort, showBrand])

  // 탭: 전체 + 판매중 상품이 있는 실제 category 값 (0개 카테고리는 숨김)
  const { categories } = useShopCategories()
  const { brands } = useShopBrands()
  // 초기 탭: ?cat=<실제 category> 우선, 없으면 슬러그 매핑, 그 외 전체
  const [selected, setSelected] = useState<string | null>(
    searchParams.get('cat') ?? (id ? SLUG_TO_CATEGORY[id] ?? null : null)
  )

  // 상품 0개 카테고리로 진입했으면(탭이 숨겨지므로) 전체로 되돌림
  useEffect(() => {
    if (selected && categories.length > 0 && !categories.includes(selected)) {
      setSelected(null)
    }
  }, [categories, selected])

  const { products, loading, error, hasMore, loadMore } = useShopProducts({
    category: selected ?? undefined,
    brand: brandId ?? undefined,
    sort: SORT_OPTIONS[sortIdx].value,
    pageSize: 20,
  })
  const selectedBrandName = brandId ? brands.find((b) => b.id === brandId)?.name ?? '브랜드' : '브랜드 전체'

  const tabs = useMemo<(string | null)[]>(() => [null, ...categories], [categories])

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopCategoryDetail
          title={selected ?? '전체 상품'}
          tabs={tabs}
          selected={selected}
          onSelect={setSelected}
          brands={brands}
          brandId={brandId}
          onSelectBrand={setBrandId}
          sortIdx={sortIdx}
          onSort={setSortIdx}
          products={products}
          loading={loading}
          error={error}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </>
    )
  }

  return (
    <AppFrame>
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <PromoBar />
      <BackHeader
        promoBarAbove
        title={selected ?? '전체 상품'}
        rightElement={
          <button
            aria-label="검색"
            onClick={() => navigate('/app/search')}
            className="text-ink focus:outline-none focus-visible:shadow-ring"
          >
            <IconSearch className="w-5 h-5" />
          </button>
        }
      />

      {/* 카테고리 탭 — 가로 스크롤 가능한데 마지막 탭이 화면 끝에 딱 붙어 잘린 것처럼 보인다는
          지적(2026-08-25)으로 오른쪽에 스크롤 힌트용 페이드 그라데이션 추가 */}
      <nav
        className="relative bg-paper border-b border-rule sticky top-14 z-20"
        aria-label="카테고리"
      >
        <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => {
            const active = selected === t
            return (
              <button
                key={t ?? '__all__'}
                onClick={() => setSelected(t)}
                aria-pressed={active}
                className={`flex-shrink-0 rounded-control px-3.5 py-1.5 text-[13px] font-bold focus:outline-none focus-visible:shadow-ring ${
                  active ? 'bg-ink text-paper' : 'bg-paper text-ink-soft border border-rule'
                }`}
              >
                {t ?? '전체'}
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-paper to-transparent" aria-hidden="true" />
      </nav>

      {/* 정렬 바 */}
      <div className="bg-paper border-b border-rule px-4 py-2.5 flex items-center justify-between">
        <p className="text-[13px] text-ink-soft tabular-nums">전체 {products.length}개</p>
        <div className="flex items-center gap-3">
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
                  className="absolute right-0 top-full mt-1 bg-paper border border-rule overflow-y-auto z-20 min-w-[140px] max-h-[280px]"
                  role="listbox"
                  aria-label="브랜드 옵션"
                >
                  <button
                    role="option"
                    aria-selected={brandId === null}
                    onClick={() => { setBrandId(null); setShowBrand(false) }}
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
                      onClick={() => { setBrandId(b.id); setShowBrand(false) }}
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
          <div className="relative" ref={sortBoxRef}>
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-1.5 text-[13px] text-ink focus:outline-none focus-visible:shadow-ring"
            aria-haspopup="listbox"
            aria-expanded={showSort}
          >
            <span>{SORT_OPTIONS[sortIdx].label}</span>
            <span aria-hidden="true">{showSort ? '▲' : '▼'}</span>
          </button>
          {showSort && (
            <div
              className="absolute right-0 top-full mt-1 bg-paper border border-rule overflow-hidden z-20 min-w-[120px]"
              role="listbox"
              aria-label="정렬 옵션"
            >
              {SORT_OPTIONS.map((opt, i) => (
                <button
                  key={opt.value}
                  role="option"
                  aria-selected={sortIdx === i}
                  onClick={() => {
                    setSortIdx(i)
                    setShowSort(false)
                  }}
                  className={`block w-full px-4 py-2.5 text-[13px] text-left focus:outline-none focus-visible:shadow-ring ${
                    sortIdx === i ? 'text-ink font-bold' : 'text-ink-soft'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* 목록 */}
      {loading && products.length === 0 ? (
        <div className="px-4 pt-3 grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ShopProductCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 text-ink-faint text-[14px]">{error}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-ink-faint text-[14px]">상품이 준비 중입니다.</p>
          {selected && (
            <button onClick={() => setSelected(null)} className="text-ink font-bold mt-3 text-[13px] focus:outline-none focus-visible:shadow-ring">
              전체 상품 보기 →
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 grid grid-cols-2 gap-3">
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
            <div className="px-4 pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-3 rounded-control border border-rule text-[14px] text-ink-soft disabled:opacity-50 focus:outline-none focus-visible:shadow-ring"
              >
                {loading ? '불러오는 중…' : '더보기'}
              </button>
            </div>
          )}
        </>
      )}

    </AppFrame>
  )
}
