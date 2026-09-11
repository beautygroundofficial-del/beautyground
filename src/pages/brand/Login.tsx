import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'
import { supabase } from '../../lib/supabase'
import { getMyBrandAccess } from '../../lib/partner'

// 브랜드사 로그인 — 무비밀번호(이메일 인증번호) 기본 (2026-08-17 대표님 확정).
// 이메일 입력 → 6자리 인증번호 수신 → 입력 → 로그인.
// 처음 온 이메일이면 자동으로 계정이 만들어지고 "새 브랜드 등록" 온보딩으로 이동한다(셀프 가입).
// 기존 비밀번호 발급 계정을 위해 하단에 비밀번호 로그인을 접이식으로 한시 유지.

export default function BrandLogin() {
  const navigate = useNavigate()
  // 링크를 받고 로그인하러 온 경우, 로그인 끝나면 원래 보려던 주소로 되돌린다(2026-09-02).
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? null
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendLeft, setResendLeft] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (resendLeft <= 0) return
    const id = setInterval(() => setResendLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [resendLeft])

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  const afterLogin = async () => {
    const { partner, isExportOnly } = await getMyBrandAccess()
    if (!partner) {
      // 처음 온 이메일 — 새 브랜드 온보딩으로 (셀프 가입)
      navigate('/brand/onboarding')
      return
    }
    // 셀프 가입 수출 브랜드(pending)는 쇼핑몰 메뉴(대시보드 등)가 없으므로 수출 소개로 바로
    navigate(from ?? (isExportOnly || partner.status === 'pending' ? '/brand/export' : '/brand/dashboard'))
  }

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (submitting) return
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError('올바른 이메일 주소를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: em,
      options: { shouldCreateUser: true },
    })
    setSubmitting(false)
    if (otpError) {
      setError('인증번호 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setStep('code')
    setCode('')
    setResendLeft(60)
  }

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (code.trim().length < 6) {
      setError('메일로 받은 6자리 인증번호를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    if (verifyError) {
      setSubmitting(false)
      setError('인증번호가 올바르지 않거나 만료되었습니다. 다시 확인해 주세요.')
      return
    }
    await afterLogin()
  }

  const passwordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (signInError) {
      setSubmitting(false)
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    await afterLogin()
  }

  const inputCls =
    'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

  return (
    <>
      <GNB />
      <main className="py-20 md:py-28" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[420px] mx-auto px-6">
          <div className="text-center mb-8">
            <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">BRAND LOGIN</span>
            <h1 className="font-serif text-[28px] md:text-[32px] font-bold text-text">브랜드사 로그인</h1>
            <p className="text-[13px] text-text-sub mt-3">
              비밀번호 없이 이메일 인증번호로 로그인합니다.
              <br />
              처음이신가요? 같은 방법으로 바로 시작됩니다.
            </p>
          </div>

          <div className="bg-white rounded-md p-6 md:p-8 border" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            {step === 'email' && !usePassword && (
              <form onSubmit={sendCode} noValidate className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">이메일</label>
                  <input
                    id="email" type="email" required autoFocus
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="brand@company.com"
                    className={inputCls}
                  />
                </div>
                {error && <p className="text-[13px] text-[#FF4757]" role="alert">{error}</p>}
                <Button type="submit" variant="ink" size="md" disabled={submitting} className="w-full"
                  label={submitting ? '발송 중…' : '이메일로 인증번호 받기'} />
              </form>
            )}

            {step === 'code' && !usePassword && (
              <form onSubmit={verifyCode} noValidate className="space-y-4">
                <p className="text-[13px] text-text-sub leading-relaxed">
                  <b className="text-text">{email.trim()}</b> 로 인증번호를 보냈습니다.
                  <br />
                  메일함(스팸함 포함)의 <b className="text-text">6자리 숫자</b>를 입력해 주세요.
                </p>
                <input
                  ref={codeRef}
                  inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className={`${inputCls} text-center tracking-[0.5em] text-[20px] font-bold`}
                />
                {error && <p className="text-[13px] text-[#FF4757]" role="alert">{error}</p>}
                <Button type="submit" variant="ink" size="md" disabled={submitting} className="w-full"
                  label={submitting ? '확인 중…' : '로그인'} />
                <div className="flex items-center justify-between text-[12.5px] text-text-sub pt-1">
                  <button type="button" className="underline" onClick={() => { setStep('email'); setError(null) }}>
                    이메일 다시 입력
                  </button>
                  <button
                    type="button"
                    className="underline disabled:opacity-40 disabled:no-underline"
                    disabled={resendLeft > 0 || submitting}
                    onClick={() => void sendCode()}
                  >
                    {resendLeft > 0 ? `재전송 (${resendLeft}초)` : '인증번호 재전송'}
                  </button>
                </div>
              </form>
            )}

            {usePassword && (
              <form onSubmit={passwordLogin} noValidate className="space-y-4">
                <div>
                  <label htmlFor="email-pw" className="block text-[13px] font-medium text-text mb-1.5">이메일</label>
                  <input
                    id="email-pw" type="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="brand@company.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-[13px] font-medium text-text mb-1.5">비밀번호</label>
                  <input
                    id="password" type="password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호"
                    className={inputCls}
                  />
                </div>
                {error && <p className="text-[13px] text-[#FF4757]" role="alert">{error}</p>}
                <Button type="submit" variant="ink" size="md" disabled={submitting} className="w-full"
                  label={submitting ? '로그인 중…' : '로그인'} />
              </form>
            )}

            <p className="text-center text-[12.5px] text-text-sub pt-5">
              {usePassword ? (
                <button type="button" className="underline" onClick={() => { setUsePassword(false); setError(null) }}>
                  이메일 인증번호로 로그인
                </button>
              ) : (
                <button type="button" className="underline" onClick={() => { setUsePassword(true); setError(null); setStep('email') }}>
                  기존 비밀번호로 로그인
                </button>
              )}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
