import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'
import { supabase } from '../../lib/supabase'

export default function PartnerRegister() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setSubmitting(false)
      setError(signUpError.message || '회원가입 중 오류가 발생했습니다.')
      return
    }

    // 가입 성공 → 입점 신청서로 이동
    navigate('/partner/apply')
  }

  return (
    <>
      <GNB />
      <main className="py-20 md:py-28" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[420px] mx-auto px-6">
          <div className="text-center mb-8">
            <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
              PARTNER SIGN UP
            </span>
            <h1 className="font-serif text-[28px] md:text-[32px] font-bold text-text">
              파트너 회원가입
            </h1>
            <p className="text-text-sub text-[14px] mt-2">
              브랜드/셀러 계정을 만들고 입점을 신청하세요
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white rounded-md p-6 md:p-8 border"
            style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                  이메일 <span className="text-[#FF4757]">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="brand@company.com"
                  className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-text mb-1.5">
                  비밀번호 <span className="text-[#FF4757]">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6자 이상"
                  className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                />
              </div>

              {error && (
                <p className="text-[13px] text-[#FF4757]" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="gold"
                size="md"
                label={submitting ? '가입 중…' : '회원가입'}
                disabled={submitting}
                className="w-full"
              />

              <p className="text-center text-[13px] text-text-sub pt-1">
                이미 계정이 있으신가요?{' '}
                <Link to="/partner/login" className="text-gold hover:underline">
                  로그인
                </Link>
              </p>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
