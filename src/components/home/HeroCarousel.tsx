import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HeroBanner } from '../../hooks/useHeroBanners'
import { won } from '../../lib/format'

// 홈 히어로 배너: 관리자가 고른 상품을 풀블리드 이미지 캐러셀로 노출.
// 배너가 없으면 임시 문구 배너로 대체(실제 프로모션 확정 전까지).
export default function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef(0)

  const count = banners.length

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (count <= 1) return
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % count)
    }, 4000)
  }, [count])

  useEffect(() => {
    resetInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [resetInterval])

  const goTo = (index: number) => {
    setCurrent((index + count) % count)
    resetInterval()
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - (e.changedTouches[0]?.clientX ?? 0)
    if (Math.abs(delta) > 30) goTo(delta > 0 ? current + 1 : current - 1)
  }

  if (count === 0) {
    return (
      <section className="relative aspect-[1/1.05] bg-cream-3 flex items-end overflow-hidden">
        <div className="p-5 pb-7">
          <p className="text-[11px] font-bold tracking-widest text-gold uppercase mb-2">
            WELCOME
          </p>
          <h2 className="text-[22px] font-extrabold leading-snug text-text text-balance">
            뷰티그라운드에 오신 것을
            <br />
            환영합니다
          </h2>
          <p className="text-[13px] text-text-sub mt-2">신상품 소식을 곧 전해드릴게요 · 준비 중</p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="relative aspect-[1/1.05] overflow-hidden bg-cream-3 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner) => {
          const product = banner.product
          const custom = banner.custom

          if (product) {
            const sell = product.sale_price ?? product.price
            const hasSale = product.sale_price != null && product.sale_price < product.price
            return (
              <button
                key={banner.id}
                onClick={() => navigate(`/app/product/${product.id}`)}
                className="relative w-full h-full flex-shrink-0 text-left"
                aria-label={product.name}
              >
                {product.thumbnail_url ? (
                  <img
                    src={product.thumbnail_url}
                    alt={product.name}
                    loading={current === 0 ? 'eager' : 'lazy'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl" aria-hidden="true">
                    💄
                  </div>
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(0deg, rgba(10,8,6,.72) 0%, rgba(10,8,6,.32) 38%, rgba(10,8,6,0) 62%)',
                  }}
                />
                <div className="absolute left-5 right-5 bottom-7 text-white">
                  <p className="text-[11px] font-bold tracking-widest text-gold-light uppercase mb-2">PICK</p>
                  <h2 className="text-[22px] font-extrabold leading-snug line-clamp-2">{product.name}</h2>
                  <p className="text-[13px] mt-2.5">
                    {hasSale && <span className="text-white/60 line-through mr-1.5">{won(product.price)}</span>}
                    <span className="text-[18px] font-extrabold">{won(sell)}</span>
                  </p>
                </div>
              </button>
            )
          }

          if (custom) {
            const handleClick = () => {
              const link = custom.link_url
              if (!link) return
              if (link.startsWith('/')) navigate(link)
              else window.location.href = link
            }
            return (
              <button
                key={banner.id}
                onClick={handleClick}
                disabled={!custom.link_url}
                className="relative w-full h-full flex-shrink-0 text-left disabled:cursor-default"
                aria-label={custom.headline ?? '배너'}
              >
                {custom.image_url ? (
                  <img
                    src={custom.image_url}
                    alt={custom.headline ?? ''}
                    loading={current === 0 ? 'eager' : 'lazy'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-cream-3" />
                )}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(0deg, rgba(10,8,6,.72) 0%, rgba(10,8,6,.32) 38%, rgba(10,8,6,0) 62%)',
                  }}
                />
                <div className="absolute left-5 right-5 bottom-7 text-white">
                  {custom.headline && (
                    <h2 className="text-[22px] font-extrabold leading-snug line-clamp-2">{custom.headline}</h2>
                  )}
                  {custom.subcopy && <p className="text-[13px] mt-2 text-white/85">{custom.subcopy}</p>}
                </div>
              </button>
            )
          }

          return <div key={banner.id} className="w-full h-full flex-shrink-0 bg-cream-3" />
        })}
      </div>

      {count > 1 && (
        <div className="absolute left-0 right-0 bottom-2.5 z-10 flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 배너로 이동`}
              className="rounded-full bg-white transition-all duration-300"
              style={{
                width: current === i ? 18 : 6,
                height: 6,
                opacity: current === i ? 1 : 0.4,
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}
