import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// 하트(좋아요) — 대표님 지시 "좋아요 하트도 만들어". (2026-09-11)
// 공감 3종(토닥토닥·나도 그래요·응원해요)은 마음을 고르는 것, 하트는 한 번 누르는 가벼운 표시.
// 하트 자체는 항상 보이고, 숫자만 있을 때 붙는다. 등수·정렬엔 쓰지 않는다. 포인트도 없다(누르기 쉬운 만큼 어뷰징도 쉽다).
// 내 글에는 누를 수 없고(빈 하트 그대로) 받은 개수만 붙는다.

interface Props {
  liked: boolean
  count: number
  loggedIn: boolean
  disabled?: boolean            // 내 글 — 누르지 못하고 개수만
  onToggle: () => Promise<{ liked: boolean; like_count: number } | null>
  size?: 'sm' | 'md'
}

export default function LikeButton({ liked, count, loggedIn, disabled, onToggle, size = 'sm' }: Props) {
  const navigate = useNavigate()
  const [view, setView] = useState({ liked, count })
  const [seen, setSeen] = useState({ liked, count })
  const [busy, setBusy] = useState(false)
  // 부모가 새 값을 내려주면(목록 재조회) 그걸로 맞춘다
  if (seen.liked !== liked || seen.count !== count) { setSeen({ liked, count }); setView({ liked, count }) }

  const press = async () => {
    if (disabled) return
    if (!loggedIn) { navigate('/app/login'); return }
    if (busy) return
    const before = view
    setView({ liked: !before.liked, count: Math.max(0, before.count + (before.liked ? -1 : 1)) })
    setBusy(true)
    const res = await onToggle()
    setBusy(false)
    if (res) setView({ liked: res.liked, count: res.like_count })
    else setView(before)
  }

  const iconSize = size === 'sm' ? 18 : 22
  // 하트는 항상 보인다 — 내 글이라도 빈 하트를 그대로 둔다(2026-09-11 대표님 "댓글 좋아요가 없어졌는데" 지적 → 0개 숨김 규칙 삭제)

  return (
    <button
      type="button"
      onClick={() => void press()}
      disabled={disabled}
      aria-pressed={view.liked}
      aria-label={view.liked ? '하트 취소' : '하트'}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] transition-colors focus:outline-none focus-visible:shadow-ring ${
        view.liked ? 'text-brand-pink' : 'text-ink-soft'
      } ${disabled ? 'cursor-default' : 'hover:bg-quiet'}`}
    >
      <svg
        viewBox="0 0 24 24" width={iconSize} height={iconSize}
        fill={view.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.5 5 6.8 5c1.9 0 3.4 1 4.2 2.5C11.8 6 13.3 5 15.2 5c3.3 0 5.3 3.2 4.1 6.3C17.5 15.9 12 20.5 12 20.5z" />
      </svg>
      {view.count > 0 && <span className="tabular-nums">{view.count}</span>}
    </button>
  )
}
