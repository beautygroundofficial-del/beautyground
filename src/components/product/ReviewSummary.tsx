import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ReviewSummaryData, ReviewPhoto } from '../../lib/types'

function toPhoto(p: string | ReviewPhoto): ReviewPhoto {
  return typeof p === 'string' ? { url: p } : p
}
function Stars({ value, className = '' }: { value: number; className?: string }) {
  const full = Math.round(value)
  return (
    <span className={`text-[#ff6f61] tracking-tight ${className}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (i < full ? '★' : '☆')).join('')}
    </span>
  )
}

// PHOTO REVIEW 요약 위젯: 요약박스(평균평점+리뷰수) + 사진 리뷰 미리보기 + 카드.
// productId 있으면(고객 상세) 클릭 시 별도 리뷰 페이지로 이동, 없으면(파트너) 모달로 본문.
export default function ReviewSummary({
  summary,
  productId,
  className = '',
}: {
  summary?: ReviewSummaryData | null
  productId?: string
  className?: string
}) {
  const navigate = useNavigate()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (!summary || !summary.count) return null
  const { count, avg } = summary
  const reviews = (summary.photos ?? []).map(toPhoto)
  const rating = avg ?? 0
  const active = openIdx != null ? reviews[openIdx] : null

  const goReviews = (photoUrl?: string) => {
    if (!productId) return
    navigate(`/app/product/${productId}/reviews${photoUrl ? `?photo=${encodeURIComponent(photoUrl)}` : ''}`)
  }
  // 항목 클릭: 고객 페이지는 리뷰 페이지로, 파트너는 모달
  const onItem = (i: number, photoUrl?: string) => {
    if (productId) goReviews(photoUrl)
    else setOpenIdx(i)
  }

  return (
    <section className={`px-4 py-8 ${className}`}>
      <div className="max-w-[1000px] mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold tracking-[0.08em] text-text">PHOTO REVIEW</h2>
          {productId && (
            <button type="button" onClick={() => goReviews()} className="text-[12px] font-semibold text-[#ff6f61]">
              리뷰 전체보기 ›
            </button>
          )}
        </div>

        {/* 요약 박스 + 사진 미리보기 줄 */}
        <div className="flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => goReviews()}
            disabled={!productId}
            className="shrink-0 w-[104px] rounded-xl bg-cream flex flex-col items-center justify-center py-4 disabled:cursor-default"
          >
            <p className="text-[26px] font-bold text-text leading-none">{rating ? rating.toFixed(1) : '-'}</p>
            <Stars value={rating} className="text-[13px] mt-1.5" />
            <p className="text-[12px] text-text-sub mt-1.5">{count.toLocaleString('ko-KR')}개</p>
          </button>
          {reviews.length > 0 && (
            <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto scrollbar-hide">
              {reviews.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onItem(i, r.url)}
                  className="shrink-0 w-[104px] h-[104px] rounded-lg overflow-hidden bg-cream"
                  aria-label={`리뷰 사진 ${i + 1} 보기`}
                >
                  <img src={r.url} alt={`리뷰 사진 ${i + 1}`} loading="lazy" className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).closest('button')!.style.display = 'none' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 리뷰 카드 그리드 (사진 + 본문 + 별점 + 날짜/작성자) */}
        {reviews.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {reviews.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onItem(i, r.url)}
                className="text-left bg-white border border-cream-2 rounded-xl overflow-hidden hover:shadow-sm transition-shadow"
              >
                <div className="aspect-square bg-cream">
                  <img src={r.url} alt="" loading="lazy" className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }} />
                </div>
                <div className="p-2.5">
                  <p className="text-[12px] text-text leading-snug line-clamp-2 min-h-[32px]">{r.text || '후기 사진'}</p>
                  <Stars value={r.rating ?? 5} className="text-[12px] mt-1.5 block" />
                  <p className="text-[11px] text-text-hint mt-1">
                    {[r.date, r.author].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 리뷰 상세 모달 (파트너 페이지 전용 — productId 없을 때) */}
      {active && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setOpenIdx(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-[420px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-cream">
              <img src={active.url} alt="리뷰 사진" className="w-full max-h-[60vh] object-contain" />
              <button type="button" onClick={() => setOpenIdx(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center" aria-label="닫기">✕</button>
            </div>
            <div className="p-4">
              {active.rating != null && <Stars value={active.rating} className="text-[15px] mb-1 block" />}
              <p className="text-[14px] text-text leading-relaxed whitespace-pre-wrap">{active.text || '작성된 후기 내용이 없습니다.'}</p>
              <p className="mt-3 text-[12px] text-text-hint">{[active.author, active.date].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
