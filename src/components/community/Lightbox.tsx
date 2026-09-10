import { useEffect, useRef, useState } from 'react'

// 사진 크게 보기 — 카드 사진을 누르면 화면 가득. (2026-09-11)
// 좌우로 밀거나(모바일) 화살표·키보드로 넘기고, 바깥을 누르거나 ESC 로 닫는다.
// 강아지 얼굴처럼 디테일이 있는 사진은 원본을 보고 싶어진다 — 그 자리를 만든다.

interface Props {
  images: string[]
  index: number
  onClose: () => void
}

export default function Lightbox({ images, index, onClose }: Props) {
  const [cur, setCur] = useState(index)
  const touchX = useRef<number | null>(null)
  const n = images.length

  const prev = () => setCur((c) => (c - 1 + n) % n)
  const next = () => setCur((c) => (c + 1) % n)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && n > 1) prev()
      else if (e.key === 'ArrowRight' && n > 1) next()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden' // 뒤 화면이 같이 스크롤되지 않게
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center select-none"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current == null || n < 2) return
        const dx = e.changedTouches[0].clientX - touchX.current
        touchX.current = null
        if (dx > 40) prev(); else if (dx < -40) next()
      }}
    >
      <img
        src={images[cur]}
        alt=""
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white text-[20px] leading-none focus:outline-none focus-visible:shadow-ring"
      >
        ×
      </button>

      {n > 1 && (
        <>
          <span className="absolute top-5 left-1/2 -translate-x-1/2 text-white/80 text-[13px] tabular-nums">{cur + 1} / {n}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); prev() }} aria-label="이전 사진"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white text-[20px] leading-none focus:outline-none focus-visible:shadow-ring">‹</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); next() }} aria-label="다음 사진"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white text-[20px] leading-none focus:outline-none focus-visible:shadow-ring">›</button>
        </>
      )}
    </div>
  )
}
