import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  REACTION_META, setReaction,
  type ReactionCounts, type ReactionKind, type ReactionTarget,
} from '../../lib/dailyQuestion'

// 토닥토닥 / 나도 그래요 / 응원해요 — 좋아요(평가)를 대신하는 공감 표시. (2026-09-07)
//
// 좋아요는 '잘 쓴 글'을 고르는 평가라서 등수가 생기고, 등수가 생기면 커뮤니티가 경쟁이 된다.
// 대표님 지시("놀고 쉬는 곳")에 맞춰 평가 대신 마음을 전하는 쪽으로 바꾼다.
//
// 숫자는 0이면 아예 감춘다 — 반응이 없는 글에 "0"이 붙어 있으면 그게 곧 성적표가 된다.

interface Props {
  target: ReactionTarget
  targetId: string
  counts: ReactionCounts
  loggedIn: boolean
  size?: 'sm' | 'md'
  onChange?: (next: ReactionCounts) => void
  // 포인트를 받았을 때만 부른다 — 버튼에 "N P" 를 써 붙이지 않고, 누른 뒤에 조용히 알린다.
  onAward?: (points: number) => void
}

export default function ReactionBar({
  target, targetId, counts, loggedIn, size = 'md', onChange, onAward,
}: Props) {
  const navigate = useNavigate()

  // 누른 결과를 이 컴포넌트가 직접 들고 있는다. 부모가 목록을 다시 불러오면 컴포넌트가
  // 새로 만들어지거나(키가 바뀜) 아래 targetId 비교로 다시 맞춰진다.
  const [view, setView] = useState<ReactionCounts>(counts)
  const [seenId, setSeenId] = useState(targetId)
  const [busy, setBusy] = useState(false)
  if (seenId !== targetId) { setSeenId(targetId); setView(counts) }

  const press = async (kind: ReactionKind) => {
    if (!loggedIn) { navigate('/app/login'); return }
    if (busy) return

    // 응답을 기다리는 동안 먼저 눌린 것처럼 보여준다(느린 네트워크에서도 반응이 있게).
    const before = view
    const next: ReactionCounts = { ...before, my_kind: before.my_kind === kind ? null : kind }
    if (before.my_kind) next[before.my_kind] = Math.max(0, next[before.my_kind] - 1)
    if (before.my_kind !== kind) next[kind] = next[kind] + 1
    setView(next)
    setBusy(true)

    const res = await setReaction(target, targetId, kind)
    setBusy(false)
    if (res) {
      setView(res)
      onChange?.(res)
      if (res.awarded > 0) onAward?.(res.awarded)
    } else {
      setView(before) // 실패하면 누르기 전으로 되돌린다
    }
  }

  const pad = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5'
  const font = size === 'sm' ? 'text-[11.5px]' : 'text-[12.5px]'

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {REACTION_META.map(({ kind, label, emoji }) => {
        const on = view.my_kind === kind
        const n = view[kind]
        return (
          <button
            key={kind}
            type="button"
            onClick={() => void press(kind)}
            aria-pressed={on}
            className={`inline-flex items-center gap-1 rounded-full border transition-colors focus:outline-none focus-visible:shadow-ring ${pad} ${font} ${
              on
                ? 'bg-ink text-paper border-ink font-semibold'
                : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
            <span>{label}</span>
            {n > 0 && <span className="tabular-nums opacity-70">{n}</span>}
          </button>
        )
      })}
    </div>
  )
}
