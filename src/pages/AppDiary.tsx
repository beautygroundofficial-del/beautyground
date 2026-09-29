import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconPencil } from '@tabler/icons-react'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import {
  getMonthlyBestDiaries, deleteDiary, toggleDiaryLike,
  type Diary, type BestDiary, type DiarySort,
} from '../lib/diaries'
import LikeButton from '../components/community/LikeButton'
import ReactionBar from '../components/community/ReactionBar'
import ReactionSummary from '../components/community/ReactionSummary'
import DiaryComments, { CommentToggle } from '../components/community/DiaryComments'
import StoryTabs from '../components/community/StoryTabs'
import Lightbox from '../components/community/Lightbox'
import FriendButton from '../components/community/FriendButton'
import { PetAvatars, petWalkLabel } from '../components/community/PetMarks'
import { FRIENDS_CHANGED_EVENT, getFriendStatuses, type FriendStatus } from '../lib/friends'
import { getConversationDiary, getConversationFeed } from '../lib/communityConversations'

// 살아가는 이야기 — 유저가 사진과 함께 일상을 남기는 곳.
// 글을 올리면 create_diary RPC 안에서 diary_post 미션이 자동 적립된다(화면에서 따로 적립 호출 안 함).
// 좋아요가 많은 글은 '이달의 우수 사연'으로 뽑아 선물을 준다.
//
// 2026-09-02 화면 정돈 — 히로인스 게시판이 "텍스트가 빽빽하고 계속 재촉해서 답답하다"는
// 대표님 지적에 따라, 수상작(트웬티) 방식으로 다시 짰다.
//   · 작은 회색 라벨 + 굵은 제목으로 위계를 만든다
//   · 우수 사연은 텍스트 3줄 나열 대신 가로 카드로 (사진이 있으면 사진이 주인공)
//   · 피드 카드는 사진을 크게, 본문은 3줄까지만 — 훑을 수 있게
//   · 재촉하는 장치(타이머·소멸 압박)는 넣지 않는다
// 로직(불러오기·작성·좋아요·삭제)은 이전과 동일하다.
// 2026-09-11 — 쓰기는 전용 화면(/app/diary/write, 글·사진·걸음 수)으로 옮겼다. 여기선 입구만 둔다.
// 2026-09-11 — 친구: 남의 닉네임 옆 작은 친구 버튼, 정렬 옆 "친구" 탭(친구 글만). 친구 닉네임은 가리지 않는다.

type FeedView = DiarySort | 'friends'

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  // 이메일 앞부분이 닉네임이 되면 길어질 수 있어 가운데 별표는 최대 3개로 줄인다.
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

