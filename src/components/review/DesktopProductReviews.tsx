import { useNavigate } from 'react-router-dom'
import { IconClose, IconBack, IconChevronRight } from '../common/Icon'
import DesktopHeader from '../layout/DesktopHeader'
import type { ScrapedReview } from '../../lib/types'

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

interface Props {
  id?: string
  name: string
  avg: number | null
  count: number
  reviews: ScrapedReview[]
  photoReviews: { i: number; pics: string[] }[]
  openIdx: number | null
  setOpenIdx: (i: number | null) => void
  photoIdx: number
  setPhotoIdx: (updater: (p: number) => number) => void
  hideParent: (e: React.SyntheticEvent<HTMLImageElement>) => void
}

// PC 버전 — 요약·포토리뷰·전체리뷰를 넓은 폭 단일 컬럼으로, 포토 그리드만 6열로 넓힌다.
// 리뷰 상세 모달은 모바일과 동일 구조(폭 자체가 440px 고정이라 그대로 재사용).
export default function DesktopProductReviews({
  id,
  name,
  avg,
  count,
  reviews,
  photoReviews,
  openIdx,
  setOpenIdx,
  photoIdx,
  setPhotoIdx,
  hideParent,
}: Props) {
  const navigate = useNavigate()
  const cur = openIdx != null ? reviews[openIdx] : null
  const curPics = cur ? reviewPhotos(cur) : []

  return (
    <div className="bg-paper min-h-screen">
      <DesktopHeader />

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        {name && (
          <button
            type="button"
            onClick={() => navigate(`/app/product/${id}`)}
            className="text-left text-[13px] text-ink-soft mb-4 focus:outline-none focus-visible:shadow-ring"
          >
            ‹ {name}
          </button>
        )}

        <div className="flex items-center gap-6 border border-rule px-8 py-6 mb-8">
          <div className="text-center">
            <p className="text-[40px] font-bold tabular-nums text-ink leading-none">{avg != null ? avg.toFixed(1) : '-'}</p>
            <Stars value={avg ?? 0} className="text-[16px] mt-2" />
          </div>
          <div className="text-[13px] text-ink-soft">
            <p className="font-bold text-ink text-[16px]">리뷰 {count.toLocaleString('ko-KR')}개</p>
            <p className="mt-0.5 text-ink-faint">브랜드 공식몰 구매 후기</p>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="py-16 text-center text-ink-faint text-[14px]">아직 등록된 리뷰가 없습니다.</div>
        ) : (
          <>
            {photoReviews.length > 0 && (
              <section className="mb-10">
                <h2 className="text-[13px] font-bold tracking-[0.08em] text-ink mb-4">
                  PHOTO REVIEW <span className="text-ink-faint font-bold">({photoReviews.length})</span>
                </h2>
                <div className="grid grid-cols-6 gap-2">
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

            <section>
              <h2 className="text-[13px] font-bold tracking-[0.08em] text-ink mb-4">전체 리뷰</h2>
              <ul className="divide-y divide-rule border-t border-rule">
                {reviews.map((r, i) => {
                  const pics = reviewPhotos(r)
                  return (
                    <li key={i}>
                      <button type="button" onClick={() => setOpenIdx(i)} className="w-full text-left flex gap-4 py-5 focus:outline-none focus-visible:shadow-ring">
                        {pics.length > 0 && (
                          <div className="relative shrink-0">
                            <img src={pics[0]} alt="" loading="lazy" className="w-24 h-24 object-cover bg-quiet" onError={hideParent} />
                            {pics.length > 1 && <span className="absolute top-1 right-1 bg-ink/70 text-paper text-[9px] px-1">+{pics.length - 1}</span>}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Stars value={r.rating ?? 5} className="text-[14px]" />
                            {metaLine(r) && <span className="text-[12px] text-ink-faint">{metaLine(r)}</span>}
                          </div>
                          <p className="text-[14px] text-ink-soft leading-relaxed line-clamp-3">{r.text || '사진 후기'}</p>
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
    </div>
  )
}
