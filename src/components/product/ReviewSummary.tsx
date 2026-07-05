import type { ReviewSummaryData } from '../../lib/types'

// 간단 리뷰 위젯: 상단 리뷰수+평균평점, 하단 작은 사진 썸네일. (고객 상세 / 파트너 관리 공용)
// 대표이미지 ↔ 상세이미지 사이에 배치. 데이터 없으면 렌더 안 함.
export default function ReviewSummary({
  summary,
  className = '',
}: {
  summary?: ReviewSummaryData | null
  className?: string
}) {
  if (!summary || !summary.count) return null
  const { count, avg, photos } = summary
  const rating = avg ?? 0
  const stars = [0, 1, 2, 3, 4].map((i) => {
    const v = rating - i
    return v >= 1 ? 'full' : v >= 0.5 ? 'half' : 'empty'
  })

  return (
    <section className={`px-5 py-8 ${className}`}>
      <h2 className="text-[17px] font-bold text-text">
        전체 리뷰 <span className="text-text-sub">({count.toLocaleString('ko-KR')})</span>
      </h2>
      <div className="mt-4 border-t border-cream-2 pt-6">
        <div className="flex items-center justify-around gap-4">
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

        {/* 리뷰 사진 썸네일 */}
        {photos.length > 0 && (
          <div className="mt-7 flex gap-2 overflow-x-auto scrollbar-hide">
            {photos.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`리뷰 사진 ${i + 1}`}
                loading="lazy"
                className="shrink-0 w-20 h-20 rounded-lg object-cover border border-cream-2"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
