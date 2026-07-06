import { useState } from 'react'
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

// PHOTO REVIEW 섹션: 요약박스(평균평점+리뷰수) + 사진 리뷰 카드(사진+본문+별점+작성자).
// 카드/사진 클릭 시 본문 모달. 고객 상세 / 파트너 관리 공용. 상세이미지와 같은 폭 가운데 정렬.
export default function ReviewSummary({
  summary,
  className = '',
}: {
  summary?: ReviewSummaryData | null
  className?: string
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (!summary || !summary.count) return null
  const { count, avg } = summary
  const reviews = (summary.photos ?? []).map(toPhoto)
  const rating = avg ?? 0
  const active = openIdx != null ? reviews[openIdx] : null

  return (
    <section className={`px-4 py-8 ${className}`}>
      <div className="max-w-[1000px] mx-auto">
        <h2 className="text-[13px] font-bold tracking-[0.08em] text-text mb-4">PHOTO REVIEW</h2>

        {/* 요약 박스 + 사진 미리보기 줄 */}
        <div className="flex items-stretch gap-3">
          <div className="shrink-0 w-[104px] rounded-xl bg-cream flex flex-col items-center justify-center py-4">
            <p className="text-[26px] font-bold text-text leading-none">{rating ? rating.toFixed(1) : '-'}</p>
            <Stars value={rating} className="text-[13px] mt-1.5" />
            <p className="text-[12px] text-text-sub mt-1.5">{count.toLocaleString('ko-KR')}개</p>
          </div>
          {reviews.length > 0 && (
            <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto scrollbar-hide">
              {reviews.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenIdx(i)}
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
                onClick={() => setOpenIdx(i)}
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

      {/* 리뷰 상세 모달 */}
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
