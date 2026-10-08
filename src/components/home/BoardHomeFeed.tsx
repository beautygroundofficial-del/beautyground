import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { categoryLabel, getBoardFeed, type BoardPost, type BoardCategory } from '../../lib/board'
import { MetaMarks } from '../community/marks'
import StoryMediaPreview from './StoryMediaPreview'

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

export default function BoardHomeFeed({ category = null }: { category?: BoardCategory | null }) {
  const navigate = useNavigate()
  const [feed, setFeed] = useState<BoardPost[] | null>(null)

  useEffect(() => {
    let active = true
    setFeed(null)
    void getBoardFeed(category ? [category] : [], 3).then((rows) => { if (active) setFeed(rows) })
    return () => { active = false }
  }, [category])
  const goBoard = () => navigate('/app/board', { state: category ? { category } : undefined })

  return (
    <section className="px-5 pt-6">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-[12px] text-ink-soft leading-relaxed mb-1">{category ? '선택한 주제의 최신 글' : '여러 주제에서 나누는 솔직한 이야기'}</p>
          <h3 className="text-[17px] font-bold text-ink leading-[1.6]">{category ? categoryLabel(category) : '지금 나누는 이야기'}</h3>
        </div>
        {feed && feed.length > 0 && (
          <button
            onClick={goBoard}
            className="min-h-11 min-w-11 shrink-0 text-[13px] font-medium text-ink-soft focus:outline-none focus-visible:shadow-ring"
          >
            더보기
          </button>
        )}
      </div>

      {feed === null ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-card border border-rule bg-paper p-5 space-y-3">
              <div className="h-3 w-1/3 bg-quiet rounded animate-pulse" />
              <div className="h-3 bg-quiet rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : feed.length === 0 ? (
        <button
          onClick={goBoard}
          className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-8 text-center focus:outline-none focus-visible:shadow-ring"
        >
          <p className="text-[16px] font-semibold text-ink leading-[1.8]">{category ? '이 주제에 첫 이야기를 남겨보세요' : '말 못 하고 지나온 일이 있나요'}</p>
          <p className="text-[14px] text-ink-soft leading-[1.8] mt-2">여기선 이름을 가리고 털어놓을 수 있어요</p>
        </button>
      ) : (
        <ul className="space-y-3">
          {feed.map((p) => (
            <li key={p.id}>
              <Link
                to={`/app/board/${p.id}`}
                className="block rounded-card border border-rule bg-paper px-5 py-4 focus:outline-none focus-visible:shadow-ring"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[12px] font-semibold text-ink-soft bg-quiet rounded-full px-2.5 py-1 leading-relaxed">
                    {categoryLabel(p.category)}
                  </span>
                  <span className="text-[12px] text-ink-soft">{timeAgo(p.created_at)}</span>
                  <span className="ml-auto"><MetaMarks likes={p.like_count ?? 0} comments={p.comment_count} size={15} /></span>
                </div>
                <p className="text-[15px] text-ink leading-[1.8] line-clamp-3 whitespace-pre-wrap break-words">{p.content.replace(/https?:\/\/[^\s<>]+/g, '').trim() || '공유한 링크를 확인해보세요.'}</p>
                <StoryMediaPreview content={p.content} images={p.images} videoUrl={p.video_url} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
