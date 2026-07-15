import { Link } from 'react-router-dom'
import AppHeader from '../layout/AppHeader'
import TopNavMenu from './TopNavMenu'
import HeroCarousel from './HeroCarousel'
import MarqueeBar from './MarqueeBar'
import CategoryShortcutGrid from './CategoryShortcutGrid'
import ShopProductCard, { ShopProductCardSkeleton } from '../product/ShopProductCard'
import type { HeroBanner } from '../../hooks/useHeroBanners'
import type { ShopProduct } from '../../hooks/useShopProducts'
import type { CategoryThumbnail } from '../../hooks/useCategoryThumbnails'
import type { Live } from '../../lib/types'

interface HomeBodyProps {
  marqueeItems: string[]
  banners: HeroBanner[]
  lives: Live[]
  categories: string[]
  categoryThumbnails: CategoryThumbnail[]
  products: ShopProduct[]
  prodLoading: boolean
  onProductClick: (id: string) => void
  onCategoryClick: (category: string | null) => void
}

// 홈 화면 본문(마퀴~상품그리드) — 실제 /app/home과 관리자 미리보기가 공유하는 프레젠테이션 컴포넌트.
// 데이터는 항상 부모(AppHome 또는 관리자 화면)가 내려준다(직접 fetch 하지 않음).
export default function HomeBody({
  marqueeItems,
  banners,
  lives,
  categories,
  categoryThumbnails,
  products,
  prodLoading,
  onProductClick,
  onCategoryClick,
}: HomeBodyProps) {
  return (
    <>
      <MarqueeBar items={marqueeItems} />
      <AppHeader />
      <TopNavMenu />
      <HeroCarousel banners={banners} />
      <CategoryShortcutGrid categories={categories} thumbnails={categoryThumbnails} onSelect={onCategoryClick} />

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
              <Link key={live.id} to={`/app/live/${live.id}`} className="flex-shrink-0 w-[150px]">
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
                onClick={() => onProductClick(product.id)}
                className="text-left focus:outline-none focus:shadow-focus rounded-lg"
                aria-label={product.name}
              >
                <ShopProductCard product={product} />
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
