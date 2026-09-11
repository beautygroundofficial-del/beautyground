import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { getUserProfile, getUserDiaries, type PersonProfile } from '../lib/people'
import { toggleDiaryLike, type Diary } from '../lib/diaries'
import { getFriendStatuses, type FriendStatus } from '../lib/friends'
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
  const [loggedIn, setLoggedIn] = useState(false)
  const [profile, setProfile] = useState<PersonProfile | null | undefined>(undefined)
  const [feed, setFeed] = useState<Diary[]>([])
  const [friend, setFriend] = useState<FriendStatus>('none')
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!alive) return
      setLoggedIn(!!session)
      const [p, rows] = await Promise.all([getUserProfile(id), getUserDiaries(id, 30)])
      if (!alive) return
      setProfile(p)
      setFeed(rows)
      if (session && p && !p.is_me) setFriend((await getFriendStatuses([id]))[id] ?? 'none')
    })()
    return () => { alive = false }
  }, [id])

  const name = profile ? (friend === 'friends' || profile.is_me ? (profile.nickname ?? '익명') : maskName(profile.nickname)) : ''

  return (
    <AppFrame>
      <BackHeader title="그 사람의 이야기" onBack={() => navigate(-1)} />

      {profile === undefined ? (
        <p className="py-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
      ) : profile === null ? (
        <p className="py-16 text-center text-[13px] text-ink-faint">찾을 수 없는 사람이에요</p>
      ) : (
        <>
          {/* 사람 */}
          <section className="px-5 pt-6 pb-5 border-b border-rule">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-[20px] font-bold text-ink leading-tight truncate">{name}</h1>
                <p className="text-[12.5px] text-ink-faint mt-1.5">
                  {[
                    sinceLabel(profile.since) ? `함께한 지 ${sinceLabel(profile.since)}` : null,
                    profile.diary_count > 0 ? `이야기 ${profile.diary_count}개` : null,
                  ].filter(Boolean).join(' · ') || '아직 남긴 이야기가 없어요'}
                </p>
              </div>
              {profile.is_me ? (
                <button type="button" onClick={() => navigate('/app/mypage')} className="shrink-0 text-[12px] text-ink-soft rounded-control border border-rule px-3 py-1.5">마이페이지</button>
              ) : loggedIn ? (
                <div className="shrink-0 scale-110 origin-right">
                  <FriendButton userId={id} status={friend} loggedIn={loggedIn} onChange={setFriend} onNotice={showToast} />
                </div>
              ) : null}
            </div>

            {/* 펫 — 이 사람과 사는 친구들 */}
            {profile.pets.length > 0 && (
              <div className="flex items-center gap-3 mt-4 overflow-x-auto scrollbar-hide">
                {profile.pets.map((p) => (
                  <div key={p.id} className="flex flex-col items-center shrink-0 w-14">
                    <span className="w-12 h-12 rounded-full bg-quiet overflow-hidden flex items-center justify-center">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-[22px]" aria-hidden="true">{petEmoji(p.kind)}</span>}
                    </span>
                    <span className="text-[11px] text-ink-soft mt-1 truncate w-full text-center">{p.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 그 사람의 하루 이야기 */}
          <section className="px-5 pt-5 pb-28">
            {feed.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-faint">아직 남긴 하루 이야기가 없어요</p>
            ) : (
              <ul className="space-y-4">
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
                        <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed line-clamp-4">{d.content}</p>
                        <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-rule">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11.5px] text-ink-faint shrink-0">{timeAgo(d.created_at)}</span>
                            {walk ? <span className="text-[11.5px] text-ink-soft shrink-0 tabular-nums">🐾 {walk}</span>
                              : d.steps != null && d.steps > 0 && <span className="text-[11.5px] text-ink-soft shrink-0 tabular-nums">🚶 {d.steps.toLocaleString('ko-KR')}보</span>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 -mr-2">
                            <LikeButton liked={d.liked_by_me} count={d.like_count} loggedIn={loggedIn} disabled={d.is_mine}
                              onToggle={async () => {
                                const res = await toggleDiaryLike(d.id)
                                if (res) setFeed((prev) => prev.map((x) => (x.id === d.id ? { ...x, liked_by_me: res.liked, like_count: res.like_count } : x)))
                                return res
                              }} />
                            {/* 댓글은 이야기 화면에서 — 그 글을 펼친 채로 이동 */}
                            <CommentToggle count={d.comment_count} open={false} onClick={() => navigate('/app/diary', { state: { openComments: d.id, focus: d.id } })} />
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

      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>}
      {viewer && <Lightbox images={viewer.images} index={viewer.index} onClose={() => setViewer(null)} />}
    </AppFrame>
  )
}
