import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../components/layout/AppFrame'
import BackHeader from '../components/layout/BackHeader'
import { supabase } from '../lib/supabase'
import { getMyBlocks, unblockUser, type BlockedUser } from '../lib/blocks'

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  return n.length <= 1 ? n : n[0] + '*'.repeat(Math.min(n.length - 1, 3))
}

// 차단한 사용자 관리 — 마이페이지 > 계정 관리에서 들어온다. 앱 심사 조건(차단 해제 수단)이기도 하다.
export default function AppBlocked() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<BlockedUser[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/app/login', { replace: true, state: { from: '/app/blocked' } }); return }
      const list = await getMyBlocks()
      if (alive) setRows(list)
    })()
    return () => { alive = false }
  }, [navigate])

  const onUnblock = async (u: BlockedUser) => {
    if (!window.confirm(`${maskName(u.nickname)} 님의 차단을 풀까요? 이야기와 댓글이 다시 보여요.`)) return
    setBusy(u.user_id)
    const ok = await unblockUser(u.user_id)
    setBusy(null)
    if (!ok) { showToast('차단을 풀지 못했어요. 잠시 후 다시 시도해 주세요'); return }
    setRows((prev) => (prev ?? []).filter((r) => r.user_id !== u.user_id))
    showToast('차단을 풀었어요')
  }

  return (
    <AppFrame>
      <BackHeader title="차단한 사용자" onBack={() => navigate(-1)} />
      <section className="px-5 pt-4 pb-10">
        <p className="text-[12.5px] text-ink-faint leading-relaxed mb-4">
          차단한 사람의 이야기·댓글·소식은 나에게 보이지 않고, 그 사람은 내 글에 댓글을 남길 수 없어요. 언제든 풀 수 있어요.
        </p>
        {rows === null ? (
          <p className="py-12 text-center text-[14px] text-ink-faint">불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-[14px] text-ink-faint">차단한 사용자가 없어요</p>
        ) : (
          <ul className="divide-y divide-rule">
            {rows.map((u) => (
              <li key={u.user_id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold text-ink truncate">{maskName(u.nickname)}</p>
                  <p className="text-[12px] text-ink-faint mt-0.5">{new Date(u.created_at).toLocaleDateString('ko-KR')} 차단</p>
                </div>
                <button type="button" onClick={() => void onUnblock(u)} disabled={busy === u.user_id}
                  className="min-h-11 shrink-0 rounded-control border border-rule px-3.5 text-[13px] font-semibold text-ink disabled:opacity-50">
                  {busy === u.user_id ? '푸는 중…' : '차단 해제'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>}
    </AppFrame>
  )
}
