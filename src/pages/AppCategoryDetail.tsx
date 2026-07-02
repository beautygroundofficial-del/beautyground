import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import ShopProductCard, { ShopProductCardSkeleton } from '../components/product/ShopProductCard'
import { useShopProducts, type ShopSort } from '../hooks/useShopProducts'
import { CATEGORIES } from '../constants'

// 소비자 카테고리 슬러그 → 실제 products.category 저장값
const SLUG_TO_CATEGORY: Record<string, string> = {
  skincare: '스킨케어',
  makeup: '메이크업',
  perfume: '향수',
  hair: '헤어·바디',
  body: '헤어·바디',
}

const SORT_OPTIONS: { label: string; value: ShopSort }[] = [
  { label: '최신순', value: 'latest' },
  { label: '낮은가격순', value: 'price_asc' },
  { label: '높은가격순', value: 'price_desc' },
]

export default function AppCategoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sortIdx, setSortIdx] = useState(0)
  const [showSort, setShowSort] = useState(false)

  const cat = CATEGORIES.find((c) => c.id === id)
  const categoryValue = id ? SLUG_TO_CATEGORY[id] : undefined
  const { products, loading, error, hasMore, loadMore } = useShopProducts({
    category: categoryValue,
    sort: SORT_OPTIONS[sortIdx].value,
    pageSize: 20,
  })

  if (!cat) {
    return (
      <div className="min-h-screen bg-cream-4 flex items-center justify-center">
        <p className="text-text-hint">카테고리를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-4 pb-20">
      <BackHeader
        title={cat.label}
        rightElement={
          <button aria-label="검색" className="text-xl text-text">
            <span aria-hidden="true">🔍</span>
          </button>
        }
      />

      {/* 카테고리 헤더 배너 */}
      <div className="px-5 py-6 flex items-center gap-4" style={{ backgroundColor: cat.bg }}>
        <div
          className="w-14 h-14 rounded-[16px] flex items-center justify-center text-3xl"
          style={{ backgroundColor: cat.bg }}
          aria-hidden="true"
        >
          {cat.icon}
        </div>
        <div>
          <h2 className="text-[20px] font-bold" style={{ color: cat.color }}>
            {cat.label}
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: `${cat.color}99` }}>
            {products.length}개 상품
          </p>
        </div>
      </div>

      {/* 정렬 바 */}
      <div className="bg-white border-b border-cream-2 px-4 py-2.5 flex items-center justify-between">
        <p className="text-[13px] text-text-sub">전체 {products.length}개</p>
        <div className="relative">
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-1.5 text-[13px] text-text"
            aria-haspopup="listbox"
            aria-expanded={showSort}
          >
            <span>{SORT_OPTIONS[sortIdx].label}</span>
            <span aria-hidden="true">{showSort ? '▲' : '▼'}</span>
          </button>
          {showSort && (
            <div
              className="absolute right-0 top-full mt-1 bg-white border border-cream-2 rounded-md overflow-hidden z-20 min-w-[120px]"
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
                  className={`block w-full px-4 py-2.5 text-[13px] text-left hover:bg-cream-2 transition-colors ${
                    sortIdx === i ? 'text-gold font-semibold' : 'text-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
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
        <div className="text-center py-16 text-text-hint text-[14px]">{error}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-hint text-[14px]">상품이 준비 중입니다.</p>
          <button onClick={() => navigate('/app/category')} className="text-gold mt-3 text-[13px]">
            다른 카테고리 보기 →
          </button>
        </div>
      ) : (
        <>
          <div className="px-4 pt-3 grid grid-cols-2 gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => navigate(`/app/product/${product.id}`)}
                className="text-left focus:outline-none focus:shadow-focus rounded-md"
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
                className="w-full py-3 border border-cream-2 rounded-md text-[14px] text-text-sub hover:border-gold hover:text-gold disabled:opacity-50 transition-colors"
              >
                {loading ? '불러오는 중…' : '더보기'}
              </button>
            </div>
          )}
        </>
      )}

      <BottomNav />
    </div>
  )
}
