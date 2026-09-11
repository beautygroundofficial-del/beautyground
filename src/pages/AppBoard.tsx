import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import StoryTabs from '../components/community/StoryTabs'
import { supabase } from '../lib/supabase'
import { BOARD_CATEGORIES, categoryLabel, getBoardFeed, type BoardCategory, type BoardPost } from '../lib/board'
import { MetaMarks } from '../components/community/marks'

// 속 이야기 — 주제별로 속마음을 꺼내놓는 곳. (2026-09-10)
//
// 히로인스 게시판을 보고 대표님이 "읽을 게 너무 많고 계속 재촉해서 답답하다"고 하신 것을 그대로
// 반대로 만들었다.
//   · 카테고리는 7개, 여러 개를 동시에 고를 수 있다(빈 선택 = 전체)
//   · 정렬은 최신순만 — 인기순을 두면 순위가 생기고, 순위가 생기면 경쟁이 된다
//   · 댓글·공감 수는 0이면 감춘다 — "0"이 붙어 있으면 그게 곧 성적표다
//   · 카드에는 본문 2줄만 — 훑을 수 있게. 자세히는 눌러서 본다

function timeAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
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
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

export default function AppBoard() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [selected, setSelected] = useState<BoardCategory[]>([])
  const [feed, setFeed] = useState<BoardPost[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (cats: BoardCategory[]) => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    setLoggedIn(!!session)
    setFeed(await getBoardFeed(cats, 30))
    setLoading(false)
  }, [])

  useEffect(() => { void load(selected) }, [load, selected])

  const toggleCat = (key: BoardCategory) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const openWrite = () => {
    if (!loggedIn) { navigate('/app/login'); return }
    navigate('/app/board/write')
  }

  return (
    <AppFrame>
      <BackHeader title="이야기" onBack={() => navigate('/app/home')} />
      <StoryTabs current="/app/board" />

      {/* 카테고리 — 가로 스크롤 칩, 여러 개 동시 선택 */}
      <section className="pt-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-5 pb-1">
          <button
            type="button"
            onClick={() => setSelected([])}
            aria-pressed={selected.length === 0}
            className={`shrink-0 px-3.5 py-1.5 rounded-full border text-[12.5px] transition focus:outline-none focus-visible:shadow-ring ${
              selected.length === 0 ? 'bg-ink text-paper border-ink font-semibold' : 'bg-paper text-ink-soft border-rule'
            }`}
          >
            전체
          </button>
          {BOARD_CATEGORIES.map((c) => {
            const on = selected.includes(c.key)
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleCat(c.key)}
                aria-pressed={on}
                className={`shrink-0 px-3.5 py-1.5 rounded-full border text-[12.5px] transition focus:outline-none focus-visible:shadow-ring ${
                  on ? 'bg-ink text-paper border-ink font-semibold' : 'bg-paper text-ink-soft border-rule'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* 목록 */}
      <section className="px-5 pt-5 pb-28">
        {loading ? (
          <p className="py-12 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : feed.length === 0 ? (
          <button
            onClick={openWrite}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-12 text-center focus:outline-none focus-visible:shadow-ring"
          >
            <p className="text-[14px] font-semibold text-ink">
              {selected.length > 0 ? '이 이야기는 아직 비어 있어요' : '아직 아무도 속 이야기를 꺼내지 않았어요'}
            </p>
            <p className="text-[12.5px] text-ink-faint mt-1.5">먼저 털어놓아 주세요. 누군가 들어줄 거예요</p>
          </button>
        ) : (
          <ul className="space-y-3">
            {feed.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/app/board/${p.id}`}
                  className="block rounded-card border border-rule bg-paper p-4 focus:outline-none focus-visible:shadow-ring"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-ink-soft bg-quiet rounded-full px-2 py-0.5">
                      {categoryLabel(p.category)}
                    </span>
                    <span className="text-[11px] text-ink-faint">{timeAgo(p.created_at)}</span>
                  </div>
                  <p className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap line-clamp-2">
                    {p.content}
                  </p>
                  {/* 하루 이야기와 같은 하트·말풍선 — 목록에선 개수만, 누르는 건 글 안에서 */}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11.5px] text-ink-faint">{p.is_mine ? '나' : maskName(p.nickname)}</span>
                    <MetaMarks likes={p.like_count ?? 0} comments={p.comment_count} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 쓰기 — 화면 어디서든 닿는 자리에 */}
      <button
        type="button"
        onClick={openWrite}
        className="fixed bottom-20 right-1/2 translate-x-[calc(240px-20px)] max-md:right-5 max-md:translate-x-0 z-40 rounded-full bg-ink text-paper px-5 py-3 text-[14px] font-bold shadow-lg focus:outline-none focus-visible:shadow-ring"
      >
        ✎ 털어놓기
      </button>
    </AppFrame>
  )
}
