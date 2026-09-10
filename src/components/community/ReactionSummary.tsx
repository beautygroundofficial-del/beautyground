import { REACTION_META, type ReactionCounts } from '../../lib/dailyQuestion'

// 내 글이 받은 공감 — 누르는 버튼이 아니라 읽기만. (2026-09-11)
// 내 글엔 공감 버튼을 띄우지 않는데(셀프 공감 방지), 그러면 글쓴이는 몇 명이 토닥였는지 알 길이 없었다.
// 숫자는 0이면 감춘다(성적표가 되지 않게). 하나도 없으면 아무것도 그리지 않는다.
export default function ReactionSummary({ counts, size = 'sm' }: { counts: ReactionCounts; size?: 'sm' | 'md' }) {
  const items = REACTION_META.filter(({ kind }) => counts[kind] > 0)
  if (items.length === 0) return null
  const font = size === 'sm' ? 'text-[11.5px]' : 'text-[12.5px]'
  return (
    <div className={`flex items-center gap-2 flex-wrap ${font} text-ink-soft`}>
      <span className="text-ink-faint">받은 마음</span>
      {items.map(({ kind, label, emoji }) => (
        <span key={kind} className="inline-flex items-center gap-1 rounded-full bg-quiet px-2 py-0.5">
          <span aria-hidden="true">{emoji}</span>
          <span>{label}</span>
          <span className="tabular-nums opacity-70">{counts[kind]}</span>
        </span>
      ))}
    </div>
  )
}
