import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryLabel, getBoardFeed, type BoardPost } from '../../lib/board'

// 홈 ↔ 속 이야기 연결 (2026-09-10, 커뮤니티 로드맵 4-4 ①)
// 홈에 최신 속 이야기 3개를 얇게 보여주고 누르면 글로 들어간다. 사진 없이 글만 — 하루 이야기(사진 카드)와
// 나란히 있어도 무겁지 않게. 숫자는 0이면 감춘다(기존 원칙).

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

export default function BoardHomeFeed() {
  const navigate = useNavigate()
  const [feed, setFeed] = useState<BoardPost[] | null>(null)

  useEffect(() => {
    let active = true
    void getBoardFeed([], 3).then((rows) => { if (active) setFeed(rows) })
    return () => { active = false }
  }, [])

  return (
    <section className="px-5 pt-8">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">속마음을 꺼내놓는 곳</p>
          <h2 className="text-[17px] font-bold text-ink leading-tight">속 이야기</h2>
        </div>
        {feed && feed.length > 0 && (
          <button
            onClick={() => navigate('/app/board')}
            className="shrink-0 text-[12px] text-ink-soft focus:outline-none focus-visible:shadow-ring"
          >
            더보기
          </button>
        )}
      </div>

      {feed === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-card border border-rule p-4 space-y-2">
              <div className="h-3 w-1/3 bg-quiet rounded animate-pulse" />
              <div className="h-3 bg-quiet rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : feed.length === 0 ? (
        <button
          onClick={() => navigate('/app/board')}
          className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-8 text-center focus:outline-none focus-visible:shadow-ring"
        >
          <p className="text-[14px] font-semibold text-ink">말 못 하고 지나온 일이 있나요</p>
          <p className="text-[12.5px] text-ink-faint mt-1.5">여기선 이름을 가리고 털어놓을 수 있어요</p>
        </button>
      ) : (
        <ul className="space-y-2">
          {feed.map((p) => {
            const reactions = p.pat + p.same + p.cheer
            return (
              <li key={p.id}>
                <Link
                  to={`/app/board/${p.id}`}
                  className="block rounded-card border border-rule bg-paper px-4 py-3.5 focus:outline-none focus-visible:shadow-ring"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-semibold text-ink-soft bg-quiet rounded-full px-2 py-0.5">
                      {categoryLabel(p.category)}
                    </span>
                    <span className="text-[11px] text-ink-faint">{timeAgo(p.created_at)}</span>
                    {(reactions > 0 || p.comment_count > 0) && (
                      <span className="ml-auto text-[11px] text-ink-faint tabular-nums">
                        {reactions > 0 && `🤍 ${reactions}`}
                        {reactions > 0 && p.comment_count > 0 && ' · '}
                        {p.comment_count > 0 && `댓글 ${p.comment_count}`}
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] text-ink leading-relaxed line-clamp-2 whitespace-pre-wrap">{p.content}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
