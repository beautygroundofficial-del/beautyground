import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDiaryFeed, toggleDiaryLike, type Diary } from '../../lib/diaries'
import { supabase } from '../../lib/supabase'
import LikeButton from '../community/LikeButton'
import { CommentToggle } from '../community/DiaryComments'
import { PetAvatars, petWalkLabel } from '../community/PetMarks'

// 홈의 주인공 — 사람들의 이야기 (2026-09-02)
// 대표님 지시로 홈에서 상품을 걷어내고 커뮤니티를 앞세우면서 만든 컴포넌트.
// 이야기 페이지(/app/diary)의 축약본이며, 카드 형태·문구는 그쪽과 같은 결을 유지한다.
//
// 문구는 기능 설명이 아니라 사람 말투로 쓴다 —
// "포인트를 드려요"를 앞세우면 거래 게시판이 되고, 그러면 아무도 마음을 안 쓴다.
//
// 2026-09-13 대표님 지시("홈과 이야기 내용이 겹친다") — 로드맵(축약본 원칙) 재확인 후 정리:
//   · "이달의 이야기"(상위 3개) 캐러셀은 이야기 탭 것과 완전히 같은 내용이라 홈에서 뺐다(이야기 탭에만 남김)
//   · 최근 글 미리보기는 8개 → 3개로 줄였다(속 이야기 미리보기 BoardHomeFeed와 같은 "3개만 얇게" 원칙 통일)

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
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      const [rows, { data: { session } }] = await Promise.all([
        getDiaryFeed('recent', 3), supabase.auth.getSession(),
      ])
      if (!active) return
      setFeed(rows)
      setLoggedIn(!!session)
    })()
    return () => { active = false }
  }, [])

  const go = () => navigate('/app/diary')
  // 말풍선 — 홈에서는 펼치지 않고 이야기 화면으로 가서 그 글의 댓글을 연다
  const goComments = (id: string) => navigate('/app/diary', { state: { openComments: id } })

  return (
    <>
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
                <li key={d.id} className="rounded-card border border-rule bg-paper overflow-hidden">
                  {/* 사진·글은 누르면 이야기 화면으로. 아래 줄(하트·말풍선)은 버튼이라 따로 둔다 — 버튼 안에 버튼을 넣을 수 없다 */}
                  <button
                    onClick={go}
                    className="w-full text-left focus:outline-none focus-visible:shadow-ring"
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
                    {d.video_url && (
                      <video src={d.video_url} controls playsInline preload="metadata" muted className="w-full max-h-[360px] bg-ink" />
                    )}
                    <div className="px-4 pt-4">
                      <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed line-clamp-4">{d.content}</p>
                    </div>
                  </button>
                  {/* 이야기 화면과 같은 줄 — [이름 · 시간] ····· [♡][💬] (2026-09-11 대표님 "게시판 모두 하트·말풍선") */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-rule">
                      <div className="flex items-center gap-2 min-w-0">
                        <button type="button" onClick={() => navigate(`/app/people/${d.user_id}`)} className="text-[12px] font-semibold text-ink truncate focus:outline-none focus-visible:shadow-ring">{maskName(d.nickname)}</button>
                        <PetAvatars pets={d.pets} />
                        <span className="text-[11.5px] text-ink-faint shrink-0">{timeAgo(d.created_at)}</span>
                        {petWalkLabel(d.pets, d.steps) ? (
                          <span className="text-[11.5px] text-ink-soft shrink-0 tabular-nums">🐾 {petWalkLabel(d.pets, d.steps)}</span>
                        ) : d.steps != null && d.steps > 0 && (
                          <span className="text-[11.5px] text-ink-soft shrink-0 tabular-nums">🚶 {d.steps.toLocaleString('ko-KR')}보</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 -mr-2">
                        <LikeButton
                          liked={d.liked_by_me}
                          count={d.like_count}
                          loggedIn={loggedIn}
                          disabled={d.is_mine}
                          onToggle={async () => {
                            const res = await toggleDiaryLike(d.id)
                            if (res) setFeed((prev) => (prev ?? []).map((x) => (x.id === d.id ? { ...x, liked_by_me: res.liked, like_count: res.like_count } : x)))
                            return res
                          }}
                        />
                        <CommentToggle count={d.comment_count} open={false} onClick={() => goComments(d.id)} />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
