import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { REACTION_META } from '../lib/dailyQuestion'
import { conversationNewsPath, getConversationNews, markConversationNewsSeen, type ConversationNews } from '../lib/communityConversations'
import { FRIENDS_CHANGED_EVENT } from '../lib/friends'

// 새 소식 — 내 글(하루 이야기·속 이야기)에 누가 마음을 남겼는지. (2026-09-10, 커뮤니티 로드맵 4-4 ③)
// 읽음은 사용자가 확인한 뒤 처리한다. 목록을 불러온 이후에 도착한 소식은 남겨둔다.
// 이름은 다른 화면과 같이 가려서 보이고, 공감은 닉네임이 없어 "누군가"로 쓴다.

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
  if (!n) return '누군가'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

// 받침이 있으면 "을", 없으면 "를" — "토닥토닥를"처럼 어색해지지 않게 (2026-09-11)
function objectParticle(word: string) {
  const last = word.charCodeAt(word.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return '를'
  return (last - 0xac00) % 28 === 0 ? '를' : '을'
}

// 공감·하트는 닉네임이 없어 "누군가"로 — 조사가 달라져서 이름이 있을 때만 "님이"를 붙인다.
// 이름 부분만 따로 돌려줘서 화면에서 그 사람 페이지로 이어지게 한다(2026-09-12).
// 하트(*_like)는 공감과 같은 익명 표시, 친구신청 수락(friend_accept)은 이름이 있어 linkable (2026-09-16).
function headline(n: ConversationNews): { who: string; rest: string; linkable: boolean } {
  const who = n.actor_nickname ? `${maskName(n.actor_nickname)}님이` : '누군가'
  const linkable = !!n.actor_nickname && !!n.actor_user_id && (n.target_type === 'diary' || n.target_type === 'friend')
  if (n.kind === 'friend_request') return { who, rest: ' 친구 신청을 보냈어요', linkable }
  if (n.kind === 'friend_accept') return { who, rest: ' 친구 신청을 받아줬어요', linkable }
  if (n.kind === 'diary_reply') return { who, rest: ' 내 댓글에 답글을 남겼어요', linkable }
  if (n.kind.endsWith('_comment')) return { who, rest: ' 댓글을 남겼어요', linkable }
  if (n.kind.endsWith('_like')) return { who, rest: ' ♥ 하트를 눌렀어요', linkable }
  const meta = REACTION_META.find((r) => r.kind === n.reaction_kind)
  return { who, rest: meta ? ` ${meta.emoji} ${meta.label}${objectParticle(meta.label)} 눌렀어요` : ' 마음을 남겼어요', linkable }
}

export default function AppNews() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [items, setItems] = useState<ConversationNews[] | null>(null)
  const [error, setError] = useState('')
  const [limit, setLimit] = useState(50)
  const [marking, setMarking] = useState(false)
  const [loading, setLoading] = useState(false)
  const version = useRef(0)

  const load = useCallback(async () => {
    const current = ++version.current
    setLoading(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (current !== version.current) return
      setLoggedIn(!!session)
      if (!session) { setItems([]); return }
      const rows = await getConversationNews(limit)
      if (current !== version.current) return
      setItems(rows)
    } catch { if (current === version.current) setError('새 소식을 불러오지 못했어요. 다시 시도해 주세요.') }
    finally { if (current === version.current) setLoading(false) }
  }, [limit])
  useEffect(() => {
    void load()
    const refresh = () => { void load() }
    window.addEventListener('focus', refresh)
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh)
    return () => { version.current++; window.removeEventListener('focus', refresh); window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh) }
  }, [load])

  const markSeen = async () => {
    if (marking || loading || !items?.length) return
    setMarking(true); setError('')
    const seenAt = items[0].created_at
    try {
      await markConversationNewsSeen(seenAt)
      // 서버의 정밀한 시각으로 다시 판정하고, 저장 전 시작한 조회 결과는 무효화한다.
      await load()
    } catch { setError('읽음 표시를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.') }
    finally { setMarking(false) }
  }

  const open = (n: ConversationNews) => navigate(conversationNewsPath(n))
  const sourceLabel = (t: ConversationNews['target_type']) =>
    t === 'board' ? '속 이야기' : t === 'answer' ? '오늘의 질문' : t === 'friend' ? '친구' : '하루 이야기'

  return (
    <AppFrame>
      <BackHeader title="새 소식" onBack={() => navigate('/app/home')} rightElement={<button type="button" onClick={() => navigate('/app/friends')} className="min-h-11 px-2 text-[13px] font-semibold">친구 신청</button>} />

      <section className="px-5 pt-5 pb-28">
        {loggedIn && <div className="mb-4 flex items-center justify-between gap-2"><button type="button" disabled={loading || marking} onClick={() => void load()} className="min-h-11 text-[13px] underline disabled:opacity-50">{loading ? '확인 중…' : '새로 확인'}</button>{items?.some(item => item.is_new) && <button type="button" disabled={marking || loading} onClick={() => void markSeen()} className="min-h-11 text-[13px] text-ink-soft underline disabled:opacity-50">{marking ? '저장 중…' : '모두 확인했어요'}</button>}</div>}
        {error && <div role="alert" className="mb-4 rounded-card bg-quiet p-4 text-[14px] text-ink-soft"><p>{error}</p><button type="button" onClick={() => void load()} className="min-h-11 underline">다시 불러오기</button></div>}
        {loggedIn === false ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-ink-soft mb-4">로그인하면 내 글에 온 마음을 볼 수 있어요</p>
            <button
              onClick={() => navigate('/app/login', { state: { from: '/app/news' } })}
              className="rounded-control bg-ink text-paper font-bold text-[14px] px-6 py-3 focus:outline-none focus-visible:shadow-ring"
            >
              로그인
            </button>
          </div>
        ) : items === null && !error ? (
          <p className="py-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : items?.length === 0 && !error ? (
          <div className="rounded-card bg-quiet px-5 py-10 text-center">
            <p className="text-[14px] text-ink-soft mb-1">아직 온 소식이 없어요</p>
            <p className="text-[12.5px] text-ink-faint">이야기를 남기면 누군가의 마음이 여기로 와요</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {(items ?? []).map((n, i) => (
              <li key={`${n.kind}-${n.target_id}-${n.created_at}-${i}`}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  className={`w-full text-left rounded-card border px-4 py-3.5 focus:outline-none focus-visible:shadow-ring ${
                    n.is_new ? 'border-ink bg-paper' : 'border-rule bg-paper'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {n.is_new && <span className="w-1.5 h-1.5 rounded-full bg-brand-pink shrink-0" aria-label="새 소식" />}
                    <p className="min-w-0 text-[15px] font-semibold text-ink leading-relaxed break-words">
                      {(() => { const h = headline(n); return h.linkable ? (
                        <>
                          <span role="link" tabIndex={0} className="underline underline-offset-2 decoration-rule"
                            onClick={(e) => { e.stopPropagation(); navigate(`/app/people/${n.actor_user_id}`) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); navigate(`/app/people/${n.actor_user_id}`) } }}>{h.who}</span>{h.rest}
                        </>
                      ) : h.who + h.rest })()}
                    </p>
                    <span className="ml-auto shrink-0 text-[11px] text-ink-faint">{timeAgo(n.created_at)}</span>
                  </div>
                  {n.comment_text && (
                    <p className="text-[15px] leading-relaxed text-ink mt-1.5 line-clamp-2 break-words">"{n.comment_text}"</p>
                  )}
                  {n.excerpt && (
                    <p className="text-[12px] text-ink-faint mt-1.5 truncate">
                      {sourceLabel(n.target_type)} · {n.excerpt}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {items && items.length >= limit && limit < 500 && <button type="button" disabled={loading} onClick={() => setLimit(n => Math.min(n + 50, 500))} className="mt-4 min-h-11 w-full rounded-control border border-rule text-[14px]">이전 소식 더 보기</button>}
      </section>
    </AppFrame>
  )
}
