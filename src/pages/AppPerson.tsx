import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { getUserProfile, getUserDiaries, type PersonProfile } from '../lib/people'
import { toggleDiaryLike, type Diary } from '../lib/diaries'
import { FRIENDS_CHANGED_EVENT, getFriendStatuses, type FriendStatus } from '../lib/friends'
import { petEmoji } from '../lib/pets'
import FriendButton from '../components/community/FriendButton'
import LikeButton from '../components/community/LikeButton'
import { CommentToggle } from '../components/community/DiaryComments'
import { petWalkLabel } from '../components/community/PetMarks'
import Lightbox from '../components/community/Lightbox'

// 그 사람의 이야기 — 카드의 닉네임·친구 목록에서 온다. (2026-09-12, 커뮤니티 로드맵 4-10 A1)
// 위: 이름(친구면 그대로, 아니면 가림)·함께한 지·이야기 수·펫 얼굴·친구 버튼. 아래: 그 사람의 하루 이야기.
// 속 이야기(익명)는 여기 안 나온다. 등수·비교 없음.

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
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

function sinceLabel(iso: string | null) {
  if (!iso) return null
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 1) return '오늘부터'
  if (days < 30) return `${days}일째`
  if (days < 365) return `${Math.floor(days / 30)}개월째`
  return `${Math.floor(days / 365)}년째`
}

