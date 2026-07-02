import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import LiveRollingBanner from '../components/home/LiveRollingBanner'
import CategoryChip from '../components/home/CategoryChip'
import LiveCard from '../components/home/LiveCard'
import DeptCard from '../components/home/DeptCard'
import ShopProductCard, { ShopProductCardSkeleton } from '../components/product/ShopProductCard'
import { useShopProducts } from '../hooks/useShopProducts'
import {
  LIVE_SLIDES,
  CATEGORIES,
  LIVE_CARDS,
  DEPT_CARDS,
  AGE_SEGMENTS,
} from '../constants'

export default function AppHome() {
  const navigate = useNavigate()
  const { products: newProducts, loading: prodLoading } = useShopProducts({ sort: 'latest', pageSize: 8 })

  return (
    <div className="min-h-screen bg-cream-4 pb-20">
      {/* 상태바 */}
      <div
        className="flex items-center justify-between px-4 py-1 text-white text-[12px]"
        style={{ backgroundColor: '#111' }}
        aria-hidden="true"
      >
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <span>WiFi</span>
          <span>🔋</span>
        </div>
      </div>

      {/* 앱 헤더 */}
      <AppHeader />

      {/* 라이브 롤링 배너 */}
      <LiveRollingBanner slides={LIVE_SLIDES} />

      {/* 검색바 */}
      <div className="px-4 py-3 bg-white border-b border-cream-2">
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-hint"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            placeholder="브랜드, 상품명으로 검색"
            className="w-full bg-cream-4 rounded-pill pl-9 pr-4 py-2.5 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus"
            aria-label="상품 검색"
          />
        </div>
      </div>

      {/* 카테고리 */}
      <section className="bg-white px-4 py-4" aria-labelledby="category-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="category-heading" className="text-[15px] font-bold text-text">
            카테고리
          </h2>
          <button
            onClick={() => navigate('/app/category')}
            className="text-[12px] text-text-sub hover:text-gold transition-colors"
          >
            전체보기 &gt;
          </button>
        </div>
        <div className="flex items-start justify-between">
          {CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.id}
              {...cat}
              onClick={(id) => navigate(`/app/category/${id}`)}
            />
          ))}
        </div>
      </section>

      {/* 지금 LIVE 중 */}
      <section className="bg-white mt-2 px-4 py-4" aria-labelledby="live-heading">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 id="live-heading" className="text-[15px] font-bold text-text">
              지금 LIVE 중
            </h2>
            <span className="w-2 h-2 bg-[#FF4757] rounded-full animate-pulse" aria-hidden="true" />
            <span className="text-[12px] text-text-sub">3개 진행중</span>
          </div>
          <button
            onClick={() => navigate('/app/live')}
            className="text-[12px] text-text-sub hover:text-gold transition-colors"
          >
            전체보기 &gt;
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {LIVE_CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => navigate(`/app/live/${card.id}`)}
              className="text-left w-full focus:outline-none focus:shadow-focus rounded-md"
              aria-label={`${card.brand} 라이브 방송 상세 보기`}
            >
              <LiveCard {...card} />
            </button>
          ))}
        </div>
      </section>

      {/* 백화점 3사관 */}
      <section className="bg-white mt-2 px-4 py-4" aria-labelledby="dept-heading">
        <h2 id="dept-heading" className="text-[15px] font-bold text-text mb-3">
          백화점 3사관
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {DEPT_CARDS.filter((d) => !d.isVip).map(({ key, ...deptProps }) => (
            <DeptCard key={key} {...deptProps} />
          ))}
        </div>
        {DEPT_CARDS.filter((d) => d.isVip).map(({ key, ...deptProps }) => (
          <div key={key} className="mt-2">
            <DeptCard {...deptProps} className="min-h-[80px]" />
          </div>
        ))}
      </section>

      {/* 연령별 추천 */}
      <section className="bg-white mt-2 px-4 py-4" aria-labelledby="age-heading">
        <h2 id="age-heading" className="text-[15px] font-bold text-text mb-3">
          연령별 추천
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {AGE_SEGMENTS.map((seg) => (
            <button
              key={seg.group}
              onClick={() => navigate('/app/category')}
              className="rounded-md p-3 text-left transition-opacity hover:opacity-90 focus:outline-none focus:shadow-focus"
              style={{ backgroundColor: seg.bgColor }}
              aria-label={`${seg.label} 추천 상품 보기`}
            >
              <p className="text-[14px] font-bold mb-1.5" style={{ color: seg.textColor }}>
                {seg.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {seg.keywords.map((kw) => (
                  <span key={kw} className="text-[10px]" style={{ color: seg.accentColor }}>
                    #{kw}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* 신상품 (실제 등록 상품) */}
      <section className="bg-white mt-2 px-4 py-4" aria-labelledby="new-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="new-heading" className="text-[15px] font-bold text-text">
            신상품
          </h2>
          <button
            onClick={() => navigate('/app/category')}
            className="text-[12px] text-text-sub hover:text-gold transition-colors"
          >
            더보기 &gt;
          </button>
        </div>
        {prodLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <ShopProductCardSkeleton key={i} />
            ))}
          </div>
        ) : newProducts.length === 0 ? (
          <p className="text-center py-8 text-text-hint text-[13px]">준비 중입니다</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {newProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => navigate(`/app/product/${product.id}`)}
                className="text-left focus:outline-none focus:shadow-focus rounded-md"
                aria-label={`${product.brand_name ?? ''} ${product.name} 상세 보기`}
              >
                <ShopProductCard product={product} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 하단 탭바 */}
      <BottomNav />
    </div>
  )
}