// 섹션 머리 — 작은 회색 라벨 위, 굵은 제목 아래. 훑기만 해도 구조가 잡히게.
function SectionHead({ label, title, right }: { label: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 mb-4">
      <div className="min-w-0">
        <p className="text-[13px] text-ink-soft leading-relaxed mb-1.5">{label}</p>
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-ink leading-snug">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export default function AppDiary() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const legacy = location.state as { toast?: string; openComments?: string; focus?: string } | null
  const targetId = params.get('focus') || params.get('comments') || legacy?.focus || legacy?.openComments || null
  const targetComments = params.get('comments') || legacy?.openComments || null
  const targetComment = params.get('comment') || undefined
  const loadVersion = useRef(0)

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [sort, setSort] = useState<FeedView>('recent')
  const [feed, setFeed] = useState<Diary[]>([])
  // 글쓴이별 친구 관계 — 없으면 'none'
  const [friendOf, setFriendOf] = useState<Record<string, FriendStatus>>({})
  const [best, setBest] = useState<BestDiary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [targetError, setTargetError] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [toast, setToast] = useState('')
  // 사진 크게 보기 — 어느 글의 몇 번째 사진인지
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null)
  // 댓글이 펼쳐진 글들
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [openBest, setOpenBest] = useState<string | null>(null)
  // 새 소식·그 사람 페이지에서 온 글 — 목록이 뜨면 그 카드로 내려가 잠깐 강조한다(2026-09-12 A2)
  const [focusId, setFocusId] = useState<string | null>(null)
  const toggleComments = (id: string) => setOpenComments((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  // 쓰기 화면에서 올리고 돌아오면 그쪽이 넘긴 한 줄을 조용히 보여준다
  useEffect(() => {
    const st = location.state as { toast?: string; openComments?: string; focus?: string } | null
    if (st?.toast) showToast(st.toast)
    // 홈 카드의 말풍선에서 들어오면 그 글의 댓글을 펼친 채로 시작한다
    if (targetComments) setOpenComments(prev => new Set([...prev, targetComments]))
    if (targetId) { setFocusId(targetId); setExpanded(prev => new Set([...prev, targetId])) }
  }, [location.state, targetComments, targetId])

  const load = useCallback(async (s: FeedView) => {
    const version = ++loadVersion.current
    setLoading(true); setLoadError(''); setTargetError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const [rows, bests] = await Promise.all([getConversationFeed(s), getMonthlyBestDiaries(3)])
      if (version !== loadVersion.current) return
      setLoggedIn(!!session)
      if (targetId && !rows.some(row => row.id === targetId)) {
        try {
          const target = await getConversationDiary(targetId)
          if (version !== loadVersion.current) return
          if (target) rows.unshift(target)
          else setTargetError('이 이야기는 삭제되었거나 지금은 볼 수 없어요.')
        } catch { if (version === loadVersion.current) setTargetError('선택한 이야기를 불러오지 못했어요. 다시 시도해 주세요.') }
      }
      if (version !== loadVersion.current) return
      setFeed(rows); setBest(bests)
      const statuses = session ? await getFriendStatuses(rows.filter(r => !r.is_mine).map(r => r.user_id)) : {}
      if (version === loadVersion.current) setFriendOf(statuses)
    } catch { if (version === loadVersion.current) setLoadError('이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') }
    finally { if (version === loadVersion.current) setLoading(false) }
  }, [targetId])

  useEffect(() => {
    void load(sort)
    const refresh = () => { void load(sort) }
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh)
    window.addEventListener('focus', refresh)
    return () => { loadVersion.current++; window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh); window.removeEventListener('focus', refresh) }
  }, [load, sort])

  useEffect(() => {
    if (!focusId || loading || targetComment) return
    const el = document.getElementById(`diary-${focusId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setFocusId(null), 2500)
    return () => clearTimeout(t)
  }, [focusId, loading, feed, targetComment])

  // 좋아요(평가) 대신 공감 반응으로 바꿨다(2026-09-07) — 누르는 처리는 ReactionBar 안에 있고,
  // 여기서는 결과만 받아 목록에 반영한다(정렬·재조회 없이 그 자리에서만 바뀐다).
  const onReacted = (id: string, next: { pat: number; same: number; cheer: number; my_kind: Diary['my_kind'] }) => {
    setFeed((prev) => prev.map((x) => (x.id === id ? { ...x, ...next } : x)))
  }

  const onDelete = async (d: Diary) => {
    if (!window.confirm('이 이야기를 삭제할까요?')) return
    const ok = await deleteDiary(d.id)
    if (!ok) { showToast('삭제하지 못했어요'); return }
    setFeed((prev) => prev.filter((x) => x.id !== d.id))
  }

  const openComposer = () => {
    if (!loggedIn) { navigate('/app/login', { state: { from: '/app/diary/write' } }); return }
    navigate('/app/diary/write')
  }

  return (
    <AppFrame>
      <BackHeader title="이야기" rightElement={<button type="button" onClick={() => navigate('/app/friends')} className="min-h-11 px-2 text-[13px] font-semibold">내 친구</button>} />
      <StoryTabs current="/app/diary" />

      {/* 쓰기 — 화면에 들어오면 가장 먼저 보이는 행동 */}
      <section className="px-5 pt-4">
        <button
          onClick={openComposer}
          className="flex w-full items-center gap-4 rounded-card bg-quiet p-5 text-left transition-colors hover:bg-rule/50 focus:outline-none focus-visible:shadow-ring"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper" aria-hidden="true"><IconPencil size={20} stroke={1.6} /></span>
          <span className="min-w-0">
            <span className="block text-[16px] font-bold leading-relaxed text-ink">오늘 어떤 하루였나요?</span>
            <span className="block text-[13px] leading-relaxed text-ink-soft mt-1">사소한 하루도 누군가에겐 위로가 됩니다 · 사진과 걸음 수도 함께</span>
          </span>
        </button>
      </section>

      {/* 이달의 우수 사연 — 텍스트 나열 대신 가로 카드
          누르면 그 글의 상세(댓글)를 펼친다(2026-09-16). best는 별도 쿼리라 feed(최신 30개)에
          안 실려 있을 수 있어, 카드 자체를 펼쳐 보여준다(피드로 스크롤하는 방식은 못 찾는 경우가 생김). */}
      {best.length > 0 && (
        <section className="px-5 pt-8">
          <SectionHead label="이번 달, 많은 분이 마음을 눌러준" title="이달의 이야기" />
          <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1 snap-x">
            {best.map((b, i) => {
              const open = openBest === b.id
              return (
                <div
                  key={b.id}
                  className={`shrink-0 snap-start rounded-card border bg-paper p-4 transition-[width] motion-reduce:transition-none ${
                    open ? 'w-[260px] border-ink' : 'w-[190px] h-[168px] overflow-hidden border-rule'}`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenBest(prev => prev === b.id ? null : b.id)}
                    className="w-full text-left focus:outline-none focus-visible:shadow-ring"
                  >
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink text-paper text-[11px] font-bold mb-1.5">
                      {i + 1}
                    </span>
                    <p className={`text-[15px] text-ink leading-[1.7] break-words min-h-[3.4em] ${open ? '' : 'line-clamp-2'}`}>
                      {b.content}
                    </p>
                    <p className={`text-[12px] text-ink-soft mt-3 ${b.reaction_count > 0 ? '' : 'invisible'}`}>🤍 {b.reaction_count}</p>
                  </button>
                  {open && (
                    <button type="button" onClick={() => navigate(`/app/diary?focus=${b.id}&comments=${b.id}`)} className="min-h-11 mt-2 text-[13px] underline">이야기와 댓글 읽기</button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 피드 */}
      <section className="px-5 pt-8 pb-28">
        <SectionHead
          label="오늘도 각자의 하루를 살아갑니다"
          title="사람들의 이야기"
          right={
            <div className="flex items-center gap-2" aria-label="이야기 정렬">
              {([['recent', '최신'], ['popular', '인기'], ['walk', '산책'], ['friends', '친구']] as const).map(([key, label]) => (
                <button key={key}
                  onClick={() => {
                    if (key === 'friends' && !loggedIn) { navigate('/app/login', { state: { from: '/app/diary' } }); return }
                    if (key === sort) return
                    setLoading(true); setSort(key)
                  }}
                  aria-pressed={sort === key}
                  className={`min-h-11 flex-1 rounded-full border border-solid px-3 py-2 text-[14px] font-bold transition-colors focus-visible:shadow-ring ${
                    sort === key ? 'border-ink bg-ink text-paper' : 'border-rule bg-paper text-ink-soft hover:bg-quiet'}`}>
                  {label}
                </button>
              ))}
            </div>
          }
        />

        {targetError && <div role="status" className="mb-4 rounded-card bg-quiet p-4 text-[14px] text-ink-soft">{targetError}<button type="button" onClick={() => void load(sort)} className="block min-h-11 underline">다시 불러오기</button></div>}
        {loadError ? (
          <div role="alert" className="py-10 text-center text-[14px] text-ink-soft"><p>{loadError}</p><button type="button" onClick={() => void load(sort)} className="mt-3 min-h-11 px-4 underline">다시 불러오기</button></div>
        ) : loading ? (
          <p className="py-12 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : feed.length === 0 && sort === 'walk' ? (
          <button
            onClick={openComposer}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-12 text-center focus:outline-none focus-visible:shadow-ring"
          >
            <p className="text-[14px] font-semibold text-ink">아직 같이 걸은 이야기가 없어요</p>
            <p className="text-[12.5px] text-ink-faint mt-1.5">사진과 함께 '같이 걸은 친구'를 골라 남겨보세요</p>
          </button>
        ) : feed.length === 0 && sort === 'friends' ? (
          <button
            onClick={() => navigate('/app/friends')}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-12 text-center focus:outline-none focus-visible:shadow-ring"
          >
            <p className="text-[14px] font-semibold text-ink">아직 친구의 이야기가 없어요</p>
            <p className="text-[12.5px] text-ink-faint mt-1.5">이름 옆 '친구 신청'으로 친구를 맺어보세요</p>
          </button>
        ) : feed.length === 0 ? (
          <button
            onClick={openComposer}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-12 text-center focus:outline-none focus-visible:shadow-ring"
          >
            <p className="text-[14px] font-semibold text-ink">아직 아무도 오늘을 남기지 않았어요</p>
            <p className="text-[12.5px] text-ink-faint mt-1.5">첫 이야기의 주인공이 되어주세요</p>
          </button>
        ) : (
          <ul className="divide-y divide-rule border-t border-rule">
            {feed.map((d) => {
              const imgs = d.images ?? []
              return (
                <li key={d.id} id={`diary-${d.id}`} className={`scroll-mt-20 py-5 transition-colors ${focusId === d.id ? 'bg-quiet/40' : 'bg-paper'}`}>
                  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-quiet text-[16px] font-bold text-ink">{maskName(d.nickname)[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {/* 친구끼리는 이름을 그대로 보고, 이름을 누르면 그 사람의 이야기로 간다. */}
                        <button type="button" onClick={() => navigate(`/app/people/${d.user_id}`)}
                          className="min-h-11 min-w-0 truncate text-left text-[14px] font-bold text-ink focus-visible:shadow-ring">
                          {friendOf[d.user_id] === 'friends' ? (d.nickname ?? '익명') : maskName(d.nickname)}
                        </button>
                        <PetAvatars pets={d.pets} />
                      </div>
                      <p className="-mt-1 text-[12px] text-ink-soft">{timeAgo(d.created_at)}</p>
                    </div>
                    {!d.is_mine && loggedIn && (
                      <FriendButton userId={d.user_id} status={friendOf[d.user_id] ?? 'none'} loggedIn={!!loggedIn}
                        onChange={(next) => setFriendOf((prev) => ({ ...prev, [d.user_id]: next }))} onNotice={showToast} />
                    )}
                  </div>
                  {/* 사진은 작성자 아래, 본문 앞에 놓는다. */}
                  {imgs.length > 0 && (
                    <div className={`mb-4 grid gap-0.5 overflow-hidden rounded-xl ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {imgs.slice(0, 4).map((src, i) => (
                        <button
                          type="button"
                          key={`${src}-${i}`}
                          onClick={() => setViewer({ images: imgs, index: i })}
                          aria-label={`사진 ${i + 1} 크게 보기`}
                          className={`bg-quiet overflow-hidden focus:outline-none focus-visible:shadow-ring ${
                            imgs.length === 1 ? 'aspect-[4/3]' : 'aspect-square'
                          } ${imgs.length === 3 && i === 0 ? 'col-span-2 aspect-[2/1]' : ''}`}
                        >
                          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 영상 — 사진 아래, 누르면 재생(자동재생 없음) */}
                  {d.video_url && (
                    <video src={d.video_url} controls playsInline preload="metadata" className="w-full max-h-[420px] bg-ink" />
                  )}

                  <div>
                    <p className={`text-[16px] text-ink whitespace-pre-wrap break-words leading-[1.8] ${expanded.has(d.id) ? '' : 'line-clamp-4'}`}>
                      {d.content}
                    </p>
                    <button type="button" aria-expanded={expanded.has(d.id)} onClick={() => setExpanded(prev => { const next = new Set(prev); if (next.has(d.id)) next.delete(d.id); else next.add(d.id); return next })} className="min-h-11 text-[13px] text-ink-soft underline underline-offset-4">{expanded.has(d.id) ? '접기' : '이야기 전체 읽기'}</button>

                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 max-w-full">
                        {petWalkLabel(d.pets, d.steps) ? (
                          <span className="text-[12px] text-ink-soft tabular-nums">🐾 {petWalkLabel(d.pets, d.steps)}</span>
                        ) : d.steps != null && d.steps > 0 && (
                          <span className="text-[12px] text-ink-soft tabular-nums">🚶 {d.steps.toLocaleString('ko-KR')}보</span>
                        )}
                      </div>
                      {/* 하트 · 말풍선 · (내 글이면) 수정 삭제 — 한 줄에 나란히(2026-09-11 대표님 "깔끔하게") */}
                      <div className="ml-auto flex flex-wrap items-center gap-1 -mr-2">
                        <LikeButton
                          liked={d.liked_by_me}
                          count={d.like_count}
                          loggedIn={!!loggedIn}
                          disabled={d.is_mine}
                          onToggle={async () => {
                            const res = await toggleDiaryLike(d.id)
                            if (res) setFeed((prev) => prev.map((x) => (x.id === d.id ? { ...x, liked_by_me: res.liked, like_count: res.like_count } : x)))
                            return res
                          }}
                        />
                        <CommentToggle count={d.comment_count} open={openComments.has(d.id)} onClick={() => toggleComments(d.id)} />
                        {d.is_mine && (
                          <>
                            <button onClick={() => navigate(`/app/diary/write?id=${d.id}`)} className="min-h-11 min-w-11 rounded-control text-[13px] text-ink-soft px-2 focus-visible:shadow-ring">수정</button>
                            <button onClick={() => void onDelete(d)} className="min-h-11 min-w-11 rounded-control text-[13px] text-ink-soft px-2 focus-visible:shadow-ring">삭제</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 내 글 — 누르는 버튼 대신 받은 마음만 읽는다(2026-09-11) */}
                    {d.is_mine && (
                      <div className="mt-2">
                        <ReactionSummary counts={d} />
                      </div>
                    )}

                    {/* 공감 — 내 글에는 띄우지 않는다(셀프 공감은 적립도 안 되고 의미도 없다) */}
                    {!d.is_mine && (
                      <div className="mt-2">
                        <ReactionBar
                          target="diary"
                          targetId={d.id}
                          counts={d}
                          loggedIn={!!loggedIn}
                          size="sm"
                          onChange={(next) => onReacted(d.id, next)}
                          onAward={(p) => showToast(`${p}P를 받았어요`)}
                        />
                      </div>
                    )}

                    {/* 댓글 — 내 글에도 달린다(글쓴이가 답을 해야 대화가 된다) */}
                    <DiaryComments
                      diaryId={d.id}
                      focusCommentId={targetId === d.id ? targetComment : undefined}
                      open={openComments.has(d.id)}
                      count={d.comment_count}
                      loggedIn={!!loggedIn}
                      onCountChange={(n) => setFeed((prev) => prev.map((x) =>
                        (x.id === d.id ? { ...x, comment_count: n } : x)))}
                      onAward={(p) => showToast(`${p}P를 받았어요`)}
                      onNotice={showToast}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2.5rem)] px-5 py-3 rounded-full bg-ink text-paper text-[14px]">
          {toast}
        </div>
      )}

      {viewer && <Lightbox images={viewer.images} index={viewer.index} onClose={() => setViewer(null)} />}
    </AppFrame>
  )
}