export default function AppPerson() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined)
  const loggedIn = !!viewerId
  const [profile, setProfile] = useState<PersonProfile | null | undefined>(undefined)
  const [feed, setFeed] = useState<Diary[]>([])
  const [friend, setFriend] = useState<FriendStatus>('none')
  const [friendLoading, setFriendLoading] = useState(true)
  const [friendError, setFriendError] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => setToast(m)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    let alive = true
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive) setViewerId(session?.user.id ?? null)
    }).catch(() => {
      if (alive) { setViewerId(null); setLoadError('로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.') }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setViewerId(session?.user.id ?? null)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    let alive = true
    setProfile(undefined)
    setFeed([])
    setViewer(null)
    setLoadError('')
    if (viewerId === undefined) return
    void (async () => {
      try {
        const [p, rows] = await Promise.all([getUserProfile(id), getUserDiaries(id, 30)])
        if (!alive) return
        setProfile(p)
        setFeed(rows)
      } catch {
        if (alive) setLoadError('이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    })()
    return () => { alive = false }
  }, [id, viewerId, refreshVersion])

  useEffect(() => {
    let alive = true
    let requestVersion = 0
    setFriend('none')
    setFriendError('')
    const refresh = async () => {
      const version = ++requestVersion
      if (!viewerId || viewerId === id) { setFriendLoading(false); return }
      setFriendLoading(true)
      try {
        const next = (await getFriendStatuses([id], { throwOnError: true }))[id] ?? 'none'
        if (!alive || version !== requestVersion) return
        setFriend(next)
        setFriendError('')
      } catch {
        if (alive && version === requestVersion) setFriendError('친구 상태를 확인하지 못했어요')
      } finally {
        if (alive && version === requestVersion) setFriendLoading(false)
      }
    }
    void refresh()
    const onRefresh = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', onRefresh)
    document.addEventListener('visibilitychange', onRefresh)
    window.addEventListener(FRIENDS_CHANGED_EVENT, onRefresh)
    return () => {
      alive = false
      window.removeEventListener('focus', onRefresh)
      document.removeEventListener('visibilitychange', onRefresh)
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onRefresh)
    }
  }, [id, viewerId, refreshVersion])

  const name = profile ? (friend === 'friends' || profile.is_me ? (profile.nickname ?? '익명') : maskName(profile.nickname)) : ''

  return (
    <AppFrame>
      <BackHeader title="그 사람의 이야기" onBack={() => {
        if (returnTo?.startsWith('/app/') && !returnTo.includes('\\')) navigate(returnTo, { replace: true })
        else navigate(-1)
      }} />

      {loadError ? (
        <div role="alert" className="py-16 px-5 text-center text-[15px] leading-[1.7] text-ink-soft"><p>{loadError}</p><button type="button" className="min-h-11 mt-3 px-3 text-[13px] underline underline-offset-4" onClick={() => setRefreshVersion(v => v + 1)}>다시 불러오기</button></div>
      ) : profile === undefined || (profile !== null && profile.user_id !== id) ? (
        <p className="py-16 px-5 text-center text-[15px] leading-[1.7] text-ink-soft">불러오는 중…</p>
      ) : profile === null ? (
        <p className="py-16 px-5 text-center text-[15px] leading-[1.7] text-ink-soft">찾을 수 없는 사람이에요</p>
      ) : (
        <>
          {/* 사람 */}
          <section className="px-5 py-6 border-b border-rule">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 basis-36">
                <h1 className="text-[20px] font-bold text-ink leading-snug break-words">{name}</h1>
                <p className="text-[13px] leading-[1.7] text-ink-soft mt-2 break-keep">
                  {[
                    sinceLabel(profile.since) ? `함께한 지 ${sinceLabel(profile.since)}` : null,
                    profile.diary_count > 0 ? `이야기 ${profile.diary_count}개` : null,
                  ].filter(Boolean).join(' · ') || '아직 남긴 이야기가 없어요'}
                </p>
              </div>
              {profile.is_me ? (
                <button type="button" onClick={() => navigate('/app/mypage')} className="min-h-11 shrink-0 text-[13px] text-ink-soft rounded-control border border-solid border-rule px-3 py-2">마이페이지</button>
              ) : (
                <div className="max-w-full shrink-0 text-right">
                  <FriendButton key={id} userId={id} status={friend} loggedIn={loggedIn} disabled={friendLoading || !!friendError}
                    onChange={setFriend} onNotice={showToast} />
                  {friendError && (
                    <button type="button" onClick={() => setRefreshVersion((v) => v + 1)} className="block min-h-11 max-w-full mt-1 text-[12px] leading-[1.7] text-ink-soft break-keep underline underline-offset-4">
                      {friendError} · 다시 시도
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 펫 — 이 사람과 사는 친구들 */}
            {profile.pets.length > 0 && (
              <div className="flex items-center gap-4 mt-6 overflow-x-auto scrollbar-hide">
                {profile.pets.map((p) => (
                  <div key={p.id} className="flex flex-col items-center shrink-0 w-14">
                    <span className="w-12 h-12 rounded-full bg-quiet overflow-hidden flex items-center justify-center">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[22px]" aria-hidden="true">{petEmoji(p.kind)}</span>}
                    </span>
                    <span className="text-[12px] leading-5 text-ink-soft mt-2 truncate w-full text-center">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 그 사람의 하루 이야기 */}
          <section className="px-5 pt-6 pb-28">
            {feed.length === 0 ? (
              <p className="rounded-card bg-quiet px-5 py-10 text-center text-[15px] leading-[1.7] text-ink-soft break-keep">아직 남긴 하루 이야기가 없어요</p>
            ) : (
              <ul className="space-y-6">
                {feed.map((d) => {
                  const imgs = d.images ?? []
                  const walk = petWalkLabel(d.pets, d.steps)
                  return (
                    <li key={d.id} className="rounded-card border border-rule bg-paper overflow-hidden">
                      {imgs.length > 0 && (
                        <div className={`grid gap-0.5 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {imgs.slice(0, 4).map((src, i) => (
                            <button type="button" key={`${src}-${i}`} onClick={() => setViewer({ images: imgs, index: i })} aria-label={`사진 ${i + 1} 크게 보기`}
                              className={`bg-quiet overflow-hidden focus:outline-none focus-visible:shadow-ring ${imgs.length === 1 ? 'aspect-[4/3]' : 'aspect-square'} ${imgs.length === 3 && i === 0 ? 'col-span-2 aspect-[2/1]' : ''}`}>
                              <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      {d.video_url && <video src={d.video_url} controls playsInline preload="metadata" className="w-full max-h-[420px] bg-ink" />}
                      <div className="p-4">
                        <p className="text-[16px] text-ink whitespace-pre-wrap leading-[1.8] line-clamp-4 break-words">{d.content}</p>
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mt-4 pt-3 border-t border-rule">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                            <span className="text-[12px] leading-5 text-ink-soft shrink-0">{timeAgo(d.created_at)}</span>
                            {walk ? <span className="text-[12px] leading-5 text-ink-soft tabular-nums break-words">🐾 {walk}</span>
                              : d.steps != null && d.steps > 0 && <span className="text-[12px] leading-5 text-ink-soft shrink-0 tabular-nums">🚶 {d.steps.toLocaleString('ko-KR')}보</span>}
                          </div>
                          <div className="ml-auto flex items-center gap-1 shrink-0 -mr-2">
                            <LikeButton liked={d.liked_by_me} count={d.like_count} loggedIn={loggedIn} disabled={d.is_mine}
                              onToggle={async () => {
                                const res = await toggleDiaryLike(d.id)
                                if (res) setFeed((prev) => prev.map((x) => (x.id === d.id ? { ...x, liked_by_me: res.liked, like_count: res.like_count } : x)))
                                return res
                              }} />
                            {/* 댓글은 이야기 화면에서 — 그 글을 펼친 채로 이동 */}
                            <CommentToggle count={d.comment_count} open={false} onClick={() => navigate(`/app/diary?focus=${encodeURIComponent(d.id)}&comments=${encodeURIComponent(d.id)}`)} />
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
      )}

      {toast && <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100%-40px)] px-4 py-3 rounded-card bg-ink text-paper text-[14px] leading-[1.7] text-center break-keep">{toast}</div>}
      {viewer && <Lightbox images={viewer.images} index={viewer.index} onClose={() => setViewer(null)} />}
    </AppFrame>
  )
}
