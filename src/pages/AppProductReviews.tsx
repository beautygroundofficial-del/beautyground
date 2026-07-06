import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import { supabase } from '../lib/supabase'
import type { Product, ScrapedReview } from '../lib/types'

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
    <span className={`text-gold tracking-tight ${className}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (i < full ? '★' : '☆')).join('')}
    </span>
  )
}

export default function AppProductReviews() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params] = useSearchParams()
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-text-hint text-[14px]">불러오는 중...</p>
      </div>
    )
  }

  const cur = openIdx != null ? reviews[openIdx] : null
  const curPics = cur ? reviewPhotos(cur) : []

  return (
    <div className="min-h-screen bg-white" style={{ paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
      <BackHeader title="리뷰" onBack={() => navigate(`/app/product/${id}`)} />

      <div className="max-w-[1000px] mx-auto">
        {/* 상품명 (클릭 시 상품 페이지로) */}
        {name && (
          <button
            type="button"
            onClick={() => navigate(`/app/product/${id}`)}
            className="w-full text-left px-4 pt-4 text-[13px] text-text-sub truncate hover:text-text transition-colors"
          >
            ‹ {name}
          </button>
        )}

        {/* 요약 */}
        <div className="px-4 py-5 flex items-center gap-4 border-b border-cream-2">
          <div className="text-center">
            <p className="text-[34px] font-bold text-text leading-none">{avg != null ? avg.toFixed(1) : '-'}</p>
            <Stars value={avg ?? 0} className="text-[15px] mt-1.5" />
          </div>
          <div className="text-[13px] text-text-sub">
            <p className="font-semibold text-text text-[15px]">리뷰 {count.toLocaleString('ko-KR')}개</p>
            <p className="mt-0.5 text-text-hint">실제 구매 후기</p>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="px-4 py-16 text-center text-text-hint text-[14px]">아직 등록된 리뷰가 없습니다.</div>
        ) : (
          <>
            {/* PHOTO REVIEW 그리드 */}
            {photoReviews.length > 0 && (
              <section className="px-4 py-5 border-b border-cream-2">
                <h2 className="text-[13px] font-bold tracking-[0.08em] text-text mb-3">
                  PHOTO REVIEW <span className="text-text-hint font-medium">({photoReviews.length})</span>
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                  {photoReviews.map(({ i, pics }) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setOpenIdx(i)}
                      className="relative aspect-square rounded-lg overflow-hidden bg-cream"
                      aria-label={`포토 리뷰 ${i + 1} 보기`}
                    >
                      <img src={pics[0]} alt="" loading="lazy" className="w-full h-full object-cover" onError={hideParent} />
                      {pics.length > 1 && (
                        <span className="absolute top-1 right-1 bg-black/55 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
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
              <h2 className="text-[13px] font-bold tracking-[0.08em] text-text mb-3">전체 리뷰</h2>
              <ul className="divide-y divide-cream-2">
                {reviews.map((r, i) => {
                  const pics = reviewPhotos(r)
                  return (
                    <li key={i}>
                      <button type="button" onClick={() => setOpenIdx(i)} className="w-full text-left flex gap-3 py-4">
                        {pics.length > 0 && (
                          <div className="relative shrink-0">
                            <img src={pics[0]} alt="" loading="lazy" className="w-20 h-20 rounded-lg object-cover bg-cream" onError={hideParent} />
                            {pics.length > 1 && <span className="absolute top-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">+{pics.length - 1}</span>}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Stars value={r.rating ?? 5} className="text-[13px]" />
                            {metaLine(r) && <span className="text-[11px] text-text-hint">{metaLine(r)}</span>}
                          </div>
                          <p className="text-[13px] text-text-sub leading-relaxed line-clamp-3">{r.text || '사진 후기'}</p>
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
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setOpenIdx(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-[440px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {curPics.length > 0 && (
              <div className="relative bg-cream">
                <img src={curPics[Math.min(photoIdx, curPics.length - 1)]} alt="리뷰 사진" className="w-full max-h-[60vh] object-contain block" onError={hideParent} />
                <button type="button" onClick={() => setOpenIdx(null)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center" aria-label="닫기">✕</button>
                {curPics.length > 1 && (
                  <>
                    <button type="button" onClick={() => setPhotoIdx((p) => (p - 1 + curPics.length) % curPics.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white text-lg" aria-label="이전 사진">‹</button>
                    <button type="button" onClick={() => setPhotoIdx((p) => (p + 1) % curPics.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/45 text-white text-lg" aria-label="다음 사진">›</button>
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/55 text-white text-[11px] px-2 py-0.5 rounded-full">
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
                  <button type="button" onClick={() => setOpenIdx(null)} className="text-text-hint text-lg leading-none" aria-label="닫기">✕</button>
                )}
              </div>
              <p className="text-[14px] text-text leading-relaxed whitespace-pre-wrap">{cur.text || '작성된 후기 내용이 없습니다.'}</p>
              {metaLine(cur) && <p className="mt-3 text-[12px] text-text-hint">{metaLine(cur)}</p>}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
