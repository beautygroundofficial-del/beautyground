import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toggleDiaryLike, type Diary } from '../../lib/diaries'
import { getConversationFeed } from '../../lib/communityConversations'
import { supabase } from '../../lib/supabase'
import LikeButton from '../community/LikeButton'
import { CommentToggle } from '../community/DiaryComments'
import { PetAvatars, petWalkLabel } from '../community/PetMarks'
import StoryMediaPreview from './StoryMediaPreview'

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
// 2026-09-13 (같은 날, 재지시) — "앱 처음 열었을 때 홈이 비어 보이면 안 된다. 이야기 내용이 홈에 오는 게 맞다"고
// 정정: 겹치는 것보다 첫 화면이 비어 보이는 게 더 나쁘다고 판단해 미리보기를 3개 → 6개로 다시 늘림.
// (이달의 이야기 랭킹 캐러셀까지 되살리진 않음 — 그건 최신 글과 별개로 계속 똑같은 상위 3개만 보여주는
// 완전 중복이라 뺀 채로 둔다. "최근 글이 계속 올라온다"는 흐름 자체를 넉넉히 보여주는 쪽으로만 조정.)

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
    <div className="flex items-end justify-between gap-3 mb-4">
      <div className="min-w-0">
        <p className="text-[13px] text-ink-soft leading-relaxed mb-1.5">{label}</p>
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink leading-snug">{title}</h2>
      </div>
      {onMore && (
        <button onClick={onMore} className="min-h-11 shrink-0 rounded-control px-2 text-[13px] text-ink-soft focus:outline-none focus-visible:shadow-ring">
          더보기
        </button>
      )}
    </div>
  )
}

export default function DiaryHomeFeed({ limit = 6, compact = false, skipFirst = false }: { limit?: number; compact?: boolean; skipFirst?: boolean }) {
  const navigate = useNavigate()
  const [feed, setFeed] = useState<Diary[] | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [error, setError] = useState('')
  const loadVersion = useRef(0)

  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setError('')
    setFeed(null)
    try {
      const [rows, { data: { session } }] = await Promise.all([
        getConversationFeed('recent', limit), supabase.auth.getSession(),
      ])
      if (version !== loadVersion.current) return
      setFeed(rows)
      setLoggedIn(!!session)
    } catch {
      if (version === loadVersion.current) setError('이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }, [limit])
  useEffect(() => {
    void load()
    return () => { loadVersion.current++ }
  }, [load])

  const go = () => navigate('/app/diary')
  // 말풍선 — 홈에서는 펼치지 않고 이야기 화면으로 가서 그 글의 댓글을 연다
  const goPost = (id: string) => navigate(`/app/diary?focus=${id}`)
  const goComments = (id: string) => navigate(`/app/diary?focus=${id}&comments=${id}`)

  return (
    <>
      {/* 최근 이야기 */}
      <section className="px-5 pt-6 pb-6">
        <SectionHead
          label={compact ? '사진과 함께 나누는 우리의 일상' : '오늘도 각자의 하루를 살아갑니다'}
          title={compact ? '하루 이야기' : '사람들의 이야기'}
          onMore={feed && feed.length > 0 ? go : undefined}
        />

        {error ? (
          <div role="alert" className="rounded-card bg-quiet px-5 py-6 text-center text-[15px] leading-[1.7] text-ink-soft">
            <p>{error}</p>
            <button type="button" onClick={() => void load()} className="mt-2 min-h-11 px-4 underline underline-offset-4 focus-visible:shadow-ring">다시 불러오기</button>
          </div>
        ) : feed === null ? (
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
          <ul className="divide-y divide-rule border-t border-rule">
            {feed.slice(skipFirst ? 1 : 0).map((d) => {
              const imgs = d.images ?? []
              if (compact) return (
                <li key={d.id} className="py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <button type="button" onClick={() => navigate(`/app/people/${d.user_id}`)} className="min-h-11 text-[13px] font-semibold text-ink focus-visible:shadow-ring">{maskName(d.nickname)}</button>
                    <PetAvatars pets={d.pets} />
                    <span className="ml-auto text-[12px] text-ink-soft">{timeAgo(d.created_at)}</span>
                  </div>
                  <button type="button" onClick={() => goPost(d.id)} className="block w-full text-left focus-visible:shadow-ring">
                    <span className="block text-[15px] leading-[1.7] line-clamp-3 whitespace-pre-wrap break-words text-ink">{d.content.replace(/https?:\/\/[^\s<>]+/g, '').trim() || '공유한 링크를 확인해보세요.'}</span>
                    <StoryMediaPreview content={d.content} images={imgs} videoUrl={d.video_url} />
                  </button>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    <LikeButton liked={d.liked_by_me} count={d.like_count} loggedIn={loggedIn} disabled={d.is_mine} onToggle={async () => {
                      const res = await toggleDiaryLike(d.id)
                      if (res) setFeed(prev => (prev ?? []).map(x => x.id === d.id ? { ...x, liked_by_me: res.liked, like_count: res.like_count } : x))
                      return res
                    }} />
                    <CommentToggle count={d.comment_count} open={false} onClick={() => goComments(d.id)} />
                  </div>
                </li>
              )
              return (
                <li key={d.id} className="bg-paper py-5">
                  <div className="mb-4 flex items-center gap-3">
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-quiet text-[16px] font-bold text-ink">{maskName(d.nickname)[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => navigate(`/app/people/${d.user_id}`)} className="min-h-11 max-w-full truncate text-left text-[14px] font-bold text-ink focus-visible:shadow-ring">{maskName(d.nickname)}</button>
                        <PetAvatars pets={d.pets} />
                      </div>
                      <p className="-mt-1 text-[12px] text-ink-soft">{timeAgo(d.created_at)}</p>
                    </div>
                  </div>
                  {/* 사진·글은 이야기로 이동하고, 영상 조작은 현재 화면에 머문다. */}
                  {imgs.length > 0 && (
                    <button type="button" onClick={() => goPost(d.id)} aria-label="이야기 사진과 글 보기" className="block w-full text-left focus:outline-none focus-visible:shadow-ring">
                      <div className={`mb-4 grid gap-0.5 overflow-hidden rounded-xl ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
                    </button>
                  )}
                  {d.video_url && (
                    <video src={d.video_url} controls playsInline preload="metadata" muted className="w-full max-h-[360px] bg-ink" />
                  )}
                  <button type="button" onClick={() => goPost(d.id)} className="w-full text-left focus:outline-none focus-visible:shadow-ring">
                    <div>
                      <p className="text-[16px] text-ink whitespace-pre-wrap break-words leading-[1.8] line-clamp-4">{d.content}</p>
                    </div>
                  </button>
                  {/* 작성자는 위에서, 공감과 댓글은 본문 아래에서 만난다. */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 max-w-full">
                        {petWalkLabel(d.pets, d.steps) ? (
                          <span className="text-[12px] text-ink-soft tabular-nums">🐾 {petWalkLabel(d.pets, d.steps)}</span>
                        ) : d.steps != null && d.steps > 0 && (
                          <span className="text-[12px] text-ink-soft tabular-nums">🚶 {d.steps.toLocaleString('ko-KR')}보</span>
                        )}
                      </div>
                      <div className="ml-auto flex items-center gap-1 shrink-0 -mr-2">
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
