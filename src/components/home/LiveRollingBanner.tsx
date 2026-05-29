import { useState, useEffect, useRef, useCallback } from 'react'
import type { LiveSlide } from '../../types'
import Badge from '../common/Badge'

interface LiveRollingBannerProps {
  slides: LiveSlide[]
}

export default function LiveRollingBanner({ slides }: LiveRollingBannerProps) {
  const [current, setCurrent] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const touchStartX = useRef(0)
  const mouseStartX = useRef(0)
  const isDragging = useRef(false)

  const goTo = useCallback((index: number) => {
    setCurrent((index + slides.length) % slides.length)
  }, [slides.length])

  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 3200)
  }, [slides.length])

  useEffect(() => {
    resetInterval()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [resetInterval])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const delta = touchStartX.current - (e.changedTouches[0]?.clientX ?? 0)
    if (Math.abs(delta) > 30) {
      goTo(delta > 0 ? current + 1 : current - 1)
      resetInterval()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    mouseStartX.current = e.clientX
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    const delta = mouseStartX.current - e.clientX
    if (Math.abs(delta) > 30) {
      goTo(delta > 0 ? current + 1 : current - 1)
      resetInterval()
    }
  }

  const handleDotClick = (index: number) => {
    goTo(index)
    resetInterval()
  }

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ height: 200 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <div
        className="flex h-full"
        style={{
          transform: `translateX(-${current * 100}%)`,
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          width: `${slides.length * 100}%`,
        }}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="relative flex-shrink-0 h-full"
            style={{ width: `${100 / slides.length}%`, backgroundColor: slide.bgColor }}
          >
            {/* 그라디언트 오버레이 */}
            <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)',
              }}
            />

            {/* 상단: BA 정보 */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                  style={{ backgroundColor: slide.avatarColor }}
                  aria-hidden="true"
                >
                  {slide.avatarInitial}
                </div>
                <div>
                  <p className="text-white text-[12px] font-medium leading-tight">{slide.hostName}</p>
                  <p className="text-white/70 text-[11px] leading-tight">{slide.deptName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-black/30 rounded-pill px-2 py-1">
                  <span className="text-white/80 text-[10px]" aria-hidden="true">👁</span>
                  <span className="text-white text-[11px]">
                    {slide.viewers.toLocaleString()}
                  </span>
                </div>
                <Badge type="live" label="LIVE" />
                <button
                  className="text-[11px] font-semibold text-gold border border-gold rounded-pill px-2.5 py-0.5 hover:bg-gold/20 transition-colors"
                  aria-label={`${slide.hostName} 팔로우`}
                >
                  Follow
                </button>
              </div>
            </div>

            {/* 하단: 상품 카드 */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4">
              <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-md px-3 py-2.5 border border-white/15">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-sm flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: `${slide.avatarColor}33` }}
                    aria-hidden="true"
                  >
                    💄
                  </div>
                  <div>
                    <p className="text-white/90 text-[12px] leading-tight">{slide.productName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gold text-[13px] font-bold">
                        {slide.price.toLocaleString('ko-KR')}원
                      </span>
                      {slide.originalPrice && (
                        <span className="text-white/40 text-[11px] line-through">
                          {slide.originalPrice.toLocaleString('ko-KR')}원
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="bg-gold text-white text-[11px] font-semibold rounded-pill px-3 py-1.5 hover:bg-gold-light transition-colors flex-shrink-0">
                  구매하기
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 인디케이터 도트 */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => handleDotClick(index)}
            aria-label={`슬라이드 ${index + 1}로 이동`}
            className="rounded-full bg-white transition-all duration-300 flex-shrink-0"
            style={{
              width: current === index ? 14 : 5,
              height: current === index ? 5 : 5,
              borderRadius: current === index ? 3 : '50%',
              opacity: current === index ? 1 : 0.35,
            }}
          />
        ))}
      </div>
    </div>
  )
}
