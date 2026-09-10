import { useEffect, useRef } from 'react'
import DesktopHeader from '../layout/DesktopHeader'
import DesktopFooter from '../layout/DesktopFooter'
import PromoBar from './PromoBar'
import TrustStrip from './TrustStrip'
import CategoryRecommend from './CategoryRecommend'
import ImagePlaceholder from '../common/ImagePlaceholder'
import Thumb from '../common/Thumb'
import type { HeroBanner } from '../../hooks/useHeroBanners'
import type { ShopProduct } from '../../hooks/useShopProducts'
import { timeSlotByHour } from '../../lib/season'

const won = (n: number) => n.toLocaleString('ko-KR')

interface Props {
  banners: HeroBanner[]
  categories: string[]
  recommended: ShopProduct[]
  seasonLabel: string | null
  products: ShopProduct[]
  prodLoading: boolean
  saleProducts: ShopProduct[]
  saleLoading: boolean
  onProductClick: (id: string) => void
}

// PC 버전 — 「생방송 슬레이트」 기존 규칙 그대로(흰 배경+신호색 3개, 직각, 그림자 없음, tabular 숫자).
// 히어로는 대형몰(참고: 토니모리) 배너의 "가로로 여러 장 이어붙여 옆장이 살짝 보이는" 배치·크기만
// 가져오되(실측 690:592 비율, 타일 간격 10px), 이미지·색·문구는 전부 우리 배너(hero_banners)
// 그대로 사용한다 — 대표 브랜드 상품이 자연스럽게 롤링되는 효과(2026-08-05).
export default function DesktopHome({
  banners,
  categories,
  recommended,
  seasonLabel,
  products,
  prodLoading,
  saleProducts,
  saleLoading,
  onProductClick,
}: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const sideList = (recommended.length > 0 ? recommended : products).slice(0, 4)
  const gridProducts = products.length > 0 ? products : recommended

  const scrollRail = (dir: 1 | -1) => {
    const el = railRef.current
    if (!el) return
    const tile = el.firstElementChild as HTMLElement | null
    const step = tile ? tile.getBoundingClientRect().width + 10 : el.clientWidth * 0.4
    const atEnd = dir === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    if (atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: dir * step, behavior: 'smooth' })
    }
  }

  // 2초마다 자동으로 다음 배너로 — 마우스를 올리면 잠깐 멈춘다(읽거나 클릭하려는 중 방해 안 하려고).
  useEffect(() => {
    if (banners.length <= 1) return
    const timer = setInterval(() => {
      if (!pausedRef.current) scrollRail(1)
    }, 2000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banners.length])

  return (
    <div className="bg-paper min-h-screen">
      <PromoBar />
      <DesktopHeader promoBarAbove />

      {/* 히어로 배너 롤링 — 690:592 비율 타일 3칸을 10px 간격으로 이어붙인다(가로 스크롤+snap,
          좌우 화살표로도 이동 가능). 이 구획만 본문(1280px)보다 넓게(1600px) 잡아 큰 화면에서
          좌우 여백이 지나치게 남지 않게 한다(실측: 1920px 화면 기준 여백 344px→160px로 축소). */}
      <section className="max-w-[1280px] mx-auto px-6 pt-8 pb-16 relative">
        {banners.length === 0 ? (
          <div className="aspect-[690/592] max-w-[500px] bg-quiet flex items-center justify-center mx-auto">
            <ImagePlaceholder />
          </div>
        ) : (
          <div
            className="relative"
            onMouseEnter={() => { pausedRef.current = true }}
            onMouseLeave={() => { pausedRef.current = false }}
          >
            <div
              ref={railRef}
              className="flex gap-2.5 overflow-x-auto scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {banners.map((b) => {
                const image = b.custom?.image_url ?? b.product?.thumbnail_url ?? null
                const title = b.custom?.headline ?? b.product?.name ?? '뷰티그라운드'
                const sub = b.custom?.subcopy ?? null
                return (
                  <a
                    key={b.id}
                    href={b.custom?.link_url ?? (b.product ? `/app/product/${b.product.id}` : undefined)}
                    onClick={(e) => {
                      if (b.product && !b.custom?.link_url) {
                        e.preventDefault()
                        onProductClick(b.product.id)
                      }
                    }}
                    className="relative shrink-0 w-[calc((100%-20px)/3)] min-w-[280px] aspect-[690/592] bg-quiet overflow-hidden"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    {image ? (
                      <Thumb src={image} alt="" size={600} loading="eager" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 45%)' }}
                      aria-hidden="true"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <p className="text-paper text-[19px] font-bold leading-snug whitespace-pre-line">{title}</p>
                      {sub && <p className="mt-1.5 text-paper/80 text-[13px]">{sub}</p>}
                    </div>
                  </a>
                )
              })}
            </div>

            {banners.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollRail(-1)}
                  aria-label="이전 배너"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-paper text-[30px] leading-none hover:opacity-70 transition-opacity focus:outline-none focus-visible:shadow-ring"
                  style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.55))' }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => scrollRail(1)}
                  aria-label="다음 배너"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-paper text-[30px] leading-none hover:opacity-70 transition-opacity focus:outline-none focus-visible:shadow-ring"
                  style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.55))' }}
                >
                  ›
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <TrustStrip />

      {/* 특가세일 — 지어낸 기획전 대신 실제 sale_price 걸린 상품을 할인율 높은 순으로 */}
      {!saleLoading && saleProducts.length > 0 && (
        <section className="max-w-[1280px] mx-auto px-6 py-16">
          <h2 className="text-[13px] font-bold tracking-[0.08em] text-ink-faint mb-6">특가세일</h2>
          <div className="grid grid-cols-4 gap-x-6 gap-y-8 border-t border-rule">
            {saleProducts.slice(0, 4).map((p) => {
              const rate = Math.round((1 - (p.sale_price ?? p.price) / p.price) * 100)
              return (
                <button
                  key={p.id}
                  onClick={() => onProductClick(p.id)}
                  className="flex flex-col items-start gap-2 pt-4 text-left focus:outline-none focus-visible:shadow-ring"
                >
                  <div className="w-full aspect-square bg-quiet overflow-hidden">
                    {p.thumbnail_url ? (
                      <Thumb src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    {p.brand_name && <p className="text-[12px] text-ink-soft">{p.brand_name}</p>}
                    <p className="mt-0.5 text-[13px] text-ink line-clamp-2 leading-snug min-h-[2.4em]">{p.name}</p>
                    <p className="mt-1 text-[13px] font-bold tabular-nums text-ink">
                      <span className="text-signal-red mr-1">{rate}%</span>
                      {won(p.sale_price ?? p.price)}원
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* 지금 확인할 상품 (계절/명절 태그 우선 추천) */}
      <section className="max-w-[1280px] mx-auto px-6 py-16">
        <p className="text-[12px] font-bold tracking-[0.08em] text-ink-faint mb-4">
          {seasonLabel ? `지금 확인할 상품 · ${seasonLabel} ${timeSlotByHour(new Date().getHours())} 시즌` : '지금 확인할 상품'}
        </p>
        {prodLoading ? (
          <div className="grid grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-square bg-quiet animate-pulse" />
            ))}
          </div>
        ) : sideList.length === 0 ? (
          <p className="text-[13px] text-ink-faint">등록된 상품이 없습니다</p>
        ) : (
          <div className="grid grid-cols-4 gap-x-6 gap-y-8 border-t border-rule">
            {sideList.map((p) => {
              const sell = p.sale_price ?? p.price
              const hasDiscount = p.sale_price != null && p.sale_price < p.price
              return (
                <button
                  key={p.id}
                  onClick={() => onProductClick(p.id)}
                  className="flex flex-col items-start gap-2 pt-4 text-left focus:outline-none focus-visible:shadow-ring"
                >
                  <div className="w-full aspect-square bg-quiet overflow-hidden">
                    {p.thumbnail_url ? (
                      <Thumb src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-[13px] text-ink line-clamp-2 leading-snug min-h-[2.4em]">{p.name}</p>
                    {p.reviewCount > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-soft">
                        <span className="text-signal-yellow" aria-hidden="true">★</span>
                        <span className="tabular-nums">{p.reviewAvg?.toFixed(1) ?? '-'}</span>
                        <span className="text-ink-faint">({p.reviewCount.toLocaleString('ko-KR')})</span>
                      </p>
                    )}
                    <p className="mt-0.5 text-[13px] font-bold tabular-nums text-ink">
                      {hasDiscount && <span className="text-signal-red mr-1">할인</span>}
                      {won(sell)}원
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* 카테고리별 추천 — 탭으로 카테고리를 고르면 그 카테고리의 추천 상품을 바로 보여준다 */}
      <CategoryRecommend categories={categories} onProductClick={onProductClick} />

      {/* 상품 그리드 */}
      <section className="max-w-[1280px] mx-auto px-6 pt-6 pb-16">
        <h2 className="text-[13px] font-bold tracking-[0.08em] text-ink-faint mb-6">신상품</h2>
        {prodLoading ? (
          <div className="grid grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-quiet animate-pulse" />
            ))}
          </div>
        ) : gridProducts.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-ink-faint">등록된 상품이 없습니다</p>
        ) : (
          <div className="grid grid-cols-4 gap-x-6 gap-y-8">
            {gridProducts.map((p) => {
              const sell = p.sale_price ?? p.price
              const hasDiscount = p.sale_price != null && p.sale_price < p.price
              return (
                <button key={p.id} onClick={() => onProductClick(p.id)} className="text-left border-b border-rule pb-4">
                  <div className="aspect-square bg-quiet overflow-hidden">
                    {p.thumbnail_url ? (
                      <Thumb src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                  </div>
                  {p.brand_name && <p className="mt-3 text-[12px] text-ink-soft">{p.brand_name}</p>}
                  <p className="mt-0.5 text-[13.5px] text-ink line-clamp-2 leading-snug min-h-[2.5em]">{p.name}</p>
                  {p.reviewCount > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-soft">
                      <span className="text-signal-yellow" aria-hidden="true">★</span>
                      <span className="tabular-nums">{p.reviewAvg?.toFixed(1) ?? '-'}</span>
                      <span className="text-ink-faint">({p.reviewCount.toLocaleString('ko-KR')})</span>
                    </p>
                  )}
                  <p className="mt-1 text-[14px] font-bold tabular-nums text-ink">
                    {hasDiscount && <span className="text-signal-red mr-1">할인</span>}
                    {won(sell)}원
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <DesktopFooter />
    </div>
  )
}
