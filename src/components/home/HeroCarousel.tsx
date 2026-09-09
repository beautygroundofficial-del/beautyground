import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HeroBanner } from '../../hooks/useHeroBanners'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import ImagePlaceholder from '../common/ImagePlaceholder'
import Thumb from '../common/Thumb'

// 홈 히어로 배너: 관리자가 고른 상품을 화이트 카드로 노출(흰 배경+검정 텍스트+검정 CTA 알약).
// 2026-08-08 대표님 확정 레퍼런스(쇼핑몰예시.jpg) 픽셀 실측으로 그린 그라데이션 카드를 만들었다가,
// 같은 날 대표님 지시로 그린을 걷어내고 사이트 나머지와 같은 화이트+블랙 톤으로 되돌림.
// 레퍼런스가 다음 카드를 살짝 걸쳐 보여주는 이유는 "옆으로 밀 수 있다"는 걸 손으로 말하기 위함이라
// 카드 폭을 100%가 아닌 86%로 두고(다음 카드가 우측에 자연히 피크), 네이티브 스크롤 스냅으로
// 실제 손가락 드래그가 되게 한다.
export default function HeroCarousel({ banners, loading }: { banners: HeroBanner[]; loading?: boolean }) {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Array<HTMLElement | null>>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const count = banners.length

  // 모션 최소화를 선택한 사용자에게는 자동 넘김도 슬라이드 애니메이션도 걸지 않는다.
  const reduceMotion = useReducedMotion()

  const scrollToIndex = useCallback(
    (index: number) => {
      // ⚠️ scrollIntoView 금지 — 배너가 시야 밖(사용자가 아래로 스크롤한 상태)일 때 페이지
      // 전체를 배너 위치로 끌어올려 "보다가 자꾸 맨 위로 튐" 사고를 냄(2026-08-13 대표님 리포트).
      // 캐러셀 컨테이너의 가로 스크롤만 직접 움직인다 — 세로 스크롤은 절대 건드리지 않음.
      const scroller = scrollerRef.current
      const item = itemRefs.current[index]
      const first = itemRefs.current[0]
      if (!scroller || !item || !first) return
      scroller.scrollTo({
        left: item.offsetLeft - first.offsetLeft,
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    },
    [reduceMotion],
  )

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (count <= 1 || reduceMotion) return
    // 5초에 한 번 좌측(다음 카드)으로 자동 이동 — 매장 직원 피드백 "전환이 너무 빠름"(2026-08-13, 3초→5초)
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => {
        const next = (prev + 1) % count
        scrollToIndex(next)
        return next
      })
    }, 5000)
  }, [count, reduceMotion, scrollToIndex])

  useEffect(() => {
    resetInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [resetInterval])

  const goTo = (index: number) => {
    const next = (index + count) % count
    setCurrent(next)
    scrollToIndex(next)
    resetInterval()
  }

  // 사용자가 손가락으로 직접 밀었을 때(네이티브 스크롤) — 스크롤이 멎으면 가장 가까운 카드로 current를 맞추고,
  // 자동 넘김 타이머를 그 지점부터 다시 2초로 재시작한다(드래그 중 자동 넘김이 손 밑에서 카드를 뺏어가지 않도록
  // onPointerDown에서 먼저 멈춰둔다 — 2026-08-08 대표님 지시로 스와이프 도입하며 발견한 충돌 방지).
  const handleScroll = () => {
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current)
    scrollDebounceRef.current = setTimeout(() => {
      const el = scrollerRef.current
      if (!el) return
      let closest = 0
      let closestDist = Infinity
      itemRefs.current.forEach((item, i) => {
        if (!item) return
        const dist = Math.abs(item.offsetLeft - el.scrollLeft)
        if (dist < closestDist) {
          closestDist = dist
          closest = i
        }
      })
      setCurrent(closest)
      resetInterval()
    }, 120)
  }

  const pauseAutoplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  // 배너를 아직 불러오는 중일 때는(count===0이 "진짜로 없음"인지 "로딩 중"인지 구분 안 되면)
  // 아래 마케팅 카피 대신 중립적인 스켈레톤을 보여준다 — 신상품/추천상품 레일과 같은 이유로,
  // 새로고침 직후 잠깐 이 카피만 보이는 현상이 PG 심사관 눈엔 콘텐츠 미비로 비칠 수 있어 수정.
  if (loading) {
    return (
      <section className="px-4 pt-4 pb-1">
        <div className="aspect-[4/3] bg-quiet animate-pulse rounded-control" />
      </section>
    )
  }

  if (count === 0) {
    return (
      <section className="border-b border-rule bg-paper px-4 py-12">
        <h2 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-ink text-balance">
          백화점에서 직접 고른 뷰티,
          <br />
          방송으로 만나보세요
        </h2>
        <p className="mt-3 text-[14px] text-ink-soft">
          AK플라자 광명점·수원역점에서 운영 중인 편집샵입니다.
        </p>
      </section>
    )
  }

  return (
    <section className="relative select-none pt-4 pb-1" aria-roledescription="carousel" aria-label="추천 배너">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onPointerDown={pauseAutoplay}
        onTouchStart={pauseAutoplay}
        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory scroll-smooth px-4"
      >
        {banners.map((banner, i) => {
          const product = banner.product
          const custom = banner.custom

          if (product) {
            const hasSale = product.sale_price != null && product.sale_price < product.price
            const rate = hasSale ? Math.round((1 - product.sale_price! / product.price) * 100) : 0
            // 큐레이션 문구: 할인 중이면 퍼센트, 최근 45일 내 등록이면 NEW, 그 외 BUY NOW만
            const isNew =
              product.created_at != null &&
              Date.now() - new Date(product.created_at).getTime() < 1000 * 60 * 60 * 24 * 45
            const ctaLabel = hasSale ? `${rate}% OFF | BUY NOW` : isNew ? 'NEW | BUY NOW' : 'BUY NOW'
            return (
              <button
                key={banner.id}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                onClick={() => navigate(`/app/product/${product.id}`)}
                className="relative min-h-[176px] w-[86%] flex-shrink-0 snap-start overflow-hidden rounded-card border border-rule bg-paper p-4 text-left shadow-card focus:outline-none focus-visible:shadow-ring"
                aria-label={product.name}
              >
                <div className="relative z-10 max-w-[62%]">
                  {product.brand ? (
                    <span className="text-[12px] font-bold text-ink-soft">{product.brand}</span>
                  ) : null}
                  <h2 className="mt-1.5 text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink line-clamp-2">
                    {custom?.headline || product.name}
                  </h2>
                  {custom?.subcopy && <p className="mt-2 text-[12px] leading-relaxed text-ink-soft line-clamp-2">{custom.subcopy}</p>}
                  <span className="mt-4 inline-block rounded-pill bg-ink px-3.5 py-2 text-[11px] font-bold text-paper">
                    {ctaLabel}
                  </span>
                </div>
                {/* 상품 이미지 — 카드 우하단에 걸쳐서, 브랜드 원본 비율 유지.
                    카드가 화이트로 바뀐 뒤에도, 사진마다 스튜디오 배경 톤(회색 등)이 제각각이라
                    우하단(카드 모서리에 실제로 걸치는 쪽)은 그대로 두고 상단·좌측 가장자리만 마스크로 자연스럽게 페이드아웃. */}
                <div className="pointer-events-none absolute bottom-0 right-0 h-[85%] w-[44%]">
                  {product.thumbnail_url ? (
                    <Thumb
                      src={product.thumbnail_url}
                      alt=""
                      size={600}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      className="h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.18)]"
                      style={{
                        WebkitMaskImage:
                          'radial-gradient(130% 130% at 100% 100%, #000 48%, transparent 88%)',
                        maskImage: 'radial-gradient(130% 130% at 100% 100%, #000 48%, transparent 88%)',
                      }}
                    />
                  ) : (
                    <ImagePlaceholder className="h-full w-full" />
                  )}
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
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                onClick={handleClick}
                disabled={!custom.link_url}
                className="w-[86%] flex-shrink-0 snap-start overflow-hidden rounded-card text-left disabled:cursor-default focus:outline-none focus-visible:shadow-ring"
                aria-label={custom.headline ?? '배너'}
              >
                <div className="aspect-square bg-quiet">
                  {custom.image_url ? (
                    <Thumb
                      src={custom.image_url}
                      alt={custom.headline ?? ''}
                      size={600}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                {(custom.headline || custom.subcopy) && (
                  <div className="bg-paper px-4 py-4">
                    {custom.headline && (
                      <h2 className="text-[17px] font-bold leading-snug tracking-[-0.02em] text-ink line-clamp-2">
                        {custom.headline}
                      </h2>
                    )}
                    {custom.subcopy && <p className="mt-1.5 text-[14px] text-ink-soft">{custom.subcopy}</p>}
                  </div>
                )}
              </button>
            )
          }

          return (
            <div
              key={banner.id}
              ref={(el) => {
                itemRefs.current[i] = el
              }}
              className="aspect-square w-[86%] flex-shrink-0 snap-start rounded-card bg-quiet"
            />
          )
        })}
      </div>

      {count > 1 && (
        <>
          {/* 좌우 화살표 버튼은 카드 텍스트(좌측 정렬)와 겹쳐 가리는 문제가 있었고(2026-08-08 대표님 지적),
              레퍼런스(쇼핑몰예시.jpg)에도 화살표 없이 점만 있다 — 이미 손가락 스와이프가 되므로 제거. */}
          {/* 진행 표시 */}
          <div className="flex justify-center gap-1.5 py-3">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => goTo(i)}
                aria-label={`${i + 1}번째 배너로 이동`}
                aria-current={current === i ? 'true' : undefined}
                className={`h-[6px] rounded-pill transition-all duration-300 focus:outline-none focus-visible:shadow-ring ${
                  current === i ? 'w-6 bg-ink' : 'w-[6px] bg-rule'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
