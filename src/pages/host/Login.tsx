import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'
import { supabase } from '../../lib/supabase'

export default function HostLogin() {
  const navigate = useNavigate()
  // 링크를 받고 로그인하러 온 경우, 로그인 끝나면 원래 보려던 주소로 되돌린다(2026-09-02).
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setSubmitting(false)
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }

    navigate(from ?? ('/host/dashboard'))
  }

  const handleKakao = async () => {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/host/dashboard`,
        scopes: 'profile_nickname account_email',
      },
    })
    if (oauthError) setError('카카오 로그인 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }

  return (
    <>
      <GNB />
      <main className="py-20 md:py-28" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[420px] mx-auto px-6">
          <div className="text-center mb-8">
            <span className="text-ink text-[13px] font-medium tracking-widest uppercase mb-3 block">
              HOST LOGIN
            </span>
            <h1 className="font-serif text-[28px] md:text-[32px] font-bold text-text">
              진행자 로그인
            </h1>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white rounded-md p-6 md:p-8 border"
            style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
          >
            <div className="space-y-4">
              {/* 카카오 로그인 — 공식 버튼 규격(#FEE500 배경 + 검정 85% 텍스트, 카카오 고유색 예외) */}
              <button
                type="button"
                onClick={handleKakao}
                className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[15px] py-3.5 focus:outline-none focus-visible:shadow-ring"
                style={{ backgroundColor: '#FEE500', color: 'rgba(0,0,0,0.85)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="rgba(0,0,0,0.85)"
                    d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.85C22 6.54 17.52 3 12 3z"
                  />
                </svg>
                카카오로 로그인
              </button>

              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-rule" />
                <span className="text-[12px] text-ink-faint">또는 이메일로 로그인</span>
                <div className="flex-1 h-px bg-rule" />
              </div>

              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                  이메일
                </label>
                <input
                  id="email" type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full bg-white border border-rule rounded-md px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring transition"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-text mb-1.5">
                  비밀번호
                </label>
                <input
                  id="password" type="password" required
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="w-full bg-white border border-rule rounded-md px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring transition"
                />
              </div>

              {error && (
                <p className="text-[13px] text-[#FF4757]" role="alert">{error}</p>
              )}

              <Button
                type="submit" variant="ink" size="md"
                label={submitting ? '로그인 중…' : '로그인'}
                disabled={submitting} className="w-full"
              />

              <p className="text-center text-[13px] text-text-sub pt-1">
                아직 계정이 없으신가요?{' '}
                <Link to="/host/register" className="text-ink hover:underline">회원가입</Link>
              </p>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
