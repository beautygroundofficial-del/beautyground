// 커뮤니티 공용 표시 — 하트·말풍선 아이콘 하나로 통일. (2026-09-11)
// 대표님 "커뮤니티 게시판 모두 하트·말풍선": 누르는 버튼(LikeButton·CommentToggle)도, 목록에서 개수만 보여주는
// 자리(MetaMarks)도 같은 그림을 쓴다 — 어디서 보든 같은 뜻으로 읽히게.

export function HeartIcon({ size = 18, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size}
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8.2 3.5 5 6.8 5c1.9 0 3.4 1 4.2 2.5C11.8 6 13.3 5 15.2 5c3.3 0 5.3 3.2 4.1 6.3C17.5 15.9 12 20.5 12 20.5z" />
    </svg>
  )
}

export function BubbleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z" />
    </svg>
  )
}

// 목록·홈 카드용 — 누르지 않고 개수만. 0이면 숫자 없이 아이콘만(성적표처럼 안 보이게).
export function MetaMarks({ likes, comments, size = 16 }: { likes: number; comments: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-ink-faint text-[12px] tabular-nums shrink-0">
      <span className="inline-flex items-center gap-1" aria-label={`하트 ${likes}`}>
        <HeartIcon size={size} />{likes > 0 && likes}
      </span>
      <span className="inline-flex items-center gap-1" aria-label={`댓글 ${comments}`}>
        <BubbleIcon size={size} />{comments > 0 && comments}
      </span>
    </span>
  )
}
