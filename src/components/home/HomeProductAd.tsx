import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getHomeAd, trackHomeAd, type HomeAd } from '../../lib/homeAd'
import { won } from '../../lib/format'

export default function HomeProductAd() {
  const [ad, setAd] = useState<HomeAd | null>(null)
  const [open, setOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const card = useRef<HTMLButtonElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let active = true
    void getHomeAd().then(value => { if (active) setAd(value) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!ad) return
    const remaining = new Date(ad.ends_at).getTime() - Date.now()
    const timeout = window.setTimeout(() => { setOpen(false); setAd(null) }, Math.min(Math.max(0, remaining), 2147483647))
    return () => clearTimeout(timeout)
  }, [ad])

  useEffect(() => {
    if (!ad || imageFailed || !card.current) return
    let visible = false
    let timer: number | undefined
    const stop = () => { clearTimeout(timer); timer = undefined }
    const check = () => {
      stop()
      if (visible && document.visibilityState === 'visible') timer = window.setTimeout(() => { void trackHomeAd(ad, 'impression') }, 1000)
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.intersectionRatio >= 0.5; check() }, { threshold: [0, 0.5] })
    observer.observe(card.current)
    document.addEventListener('visibilitychange', check)
    return () => { stop(); observer.disconnect(); document.removeEventListener('visibilitychange', check) }
  }, [ad, imageFailed])

  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = previousOverflow }
  }, [open])

  // Leave admin home previews free of consumer advertising and event collection.
  if (!location.pathname.startsWith('/app/') || !ad || imageFailed) return null
  const price = ad.sale_price ?? ad.price
  const openAd = () => {
    // An intentional click also proves the card was seen, even within one second.
    void trackHomeAd(ad, 'impression')
    void trackHomeAd(ad, 'popup_open')
    setOpen(true)
  }
  const goProduct = () => {
    void trackHomeAd(ad, 'product_click')
    setOpen(false)
    navigate(`/app/product/${ad.product_id}?home_ad=${encodeURIComponent(ad.campaign_id)}`)
  }

  return (
    <section className="mx-5 mt-4" aria-label="상품 광고">
      <button ref={card} type="button" onClick={openAd} className="flex w-full items-center gap-3 rounded-lg border border-rule bg-paper p-3 text-left focus-visible:shadow-ring" aria-haspopup="dialog">
        <img src={ad.thumbnail_url} alt="" className="h-16 w-16 shrink-0 rounded-md bg-quiet object-contain" onError={() => { setImageFailed(true); setOpen(false) }} />
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-2 text-[11px] text-ink-soft"><span className="rounded border border-rule px-1">광고</span>{ad.brand}</span>
          <span className="block text-[14px] font-semibold leading-snug text-ink line-clamp-2 break-words">{ad.product_name}</span>
          <span className="mt-1 flex flex-wrap items-center justify-between gap-x-2 text-[13px] text-ink"><strong>{won(price)}</strong><span>상품 소개 보기 →</span></span>
        </span>
      </button>
      <dialog ref={dialog} aria-labelledby="home-ad-title" onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false) }} className="m-auto max-h-[85dvh] w-[calc(100%_-_32px)] max-w-sm overflow-y-auto rounded-xl bg-paper p-0 text-ink shadow-xl backdrop:bg-black/50">
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between"><span className="text-[12px] text-ink-soft">광고 · {ad.brand || '쇼핑 상품'}</span><button type="button" autoFocus onClick={() => setOpen(false)} className="min-h-11 min-w-11 rounded-lg text-[14px] focus-visible:shadow-ring" aria-label="상품 광고 닫기">닫기 ✕</button></div>
          <img src={ad.thumbnail_url} alt={ad.product_name} className="mx-auto h-44 w-full rounded-lg bg-quiet object-contain" />
          <h2 id="home-ad-title" className="mt-4 text-[18px] font-bold leading-relaxed break-words">{ad.product_name}</h2>
          <div className="mt-3 flex flex-wrap items-baseline gap-2"><strong className="text-[22px]">{won(price)}</strong>{ad.sale_price != null && ad.sale_price < ad.price && <del className="text-[13px] text-ink-soft">{won(ad.price)}</del>}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">옵션과 배송 안내는 상품 상세에서 확인해 주세요.</p>
          <button type="button" onClick={goProduct} className="mt-5 min-h-12 w-full rounded-lg bg-ink px-4 py-3 text-[15px] font-semibold text-paper focus-visible:shadow-ring">상품 보러 가기</button>
        </div>
      </dialog>
    </section>
  )
}
