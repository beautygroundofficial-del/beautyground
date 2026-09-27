import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import {
  getMyFriends, getFriendRequests, respondFriend, removeFriend, FRIENDS_CHANGED_EVENT,
  type FriendRow, type FriendRequestRow,
} from '../lib/friends'

// 친구 — 마이페이지에서 들어온다. (2026-09-11)
// 위에서부터: 받은 신청(수락·거절) → 내 친구(끊기) → 보낸 신청(취소).
// 받은 신청이 맨 위인 이유: 답을 기다리는 사람이 있다는 게 가장 먼저 보여야 한다.
// 거절은 상대에게 알리지 않는다(민망함을 만들지 않는다).

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

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-[13px] font-bold text-ink mb-2.5">
        {title}{count !== undefined && count > 0 && <span className="ml-1.5 text-ink-faint tabular-nums font-semibold">{count}</span>}
      </h2>
      {children}
    </section>
  )
}

export default function AppFriends() {
  const navigate = useNavigate()
  const [viewerId, setViewerId] = useState<string | null | undefined>(undefined)
  const loggedIn = viewerId === undefined ? null : !!viewerId
  const [friends, setFriends] = useState<FriendRow[] | null>(null)
  const [requests, setRequests] = useState<FriendRequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const busyRef = useRef(false)
  const loadVersion = useRef(0)
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => setToast(msg)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const load = useCallback(async () => {
    const version = ++loadVersion.current
    setLoading(true)
    try {
      const [f, r] = await Promise.all([
        getMyFriends({ throwOnError: true }), getFriendRequests({ throwOnError: true }),
      ])
      if (version !== loadVersion.current) return
      setFriends(f)
      setRequests(r)
      setError('')
    } catch {
      if (version === loadVersion.current) setError('친구 목록을 불러오지 못했어요. 다시 시도해 주세요.')
    } finally {
      if (version === loadVersion.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive) setViewerId(session?.user.id ?? null)
    }).catch(() => {
      if (alive) { setViewerId(null); setError('로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.') }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setViewerId(session?.user.id ?? null)
    })
    return () => { alive = false; ++loadVersion.current; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    ++loadVersion.current
    setFriends(viewerId === null ? [] : null)
    setRequests([])
    setError('')
    if (!viewerId) return
    void load()
    const refresh = () => {
      if (document.visibilityState === 'visible' && !busyRef.current) void load()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener(FRIENDS_CHANGED_EVENT, refresh)
    return () => {
      ++loadVersion.current
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener(FRIENDS_CHANGED_EVENT, refresh)
    }
  }, [viewerId, load])

  const received = requests.filter((r) => r.direction === 'received')
  const sent = requests.filter((r) => r.direction === 'sent')

  const act = async (userId: string, action: () => Promise<boolean>, message: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusyUserId(userId)
    try {
      const ok = await action()
      showToast(ok ? message : '처리하지 못했어요. 새로 불러온 친구 상태를 확인해 주세요.')
      await load()
    } catch {
      showToast('처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      busyRef.current = false
      setBusyUserId(null)
    }
  }

  const accept = (r: FriendRequestRow) => act(r.user_id, () => respondFriend(r.user_id, true), `${r.nickname ?? '친구'}님과 친구가 됐어요`)
  const decline = (r: FriendRequestRow) => act(r.user_id, () => respondFriend(r.user_id, false), '친구 신청을 거절했어요')
  const cancel = (r: FriendRequestRow) => {
    if (!window.confirm('친구 신청을 취소할까요?')) return
    return act(r.user_id, () => removeFriend(r.user_id), '친구 신청을 취소했어요')
  }
  const unfriend = (f: FriendRow) => {
    if (!window.confirm(`${f.nickname ?? '이 친구'}님과 친구를 끊을까요?`)) return
    return act(f.user_id, () => removeFriend(f.user_id), '친구를 끊었어요')
  }

  const row = 'flex items-center justify-between gap-3 rounded-card border border-rule bg-paper px-4 py-3'
  const nameCls = 'text-[14px] font-semibold text-ink truncate'
  const subCls = 'text-[11.5px] text-ink-faint mt-0.5'
  const ghost = 'text-[12px] text-ink-faint px-2 py-1.5 focus:outline-none focus-visible:shadow-ring'
  const solid = 'rounded-control bg-ink text-paper text-[12px] font-semibold px-3 py-1.5 focus:outline-none focus-visible:shadow-ring'

  return (
    <AppFrame>
      <BackHeader title="친구" onBack={() => navigate('/app/mypage')} />

      <div className="px-5 pt-5 pb-28">
        {loggedIn && (
          <div className="flex justify-end mb-3">
            <button type="button" onClick={() => void load()} disabled={loading || busyUserId !== null}
              className="text-[12px] text-ink-soft px-2 py-2 disabled:opacity-50">
              {loading ? '새로 불러오는 중…' : '새로고침'}
            </button>
          </div>
        )}
        {error && <p role="alert" className="mb-4 rounded-control border border-rule bg-quiet px-4 py-3 text-[13px] text-ink-soft">{error}</p>}
        {loggedIn === false ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-ink-soft mb-4">로그인하면 친구를 맺을 수 있어요</p>
            <button
              onClick={() => navigate('/app/login', { state: { from: '/app/friends' } })}
              className="rounded-control bg-ink text-paper font-bold text-[14px] px-6 py-3 focus:outline-none focus-visible:shadow-ring"
            >
              로그인
            </button>
          </div>
        ) : friends === null && error ? null : friends === null ? (
          <p className="py-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : (
          <>
            {received.length > 0 && (
              <Section title="받은 신청" count={received.length}>
                <ul className="space-y-2">
                  {received.map((r) => (
                    <li key={`r-${r.user_id}`} className={row}>
                      <div className="min-w-0">
                        <Link to={`/app/people/${r.user_id}`} className={nameCls + ' block hover:underline'}>{r.nickname ?? '익명'}</Link>
                        <p className={subCls}>{timeAgo(r.created_at)}에 친구 신청</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" disabled={busyUserId !== null} onClick={() => void decline(r)} className={ghost + ' disabled:opacity-50'}>거절</button>
                        <button type="button" disabled={busyUserId !== null} onClick={() => void accept(r)} className={solid + ' disabled:opacity-50'}>수락</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="내 친구" count={friends.length}>
              {friends.length === 0 ? (
                <button
                  onClick={() => navigate('/app/diary')}
                  className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-10 text-center focus:outline-none focus-visible:shadow-ring"
                >
                  <p className="text-[14px] font-semibold text-ink">아직 친구가 없어요</p>
                  <p className="text-[12.5px] text-ink-faint mt-1.5">사람들의 이야기에서 이름 옆 '친구 신청'을 눌러보세요</p>
                </button>
              ) : (
                <ul className="space-y-2">
                  {friends.map((f) => (
                    <li key={f.user_id} className={row}>
                      <div className="min-w-0">
                        <Link to={`/app/people/${f.user_id}`} className={nameCls + ' block hover:underline'}>{f.nickname ?? '익명'}</Link>
                        <p className={subCls}>{timeAgo(f.since)}부터 친구</p>
                      </div>
                      <button type="button" disabled={busyUserId !== null} onClick={() => void unfriend(f)} className={ghost + ' disabled:opacity-50'}>끊기</button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {sent.length > 0 && (
              <Section title="보낸 신청" count={sent.length}>
                <ul className="space-y-2">
                  {sent.map((r) => (
                    <li key={`s-${r.user_id}`} className={row}>
                      <div className="min-w-0">
                        <p className={nameCls}>{r.nickname ?? '익명'}</p>
                        <p className={subCls}>{timeAgo(r.created_at)} · 답을 기다리는 중</p>
                      </div>
                      <button type="button" disabled={busyUserId !== null} onClick={() => void cancel(r)} className={ghost + ' disabled:opacity-50'}>취소</button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {toast}
        </div>
      )}
    </AppFrame>
  )
}
