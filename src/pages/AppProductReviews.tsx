import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopProductReviews from '../components/review/DesktopProductReviews'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import type { Product, ScrapedReview } from '../lib/types'
import { IconClose, IconBack, IconChevronRight } from '../components/common/Icon'

// 리뷰의 사진 배열 (photos 우선, 없으면 photo 단수)
function reviewPhotos(r: ScrapedReview): string[] {
  return r.photos && r.photos.length > 0 ? r.photos : r.photo ? [r.photo] : []
}
function maskAuthor(name: string | null): string {
  const n = (name ?? '').trim()
  if (!n) return ''
  if (n.includes('*')) return n
  return [...n][0] + '****'
}
const metaLine = (r: ScrapedReview) => [maskAuthor(r.author), r.date].filter(Boolean).join(' · ')

function Stars({ value, className = '' }: { value: number; className?: string }) {
  const full = Math.round(value)
  return (
    <span className={`tracking-tight ${className}`} aria-hidden="true">
      <span className="text-ink">{'★'.repeat(full)}</span>
      <span className="text-rule">{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  )
}

export default function AppProductReviews() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { mode, isDesktop, toggle } = useViewMode()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [reviews, setReviews] = useState<ScrapedReview[]>([])
  const [count, setCount] = useState(0)
  const [avg, setAvg] = useState<number | null>(null)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('products')
        .select('name, scraped_reviews, review_summary')
        .eq('id', id)
        .single()
      if (!alive) return
      const p = data as Pick<Product, 'name' | 'scraped_reviews' | 'review_summary'> | null
      if (p) {
        setName(p.name)
        const rv = p.scraped_reviews ?? []
        setReviews(rv)
        setCount(p.review_summary?.count ?? rv.length)
        setAvg(p.review_summary?.avg ?? null)
      }
      setLoading(false)
    })()
    return () => { alive = false }
  }, [id])

  // 사진 있는 리뷰만 (PHOTO REVIEW 그리드용) — 원본 인덱스 유지
  const photoReviews = useMemo(
    () => reviews.map((r, i) => ({ i, pics: reviewPhotos(r) })).filter((x) => x.pics.length > 0),
    [reviews]
  )

  // ?i=index 또는 ?photo=url 이면 해당 리뷰 열기
  useEffect(() => {
    if (loading || reviews.length === 0) return
    const qi = params.get('i')
    const qp = params.get('photo')
    if (qi != null && /^\d+$/.test(qi)) {
      const n = Number(qi)
      if (n >= 0 && n < reviews.length) setOpenIdx(n)
    } else if (qp) {
      const n = reviews.findIndex((r) => reviewPhotos(r).some((u) => u === qp))
      if (n >= 0) setOpenIdx(n)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, reviews])

  // 모달 열림 시 배경 스크롤 잠금 + ESC 닫기
  useEffect(() => {
    if (openIdx == null) return
    setPhotoIdx(0)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenIdx(null) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [openIdx])

  const hideParent = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const p = e.currentTarget.parentElement as HTMLElement | null
    if (p) p.style.display = 'none'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        {isDesktop ? (
          <div className="max-w-[1280px] mx-auto px-6 py-24 flex items-center justify-center">
            <p className="text-ink-faint text-[14px]">불러오는 중...</p>
          </div>
        ) : (
          <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center">
            <p className="text-ink-faint text-[14px]">불러오는 중...</p>
          </div>
        )}
      </div>
    )
  }

  const cur = openIdx != null ? reviews[openIdx] : null
  const curPics = cur ? reviewPhotos(cur) : []

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopProductReviews
          id={id}
          name={name}
          avg={avg}
          count={count}
          reviews={reviews}
          photoReviews={photoReviews}
          openIdx={openIdx}
          setOpenIdx={setOpenIdx}
          photoIdx={photoIdx}
          setPhotoIdx={setPhotoIdx}
          hideParent={hideParent}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div
      className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule"
      style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      <BackHeader title="리뷰" onBack={() => navigate(`/app/product/${id}`)} />

      <div>
        {/* 상품명 (클릭 시 상품 페이지로) */}
        {name && (
          <button
            type="button"
            onClick={() => navigate(`/app/product/${id}`)}
            className="w-full text-left px-4 pt-4 text-[13px] text-ink-soft truncate focus:outline-none focus-visible:shadow-ring"
          >
            ‹ {name}
          </button>
        )}

        {/* 요약 */}
        <div className="px-4 py-5 flex items-center gap-4 border-b border-rule">
          <div className="text-center">
            <p className="text-[34px] font-bold tabular-nums text-ink leading-none">{avg != null ? avg.toFixed(1) : '-'}</p>
            <Stars value={avg ?? 0} className="text-[15px] mt-1.5" />
          </div>
          <div className="text-[13px] text-ink-soft">
            <p className="font-bold text-ink text-[15px]">리뷰 {count.toLocaleString('ko-KR')}개</p>
            <p className="mt-0.5 text-ink-faint">실제 구매 후기</p>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="px-4 py-16 text-center text-ink-faint text-[14px]">아직 리뷰가 없어요 — 이 상품의 첫 리뷰 주인공이 되어보세요</div>
        ) : (
          <>
            {/* PHOTO REVIEW 그리드 */}
            {photoReviews.length > 0 && (
              <section className="px-4 py-5 border-b border-rule">
                <h2 className="text-[13px] font-bold tracking-[0.08em] text-ink mb-3">
                  PHOTO REVIEW <span className="text-ink-faint font-bold">({photoReviews.length})</span>
                </h2>
                <div className="grid grid-cols-3 gap-1.5">
                  {photoReviews.map(({ i, pics }) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setOpenIdx(i)}
                      className="relative aspect-square overflow-hidden bg-quiet focus:outline-none focus-visible:shadow-ring"
                      aria-label={`포토 리뷰 ${i + 1} 보기`}
                    >
                      <img src={pics[0]} alt="" loading="lazy" className="w-full h-full object-cover" onError={hideParent} />
                      {pics.length > 1 && (
                        <span className="absolute top-1 right-1 bg-ink/70 text-paper text-[10px] font-bold px-1.5 py-0.5">
                          +{pics.length - 1}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* 전체 리뷰 카드 리스트 */}
            <section className="px-4 py-5">
              <h2 className="text-[13px] font-bold tracking-[0.08em] text-ink mb-3">전체 리뷰</h2>
              <ul className="divide-y divide-rule">
                {reviews.map((r, i) => {
                  const pics = reviewPhotos(r)
                  return (
                    <li key={i}>
                      <button type="button" onClick={() => setOpenIdx(i)} className="w-full text-left flex gap-3 py-4 focus:outline-none focus-visible:shadow-ring">
                        {pics.length > 0 && (
                          <div className="relative shrink-0">
                            <img src={pics[0]} alt="" loading="lazy" className="w-20 h-20 object-cover bg-quiet" onError={hideParent} />
                            {pics.length > 1 && <span className="absolute top-1 right-1 bg-ink/70 text-paper text-[9px] px-1">+{pics.length - 1}</span>}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Stars value={r.rating ?? 5} className="text-[13px]" />
                            {metaLine(r) && <span className="text-[11px] text-ink-faint">{metaLine(r)}</span>}
                          </div>
                          <p className="text-[13px] text-ink-soft leading-relaxed line-clamp-3">{r.text || '사진 후기'}</p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}
      </div>

      {/* 리뷰 상세 모달 */}
      {cur && (
        <div className="fixed inset-0 z-[60] bg-ink/70 flex items-center justify-center p-4" onClick={() => setOpenIdx(null)}>
          <div className="bg-paper overflow-hidden max-w-[440px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {curPics.length > 0 && (
              <div className="relative bg-quiet">
                <img src={curPics[Math.min(photoIdx, curPics.length - 1)]} alt="리뷰 사진" className="w-full max-h-[60vh] object-contain block" onError={hideParent} />
                <button type="button" onClick={() => setOpenIdx(null)}
                  className="absolute top-2 right-2 w-8 h-8 bg-ink/70 text-paper flex items-center justify-center focus:outline-none focus-visible:shadow-ring" aria-label="닫기">
                  <IconClose className="w-4 h-4" />
                </button>
                {curPics.length > 1 && (
                  <>
                    <button type="button" onClick={() => setPhotoIdx((p) => (p - 1 + curPics.length) % curPics.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-ink/70 text-paper flex items-center justify-center focus:outline-none focus-visible:shadow-ring" aria-label="이전 사진">
                      <IconBack className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => setPhotoIdx((p) => (p + 1) % curPics.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-ink/70 text-paper flex items-center justify-center focus:outline-none focus-visible:shadow-ring" aria-label="다음 사진">
                      <IconChevronRight className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-ink/70 text-paper text-[11px] tabular-nums px-2 py-0.5">
                      {Math.min(photoIdx, curPics.length - 1) + 1} / {curPics.length}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <Stars value={cur.rating ?? 5} className="text-[15px]" />
                {curPics.length === 0 && (
                  <button type="button" onClick={() => setOpenIdx(null)} className="text-ink-faint focus:outline-none focus-visible:shadow-ring" aria-label="닫기">
                    <IconClose className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap">{cur.text || '작성된 후기 내용이 없습니다.'}</p>
              {metaLine(cur) && <p className="mt-3 text-[12px] text-ink-faint">{metaLine(cur)}</p>}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
    </div>
  )
}
