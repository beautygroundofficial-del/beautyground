import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import {
  getMyFriends, getFriendRequests, respondFriend, removeFriend,
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
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [friends, setFriends] = useState<FriendRow[] | null>(null)
  const [requests, setRequests] = useState<FriendRequestRow[]>([])
  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  const load = async () => {
    const [f, r] = await Promise.all([getMyFriends(), getFriendRequests()])
    setFriends(f)
    setRequests(r)
  }

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setLoggedIn(!!session)
      if (!session) { setFriends([]); return }
      await load()
    })()
  }, [])

  const received = requests.filter((r) => r.direction === 'received')
  const sent = requests.filter((r) => r.direction === 'sent')

  const accept = async (r: FriendRequestRow) => {
    if (!(await respondFriend(r.user_id, true))) { showToast('잠시 후 다시 시도해 주세요'); return }
    showToast(`${r.nickname ?? '친구'}님과 친구가 됐어요`)
    await load()
  }
  const decline = async (r: FriendRequestRow) => {
    if (!(await respondFriend(r.user_id, false))) { showToast('잠시 후 다시 시도해 주세요'); return }
    setRequests((prev) => prev.filter((x) => !(x.user_id === r.user_id && x.direction === 'received')))
  }
  const cancel = async (r: FriendRequestRow) => {
    if (!window.confirm('친구 신청을 취소할까요?')) return
    if (!(await removeFriend(r.user_id))) { showToast('잠시 후 다시 시도해 주세요'); return }
    setRequests((prev) => prev.filter((x) => !(x.user_id === r.user_id && x.direction === 'sent')))
  }
  const unfriend = async (f: FriendRow) => {
    if (!window.confirm(`${f.nickname ?? '이 친구'}님과 친구를 끊을까요?`)) return
    if (!(await removeFriend(f.user_id))) { showToast('잠시 후 다시 시도해 주세요'); return }
    setFriends((prev) => (prev ?? []).filter((x) => x.user_id !== f.user_id))
    showToast('친구를 끊었어요')
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
        ) : friends === null ? (
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
                        <button type="button" onClick={() => void decline(r)} className={ghost}>거절</button>
                        <button type="button" onClick={() => void accept(r)} className={solid}>수락</button>
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
                      <button type="button" onClick={() => void unfriend(f)} className={ghost}>끊기</button>
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
                      <button type="button" onClick={() => void cancel(r)} className={ghost}>취소</button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {toast}
        </div>
      )}
    </AppFrame>
  )
}
