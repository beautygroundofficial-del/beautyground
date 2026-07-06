import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import ShopProductCard, { ShopProductCardSkeleton } from '../components/product/ShopProductCard'
import { useShopProducts } from '../hooks/useShopProducts'
import { useShopCategories } from '../hooks/useShopCategories'
import { useShopLives } from '../hooks/useShopLives'

export default function AppHome() {
  const navigate = useNavigate()
  const { products, loading: prodLoading } = useShopProducts({ sort: 'latest', pageSize: 10 })
  const { categories } = useShopCategories()
  const { lives } = useShopLives()

  return (
    <div className="min-h-screen bg-cream-4 pb-24">
      {/* 1) 상단 바 */}
      <AppHeader />

      {/* 2) 라이브 — 진행중/예정이 있을 때만 */}
      {lives.length > 0 && (
        <section className="pt-4" aria-labelledby="home-live">
          <div className="flex items-center justify-between px-4 mb-2.5">
            <h2 id="home-live" className="text-base font-bold text-text">
              지금 라이브
            </h2>
            <Link to="/app/live" className="text-xs text-text-sub">
              전체보기 ›
            </Link>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
            {lives.map((live) => (
              <Link
                key={live.id}
                to={`/app/live/${live.id}`}
                className="flex-shrink-0 w-[150px]"
              >
                <div className="relative aspect-square rounded-lg overflow-hidden bg-cream-3">
                  {live.thumbnail_url ? (
                    <img
                      src={live.thumbnail_url}
                      alt={live.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget
                        img.style.display = 'none'
                        img.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                  ) : null}
                  <div
                    className={`w-full h-full flex items-center justify-center text-4xl ${live.thumbnail_url ? 'hidden' : ''}`}
                    aria-hidden="true"
                  >
                    💄
                  </div>
                  <span className="absolute top-2 left-2">
                    {live.status === 'live' ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-[#FF4757] text-white text-[11px] font-bold px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" aria-hidden="true" />
                        LIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-pill bg-black/50 text-white text-[11px] font-medium px-2 py-0.5">
                        예정
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-sm text-text mt-1.5 truncate">{live.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3) 카테고리 탭 — 전체 + 상품 있는 카테고리 */}
      <section className="pt-5" aria-labelledby="home-category">
        <h2 id="home-category" className="sr-only">
          카테고리
        </h2>
        <div className="flex gap-2 px-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => navigate('/app/category/all')}
            className="flex-shrink-0 min-h-11 px-4 rounded-pill text-sm font-medium bg-gold text-white"
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => navigate(`/app/category/all?cat=${encodeURIComponent(cat)}`)}
              className="flex-shrink-0 min-h-11 px-4 rounded-pill text-sm font-medium bg-cream-3 text-text-sub"
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* 4) 상품 그리드 — 2열 고정 */}
      <section className="px-4 pt-5" aria-labelledby="home-products">
        <h2 id="home-products" className="text-base font-bold text-text mb-3">
          신상품
        </h2>
        {prodLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ShopProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center py-10 text-text-hint text-sm">준비 중입니다</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => navigate(`/app/product/${product.id}`)}
                className="text-left focus:outline-none focus:shadow-focus rounded-lg"
                aria-label={product.name}
              >
                <ShopProductCard product={product} />
              </button>
            ))}
          </div>
        )}
      </section>

      <BottomNav />
    </div>
  )
}
