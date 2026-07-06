import { useState } from 'react'
import type { ReviewSummaryData, ReviewPhoto } from '../../lib/types'

// 문자열 URL(구형) / ReviewPhoto(신형) 공통 정규화
function toPhoto(p: string | ReviewPhoto): ReviewPhoto {
  return typeof p === 'string' ? { url: p } : p
}

// 간단 리뷰 위젯: 상단 리뷰수+평균평점, 하단 작은 사진 썸네일(클릭 시 본문 모달).
// 고객 상세 / 파트너 관리 공용. 상세이미지와 같은 폭(max-w-[1000px])으로 가운데 정렬.
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
  const photos = (summary.photos ?? []).map(toPhoto)
  const rating = avg ?? 0
  const stars = [0, 1, 2, 3, 4].map((i) => {
    const v = rating - i
    return v >= 1 ? 'full' : v >= 0.5 ? 'half' : 'empty'
  })
  const active = openIdx != null ? photos[openIdx] : null

  return (
    <section className={`px-5 py-8 ${className}`}>
      <div className="max-w-[1000px] mx-auto">
        <h2 className="text-[17px] font-bold text-text">
          전체 리뷰 <span className="text-text-sub">({count.toLocaleString('ko-KR')})</span>
        </h2>
        <div className="mt-4 border-t border-cream-2 pt-6">
          <div className="flex items-center justify-center gap-16">
            {/* 평균 평점 */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex gap-0.5 text-[22px] leading-none" aria-hidden="true">
                {stars.map((s, i) => (
                  <span key={i} className={s === 'empty' ? 'text-cream-2' : 'text-[#ff6f61]'}>
                    {s === 'half' ? '⯪' : '★'}
                  </span>
                ))}
              </div>
              <p className="text-[26px] font-bold text-text leading-none">
                {rating ? rating.toFixed(1) : '-'} <span className="text-[18px] text-text-hint font-semibold">/ 5.0</span>
              </p>
            </div>
            {/* 리뷰 수 */}
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[22px] leading-none" aria-hidden="true">💬</span>
              <p className="text-[13px] font-semibold text-text-sub leading-none">리뷰 수</p>
              <p className="text-[26px] font-bold text-text leading-none">{count.toLocaleString('ko-KR')}</p>
            </div>
          </div>

          {/* 리뷰 사진 썸네일 (클릭 시 모달) */}
          {photos.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-2 justify-center">
              {photos.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setOpenIdx(i)}
                  className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-cream-2 hover:opacity-90 transition-opacity"
                  aria-label={`리뷰 사진 ${i + 1} 보기`}
                >
                  <img
                    src={p.url}
                    alt={`리뷰 사진 ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).closest('button')!.style.display = 'none' }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 리뷰 상세 모달 */}
      {active && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpenIdx(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-[420px] w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-cream">
              <img src={active.url} alt="리뷰 사진" className="w-full max-h-[60vh] object-contain" />
              <button
                type="button"
                onClick={() => setOpenIdx(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {active.rating != null && (
                <p className="text-[#ff6f61] text-[15px] tracking-tight mb-1" aria-hidden="true">
                  {'★'.repeat(Math.round(active.rating))}{'☆'.repeat(Math.max(0, 5 - Math.round(active.rating)))}
                </p>
              )}
              <p className="text-[14px] text-text leading-relaxed whitespace-pre-wrap">
                {active.text || '작성된 후기 내용이 없습니다.'}
              </p>
              <p className="mt-3 text-[12px] text-text-hint">
                {[active.author, active.date].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
