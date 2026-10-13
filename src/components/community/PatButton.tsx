import { useEffect, useRef, useState } from 'react'
import { sendFriendPat } from '../../lib/friends'

// 친구에게 보내는 가벼운 인사 "토닥" — 같은 친구에게 하루 한 번. (2026-10-14)
// 숫자·순위·연속 기록을 붙이지 않는다(압박 없음). 받은 사람 소식에 "○○님이 토닥였어요"로 간다.
// 이미 보낸 날은 눌러도 아무 일도 없게 흐리게 보여준다.

interface Props {
  userId: string
  sentToday: boolean
  onSent: () => void
  onNotice?: (msg: string) => void
  disabled?: boolean
}

export default function PatButton({ userId, sentToday, onSent, onNotice, disabled = false }: Props) {
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const press = async () => {
    if (sentToday || disabled || inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      const res = await sendFriendPat(userId)
      if (mounted.current) {
        if (res.status === 'sent' || res.status === 'already') onSent()
        onNotice?.(res.message)
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void press()}
      disabled={busy || disabled || sentToday}
      aria-busy={busy}
      aria-label={sentToday ? '오늘은 이미 토닥였어요' : '친구에게 토닥 보내기'}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-solid px-3 text-[13px] font-bold leading-snug transition-colors focus:outline-none focus-visible:shadow-ring ${
        sentToday ? 'border-transparent bg-quiet text-ink-soft' : 'border-rule bg-paper text-ink hover:bg-quiet'} disabled:opacity-60`}
    >
      {sentToday ? '오늘 토닥였어요' : '🤍 토닥'}
    </button>
  )
}
