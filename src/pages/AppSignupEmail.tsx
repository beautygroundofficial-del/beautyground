import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopAuthLayout from '../components/auth/DesktopAuthLayout'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'

// 쇼핑몰(이메일) 회원가입 — AppSignup.tsx(방법 선택 화면)의 "쇼핑몰 회원가입" 버튼에서 진입.
const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export default function AppSignupEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, isDesktop, toggle } = useViewMode()
  const from = (location.state as { from?: string } | null)?.from ?? '/app/mypage'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const canProceed = agreeTerms && agreePrivacy

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')

    if (!name.trim()) return setError('이름을 입력해 주세요.')
    if (!phone.trim()) return setError('연락처를 입력해 주세요.')
    if (!EMAIL_RE.test(email.trim())) return setError('올바른 이메일 형식이 아닙니다.')
    if (!PASSWORD_RE.test(password)) return setError('비밀번호는 8자 이상, 영문+숫자를 포함해야 합니다.')
    if (password !== passwordConfirm) return setError('비밀번호가 일치하지 않습니다.')
    if (!canProceed) return setError('이용약관과 개인정보 수집·이용에 모두 동의해주세요.')

    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), phone: phone.trim() } },
    })
    setSubmitting(false)

    if (signUpError) {
      const msg = signUpError.message?.toLowerCase() ?? ''
      const already = msg.includes('already') || msg.includes('registered') || msg.includes('exists')
      setError(already ? '이미 가입된 이메일입니다. 로그인을 이용해 주세요.' : `회원가입 중 오류가 발생했습니다. (${signUpError.message})`)
      return
    }
    if (data.user && data.user.identities?.length === 0) {
      setError('이미 가입된 이메일입니다. 로그인을 이용해 주세요.')
      return
    }

    if (data.session) {
      navigate(from, { replace: true })
    } else {
      setNeedsVerify(true)
    }
  }

  if (needsVerify) {
    const verifyContent = (
      <div className="flex flex-col items-center text-center">
        <h1 className="text-[18px] font-bold text-ink mb-2">인증 이메일을 보냈습니다</h1>
        <p className="text-[13px] text-ink-soft leading-relaxed mb-8">
          {email} 로 전송된 링크를 확인한 후 로그인해 주세요.
        </p>
        <Link to="/app/login" className="text-ink text-[14px] font-bold focus:outline-none focus-visible:shadow-ring">로그인하러 가기</Link>
      </div>
    )
    if (isDesktop) {
      return (
        <>
          <ViewModeToggle mode={mode} onToggle={toggle} />
          <DesktopAuthLayout>{verifyContent}</DesktopAuthLayout>
        </>
      )
    }
    return (
      <div className="min-h-screen bg-quiet md:py-6">
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <div className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule flex flex-col items-center justify-center px-8 text-center">
        {verifyContent}
      </div>
      </div>
    )
  }

  const formContent = (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-[13px] font-bold text-ink mb-1.5">이름</label>
        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className={field} />
      </div>
      <div>
        <label htmlFor="phone" className="block text-[13px] font-bold text-ink mb-1.5">연락처</label>
        <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={field} />
      </div>
      <div>
        <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">이메일</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@example.com" className={field} />
      </div>
      <div>
        <label htmlFor="password" className="block text-[13px] font-bold text-ink mb-1.5">비밀번호</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상, 영문+숫자" className={field} />
      </div>
      <div>
        <label htmlFor="passwordConfirm" className="block text-[13px] font-bold text-ink mb-1.5">비밀번호 확인</label>
        <input id="passwordConfirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="비밀번호 재입력" className={field} />
      </div>

      {/* 필수 약관 동의 — 가입 제출 전 명시적 opt-in (PG 심사 대응) */}
      <div className="rounded-control bg-quiet p-4 space-y-2.5">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="w-4 h-4 accent-ink mt-0.5 shrink-0"
          />
          <span className="text-[13px] text-ink">
            <span className="text-signal-red font-bold">(필수)</span>{' '}
            <Link to="/terms" target="_blank" rel="noreferrer" className="underline font-bold">이용약관</Link>에 동의합니다
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={agreePrivacy}
            onChange={(e) => setAgreePrivacy(e.target.checked)}
            className="w-4 h-4 accent-ink mt-0.5 shrink-0"
          />
          <span className="text-[13px] text-ink">
            <span className="text-signal-red font-bold">(필수)</span>{' '}
            <Link to="/privacy" target="_blank" rel="noreferrer" className="underline font-bold">개인정보 수집·이용</Link>에 동의합니다
          </span>
        </label>
      </div>

      {error && <p className="text-[13px] text-signal-red" role="alert">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !canProceed}
        className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring"
      >
        {submitting ? '가입 중…' : '회원가입'}
      </button>

      <p className="text-center text-[13px] text-ink-soft pt-1">
        이미 계정이 있으신가요?{' '}
        <Link to="/app/login" state={{ from }} className="text-ink font-bold focus:outline-none focus-visible:shadow-ring">로그인</Link>
      </p>
    </form>
  )

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopAuthLayout title="쇼핑몰 회원가입">{formContent}</DesktopAuthLayout>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule">
      <BackHeader title="쇼핑몰 회원가입" />
      <div className="px-6 py-10">
        {formContent}
      </div>
    </div>
    </div>
  )
}
