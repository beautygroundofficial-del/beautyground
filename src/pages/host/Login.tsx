import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'
import { supabase } from '../../lib/supabase'

export default function HostLogin() {
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

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      setSubmitting(false)
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }

    navigate('/host/dashboard')
  }

  return (
    <>
      <GNB />
      <main className="py-20 md:py-28" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[420px] mx-auto px-6">
          <div className="text-center mb-8">
            <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
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
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                  이메일
                </label>
                <input
                  id="email" type="email" required
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
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
                  className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                />
              </div>

              {error && (
                <p className="text-[13px] text-[#FF4757]" role="alert">{error}</p>
              )}

              <Button
                type="submit" variant="gold" size="md"
                label={submitting ? '로그인 중…' : '로그인'}
                disabled={submitting} className="w-full"
              />

              <p className="text-center text-[13px] text-text-sub pt-1">
                아직 계정이 없으신가요?{' '}
                <Link to="/host/register" className="text-gold hover:underline">회원가입</Link>
              </p>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
