import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopAccount from '../components/account/DesktopAccount'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'

const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

// 계정/보안 — 마이페이지 "프로필 수정"·"계정/보안" 메뉴 진입점.
// 이용약관 제8조("마이페이지 등을 통해 탈퇴 요청 가능")를 실제로 이행하는 화면.
export default function AppAccount() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [hasPasswordAuth, setHasPasswordAuth] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) { navigate('/app/login', { state: { from: '/app/account' } }); return }
      setEmail(user.email ?? '')
      const meta = (user.user_metadata as { name?: string; phone?: string } | undefined) ?? {}
      setName(meta.name ?? '')
      setPhone(meta.phone ?? '')
      setHasPasswordAuth((user.identities ?? []).some((i) => i.provider === 'email'))
      setLoading(false)
    })()
  }, [navigate])

  const saveProfile = async () => {
    setProfileMsg('')
    setSavingProfile(true)
    const { error } = await supabase.auth.updateUser({ data: { name: name.trim(), phone: phone.trim() } })
    setSavingProfile(false)
    setProfileMsg(error ? '저장에 실패했습니다. 다시 시도해 주세요.' : '저장되었습니다.')
  }

  const changePassword = async () => {
    setPwMsg('')
    if (!PASSWORD_RE.test(newPassword)) return setPwMsg('비밀번호는 8자 이상, 영문+숫자를 포함해야 합니다.')
    if (newPassword !== newPasswordConfirm) return setPwMsg('비밀번호가 일치하지 않습니다.')
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPw(false)
    if (error) { setPwMsg('비밀번호 변경에 실패했습니다.'); return }
    setPwMsg('비밀번호가 변경되었습니다.')
    setNewPassword(''); setNewPasswordConfirm('')
  }

  const withdraw = async () => {
    setDeleteMsg('')
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const json = await res.json().catch(() => ({}))
    setDeleting(false)
    if (!res.ok || !json.ok) {
      setDeleteMsg(json.reason || '회원탈퇴에 실패했습니다. 고객센터(02-897-8287)로 연락해 주세요.')
      return
    }
    await supabase.auth.signOut()
    navigate('/app/home', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        {isDesktop ? (
          <div className="max-w-[1280px] mx-auto px-6 py-24 flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</div>
        ) : (
          <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</div>
        )}
      </div>
    )
  }

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopAccount
          email={email}
          hasPasswordAuth={hasPasswordAuth}
          name={name}
          onName={setName}
          phone={phone}
          onPhone={setPhone}
          profileMsg={profileMsg}
          savingProfile={savingProfile}
          onSaveProfile={saveProfile}
          newPassword={newPassword}
          onNewPassword={setNewPassword}
          newPasswordConfirm={newPasswordConfirm}
          onNewPasswordConfirm={setNewPasswordConfirm}
          pwMsg={pwMsg}
          savingPw={savingPw}
          onChangePassword={changePassword}
          showDeleteConfirm={showDeleteConfirm}
          onShowDeleteConfirm={setShowDeleteConfirm}
          deleteMsg={deleteMsg}
          deleting={deleting}
          onWithdraw={withdraw}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule">
      <BackHeader title="계정/보안" />
      <div className="px-5 py-6 space-y-8">

        {/* 회원정보 */}
        <section>
          <h2 className="text-[13px] font-bold text-ink-faint tracking-wide mb-3">회원정보</h2>
          <div className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">이메일</label>
              <input id="email" value={email} disabled className={`${field} bg-quiet text-ink-faint`} />
            </div>
            <div>
              <label htmlFor="name" className="block text-[13px] font-bold text-ink mb-1.5">이름</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className={field} />
            </div>
            <div>
              <label htmlFor="phone" className="block text-[13px] font-bold text-ink mb-1.5">연락처</label>
              <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={field} />
            </div>
            {profileMsg && <p className="text-[13px] text-ink-soft">{profileMsg}</p>}
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="w-full rounded-control bg-ink text-paper font-bold text-[14px] py-3 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring"
            >
              {savingProfile ? '저장 중…' : '저장'}
            </button>
          </div>
        </section>

        {/* 비밀번호 변경 — 이메일 가입 계정만 (카카오·네이버는 비밀번호가 없음) */}
        {hasPasswordAuth && (
          <section>
            <h2 className="text-[13px] font-bold text-ink-faint tracking-wide mb-3">비밀번호 변경</h2>
            <div className="space-y-3">
              <input
                type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (8자 이상, 영문+숫자)" className={field}
              />
              <input
                type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="새 비밀번호 확인" className={field}
              />
              {pwMsg && <p className="text-[13px] text-ink-soft">{pwMsg}</p>}
              <button
                onClick={changePassword}
                disabled={savingPw}
                className="w-full rounded-control border border-ink text-ink font-bold text-[14px] py-3 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring"
              >
                {savingPw ? '변경 중…' : '비밀번호 변경'}
              </button>
            </div>
          </section>
        )}

        {/* 차단한 사용자 관리 — 커뮤니티에서 차단한 사람을 여기서 풀 수 있다(앱 심사 조건) */}
        <section>
          <h2 className="text-[13px] font-bold text-ink-faint tracking-wide mb-3">커뮤니티</h2>
          <button type="button" onClick={() => navigate('/app/blocked')} className="text-[13px] text-ink underline focus:outline-none focus-visible:shadow-ring">차단한 사용자 관리</button>
        </section>

        {/* 회원탈퇴 */}
        <section>
          <h2 className="text-[13px] font-bold text-ink-faint tracking-wide mb-3">회원탈퇴</h2>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-[13px] text-ink-faint underline focus:outline-none focus-visible:shadow-ring"
            >
              회원탈퇴 신청
            </button>
          ) : (
            <div className="border border-signal-red p-4 space-y-3">
              <p className="text-[13px] text-ink leading-relaxed">
                탈퇴 시 로그인 계정은 즉시 삭제됩니다. 단, 이용약관·개인정보처리방침에 따라
                구매·결제 기록은 법정 보관기간 동안 별도 보관됩니다. 계속하시겠어요?
              </p>
              {deleteMsg && <p className="text-[13px] text-signal-red">{deleteMsg}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-control border border-rule text-ink text-[13px] font-bold py-2.5 focus:outline-none focus-visible:shadow-ring"
                >
                  취소
                </button>
                <button
                  onClick={withdraw}
                  disabled={deleting}
                  className="flex-1 rounded-control bg-signal-red text-paper text-[13px] font-bold py-2.5 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring"
                >
                  {deleting ? '처리 중…' : '탈퇴하기'}
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
    </div>
  )
}
