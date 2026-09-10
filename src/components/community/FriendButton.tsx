import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestFriend, respondFriend, removeFriend, type FriendStatus } from '../../lib/friends'

// 닉네임 옆 작은 친구 버튼 — 상태에 따라 글자가 바뀐다. (2026-09-11)
//   none      → "친구 신청"   누르면 신청
//   requested → "신청함"      누르면 취소(확인창)
//   received  → "수락"        누르면 친구가 된다
//   friends   → "친구"        누르면 끊기(확인창) — 실수로 끊지 않게 한 번 묻는다
// 포인트 없음. 숫자(친구 수 등)도 카드에 안 붙인다.

interface Props {
  userId: string
  status: FriendStatus
  loggedIn: boolean
  onChange: (next: FriendStatus) => void
  onNotice?: (msg: string) => void
}

export default function FriendButton({ userId, status, loggedIn, onChange, onNotice }: Props) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const press = async () => {
    if (!loggedIn) { navigate('/app/login'); return }
    if (busy) return
    setBusy(true)
    try {
      if (status === 'none') {
        const res = await requestFriend(userId)
        if (res.status === 'requested') onChange('requested')
        else if (res.status === 'friends') onChange('friends')
        onNotice?.(res.message)
      } else if (status === 'received') {
        const ok = await respondFriend(userId, true)
        if (ok) { onChange('friends'); onNotice?.('친구가 됐어요') } else onNotice?.('잠시 후 다시 시도해 주세요')
      } else if (status === 'requested') {
        if (!window.confirm('친구 신청을 취소할까요?')) return
        if (await removeFriend(userId)) onChange('none')
      } else if (status === 'friends') {
        if (!window.confirm('친구를 끊을까요?')) return
        if (await removeFriend(userId)) { onChange('none'); onNotice?.('친구를 끊었어요') }
      }
    } finally {
      setBusy(false)
    }
  }

  const label = status === 'friends' ? '친구' : status === 'requested' ? '신청함' : status === 'received' ? '수락' : '친구 신청'
  const tone =
    status === 'friends' ? 'bg-quiet text-ink border-transparent'
    : status === 'received' ? 'bg-ink text-paper border-transparent'
    : status === 'requested' ? 'text-ink-faint border-rule'
    : 'text-ink-soft border-rule'

  return (
    <button
      type="button"
      onClick={() => void press()}
      disabled={busy}
      aria-label={status === 'friends' ? '친구 — 누르면 끊기' : status === 'requested' ? '친구 신청함 — 누르면 취소' : status === 'received' ? '친구 신청 수락' : '친구 신청'}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold leading-tight transition-colors focus:outline-none focus-visible:shadow-ring disabled:opacity-50 ${tone}`}
    >
      {label}
    </button>
  )
}
