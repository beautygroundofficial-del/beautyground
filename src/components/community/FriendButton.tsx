import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getFriendStatuses, requestFriend, respondFriend, removeFriend, type FriendStatus } from '../../lib/friends'
import { supabase } from '../../lib/supabase'

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
  disabled?: boolean
  onChange: (next: FriendStatus) => void
  onNotice?: (msg: string) => void
}

export default function FriendButton({ userId, status, loggedIn, disabled = false, onChange, onNotice }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const inform = (message: string) => { if (mounted.current) { setNotice(message); onNotice?.(message) } }
  const update = (next: FriendStatus) => { if (mounted.current) onChange(next) }
  const login = () => navigate('/app/login', { state: { from: location.pathname + location.search + location.hash } })

  const failed = async () => {
    try {
      const next = (await getFriendStatuses([userId], { throwOnError: true }))[userId] ?? 'none'
      update(next)
      inform(next !== status ? '친구 상태가 바뀌었어요. 다시 확인해 주세요' : '처리하지 못했어요. 잠시 후 다시 시도해 주세요')
    } catch {
      inform('친구 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요')
    }
  }

  const press = async () => {
    if (!loggedIn) { login(); return }
    if (inFlight.current || disabled) return
    inFlight.current = true
    setBusy(true)
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      if (!session) { login(); return }
      if (session.user.id === userId) { inform('나에게는 친구 신청을 할 수 없어요'); return }
      if (status === 'none') {
        const res = await requestFriend(userId)
        if (res.status === 'requested') update('requested')
        else if (res.status === 'friends') update('friends')
        else if (res.status === 'login') { login(); return }
        inform(res.message)
      } else if (status === 'received') {
        const ok = await respondFriend(userId, true)
        if (ok) { update('friends'); inform('친구가 됐어요') } else await failed()
      } else if (status === 'requested') {
        if (!window.confirm('친구 신청을 취소할까요?')) return
        if (await removeFriend(userId)) { update('none'); inform('친구 신청을 취소했어요') } else await failed()
      } else if (status === 'friends') {
        if (!window.confirm('친구를 끊을까요?')) return
        if (await removeFriend(userId)) { update('none'); inform('친구를 끊었어요') } else await failed()
      }
    } catch {
      inform('처리하지 못했어요. 잠시 후 다시 시도해 주세요')
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const label = status === 'friends' ? '친구' : status === 'requested' ? '신청함' : status === 'received' ? '수락' : '친구 신청'
  const tone =
    status === 'friends' ? 'bg-quiet text-ink border-transparent'
    : status === 'received' ? 'bg-ink text-paper border-transparent'
    : status === 'requested' ? 'bg-paper text-ink-soft border-rule'
    : 'bg-paper text-ink-soft border-rule hover:bg-quiet'

  return (
    <>
    <button
      type="button"
      onClick={() => void press()}
      disabled={busy || disabled}
      aria-busy={busy}
      aria-label={status === 'friends' ? '친구 — 누르면 끊기' : status === 'requested' ? '친구 신청함 — 누르면 취소' : status === 'received' ? '친구 신청 수락' : '친구 신청'}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-solid px-3 text-[13px] font-bold leading-snug transition-colors focus:outline-none focus-visible:shadow-ring disabled:opacity-50 ${tone}`}
    >
      {label}
    </button>
    {!onNotice && notice && <span role="status" className="text-[11px] text-ink-soft">{notice}</span>}
    </>
  )
}
