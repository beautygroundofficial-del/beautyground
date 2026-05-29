import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import ProductCard from '../components/product/ProductCard'
import { CATEGORIES, ALL_PRODUCTS } from '../constants'

const SORT_OPTIONS = ['인기순', '가격 낮은순', '가격 높은순', '신상품순']

export default function AppCategoryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sort, setSort] = useState(0)
  const [showSort, setShowSort] = useState(false)

  const cat = CATEGORIES.find(c => c.id === id)

  const products = ALL_PRODUCTS.filter(p => {
    if (id === 'skincare') return ['설화수', '랑콤', '라메르', '키엘', '에스티로더', 'SK-II', '아모레퍼시픽', '비오템', '클라란스'].includes(p.brand)
    if (id === 'makeup') return ['샤넬 뷰티', '헤라', 'YSL', 'MAC', '나스', '바비브라운'].includes(p.brand)
    if (id === 'perfume') return false
    if (id === 'hair') return false
    if (id === 'body') return false
    return true
  })

  const sorted = [...products].sort((a, b) => {
    if (sort === 1) return a.price - b.price
    if (sort === 2) return b.price - a.price
    return b.id - a.id
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
      <div
        className="px-5 py-6 flex items-center gap-4"
        style={{ backgroundColor: cat.bg }}
      >
        <div
          className="w-14 h-14 rounded-[16px] flex items-center justify-center text-3xl"
          style={{ backgroundColor: cat.bg }}
          aria-hidden="true"
        >
          {cat.icon}
        </div>
        <div>
          <h2 className="text-[20px] font-bold" style={{ color: cat.color }}>{cat.label}</h2>
          <p className="text-[12px] mt-0.5" style={{ color: `${cat.color}99` }}>
            {sorted.length}개 상품
          </p>
        </div>
      </div>

      {/* 필터/정렬 바 */}
      <div className="bg-white border-b border-cream-2 px-4 py-2.5 flex items-center justify-between">
        <p className="text-[13px] text-text-sub">전체 {sorted.length}개</p>
        <div className="relative">
          <button
            onClick={() => setShowSort(!showSort)}
            className="flex items-center gap-1.5 text-[13px] text-text"
            aria-haspopup="listbox"
            aria-expanded={showSort}
          >
            <span>{SORT_OPTIONS[sort]}</span>
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
                  key={opt}
                  role="option"
                  aria-selected={sort === i}
                  onClick={() => { setSort(i); setShowSort(false) }}
                  className={`block w-full px-4 py-2.5 text-[13px] text-left hover:bg-cream-2 transition-colors ${sort === i ? 'text-gold font-semibold' : 'text-text'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-hint text-[14px]">상품이 준비 중입니다.</p>
          <button onClick={() => navigate('/app/category')} className="text-gold mt-3 text-[13px]">
            다른 카테고리 보기 →
          </button>
        </div>
      ) : (
        <div className="px-4 pt-3 grid grid-cols-2 gap-3">
          {sorted.map(product => (
            <button
              key={product.id}
              onClick={() => navigate(`/app/product/${product.id}`)}
              className="text-left focus:outline-none focus:shadow-focus rounded-md"
              aria-label={`${product.brand} ${product.name}`}
            >
              <ProductCard {...product} />
            </button>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
