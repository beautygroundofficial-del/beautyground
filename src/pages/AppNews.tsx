import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { REACTION_META } from '../lib/dailyQuestion'
import { getMyNews, markNewsSeen, type NewsItem } from '../lib/board'

// 새 소식 — 내 글(하루 이야기·속 이야기)에 누가 마음을 남겼는지. (2026-09-10, 커뮤니티 로드맵 4-4 ③)
// 재촉하지 않는다: 들어오면 전부 읽은 것으로 치고, 푸시도 보내지 않는다.
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

// 공감은 닉네임이 없어 "누군가"로 — 조사가 달라져서 이름이 있을 때만 "님이"를 붙인다.
// 이름 부분만 따로 돌려줘서 화면에서 그 사람 페이지로 이어지게 한다(2026-09-12).
function headline(n: NewsItem): { who: string; rest: string; linkable: boolean } {
  const who = n.actor_nickname ? `${maskName(n.actor_nickname)}님이` : '누군가'
  const linkable = !!n.actor_nickname && !!n.actor_user_id
  if (n.kind.endsWith('_comment')) return { who, rest: ' 댓글을 남겼어요', linkable }
  const meta = REACTION_META.find((r) => r.kind === n.reaction_kind)
  return { who, rest: meta ? ` ${meta.emoji} ${meta.label}${objectParticle(meta.label)} 눌렀어요` : ' 마음을 남겼어요', linkable }
}

export default function AppNews() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [items, setItems] = useState<NewsItem[] | null>(null)

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setLoggedIn(!!session)
      if (!session) { setItems([]); return }
      const rows = await getMyNews(50)
      setItems(rows)
      // 목록을 본 시점을 기록 — 다음에 들어오면 그 뒤에 온 것만 '새로' 표시된다
      void markNewsSeen()
    })()
  }, [])

  const open = (n: NewsItem) => {
    // 오늘의 질문 답은 홈 카드 안에 있다(전용 화면 없음)
    if (n.target_type === 'board') navigate(`/app/board/${n.target_id}`)
    else if (n.target_type === 'answer') navigate('/app/home')
    else navigate('/app/diary', { state: { focus: n.target_id, ...(n.kind === 'diary_comment' ? { openComments: n.target_id } : {}) } })
  }
  const sourceLabel = (t: NewsItem['target_type']) =>
    t === 'board' ? '속 이야기' : t === 'answer' ? '오늘의 질문' : '하루 이야기'

  return (
    <AppFrame>
      <BackHeader title="새 소식" onBack={() => navigate('/app/mypage')} />

      <section className="px-5 pt-5 pb-28">
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
        ) : items === null ? (
          <p className="py-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : items.length === 0 ? (
          <div className="rounded-card bg-quiet px-5 py-10 text-center">
            <p className="text-[14px] text-ink-soft mb-1">아직 온 소식이 없어요</p>
            <p className="text-[12.5px] text-ink-faint">이야기를 남기면 누군가의 마음이 여기로 와요</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map((n, i) => (
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
                    <p className="text-[13.5px] font-semibold text-ink truncate">
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
                    <p className="text-[13px] text-ink mt-1.5 line-clamp-2">"{n.comment_text}"</p>
                  )}
                  <p className="text-[12px] text-ink-faint mt-1.5 truncate">
                    {sourceLabel(n.target_type)} · {n.excerpt}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppFrame>
  )
}
