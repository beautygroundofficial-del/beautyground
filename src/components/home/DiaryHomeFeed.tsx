import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDiaryFeed, getMonthlyBestDiaries, type Diary, type BestDiary } from '../../lib/diaries'

// 홈의 주인공 — 사람들의 이야기 (2026-09-02)
// 대표님 지시로 홈에서 상품을 걷어내고 커뮤니티를 앞세우면서 만든 컴포넌트.
// 이야기 페이지(/app/diary)의 축약본이며, 카드 형태·문구는 그쪽과 같은 결을 유지한다.
//
// 문구는 기능 설명이 아니라 사람 말투로 쓴다 —
// "포인트를 드려요"를 앞세우면 거래 게시판이 되고, 그러면 아무도 마음을 안 쓴다.

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

function SectionHead({ label, title, onMore }: { label: string; title: string; onMore?: () => void }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">{label}</p>
        <h2 className="text-[17px] font-bold text-ink leading-tight">{title}</h2>
      </div>
      {onMore && (
        <button onClick={onMore} className="shrink-0 text-[12px] text-ink-soft focus:outline-none focus-visible:shadow-ring">
          더보기
        </button>
      )}
    </div>
  )
}

export default function DiaryHomeFeed() {
  const navigate = useNavigate()
  const [feed, setFeed] = useState<Diary[] | null>(null)
  const [best, setBest] = useState<BestDiary[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      const [rows, bests] = await Promise.all([getDiaryFeed('recent', 8), getMonthlyBestDiaries(3)])
      if (!active) return
      setFeed(rows)
      setBest(bests)
    })()
    return () => { active = false }
  }, [])

  const go = () => navigate('/app/diary')

  return (
    <>
      {/* 많은 분이 마음을 눌러준 이야기 */}
      {best.length > 0 && (
        <section className="px-5 pt-8">
          <SectionHead label="이번 달, 많은 분이 마음을 눌러준" title="이달의 이야기" />
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-1 px-1 snap-x">
            {best.map((b, i) => (
              <button
                key={b.id}
                onClick={go}
                className="shrink-0 w-[190px] snap-start text-left rounded-card border border-rule bg-paper p-4 focus:outline-none focus-visible:shadow-ring"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink text-paper text-[11px] font-bold mb-2.5">
                  {i + 1}
                </span>
                <p className="text-[13px] text-ink leading-snug line-clamp-3 min-h-[3.6em]">{b.content}</p>
                {b.reaction_count > 0 && (
                  <p className="text-[11.5px] text-ink-faint mt-2.5">🤍 {b.reaction_count}</p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 최근 이야기 */}
      <section className="px-5 pt-8 pb-6">
        <SectionHead
          label="오늘도 각자의 하루를 살아갑니다"
          title="사람들의 이야기"
          onMore={feed && feed.length > 0 ? go : undefined}
        />

        {feed === null ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-card border border-rule overflow-hidden">
                <div className="aspect-[4/3] bg-quiet animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-quiet rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-quiet rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <button
            onClick={go}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-12 text-center focus:outline-none focus-visible:shadow-ring"
          >
            <p className="text-[14px] font-semibold text-ink">아직 아무도 오늘을 남기지 않았어요</p>
            <p className="text-[12.5px] text-ink-faint mt-1.5">첫 이야기의 주인공이 되어주세요</p>
          </button>
        ) : (
          <ul className="space-y-4">
            {feed.map((d) => {
              const imgs = d.images ?? []
              return (
                <li key={d.id}>
                  <button
                    onClick={go}
                    className="w-full text-left rounded-card border border-rule bg-paper overflow-hidden focus:outline-none focus-visible:shadow-ring"
                  >
                    {imgs.length > 0 && (
                      <div className={`grid gap-0.5 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {imgs.slice(0, 4).map((src, i) => (
                          <div
                            key={`${src}-${i}`}
                            className={`bg-quiet overflow-hidden ${
                              imgs.length === 1 ? 'aspect-[4/3]' : 'aspect-square'
                            } ${imgs.length === 3 && i === 0 ? 'col-span-2 aspect-[2/1]' : ''}`}
                          >
                            <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="p-4">
                      <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed line-clamp-4">{d.content}</p>
                      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-rule">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[12px] font-semibold text-ink truncate">{maskName(d.nickname)}</span>
                          <span className="text-[11.5px] text-ink-faint shrink-0">{timeAgo(d.created_at)}</span>
                        </div>
                        {/* 홈 카드는 전체가 '이야기로 가기' 버튼이라 반응 버튼을 넣으면 버튼이 겹친다.
                            여기서는 받은 공감 수만 보여주고, 누르는 것은 이야기 화면에서 한다. */}
                        <span className="flex items-center gap-2 text-[12.5px] text-ink-soft shrink-0">
                          {d.pat + d.same + d.cheer > 0 && <span>🤍 {d.pat + d.same + d.cheer}</span>}
                          {d.comment_count > 0 && <span>💬 {d.comment_count}</span>}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
