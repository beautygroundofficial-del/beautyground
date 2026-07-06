import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import { supabase } from '../lib/supabase'

const field =
  'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

export default function AppLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app/mypage'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSubmitting(false)
    if (signInError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen bg-white">
      <BackHeader title="로그인" />
      <div className="max-w-[420px] mx-auto px-6 py-10">
        <h1 className="font-serif text-[24px] font-bold text-gold text-center mb-8">뷰티그라운드</h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">이메일</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@example.com" className={field} required />
          </div>
          <div>
            <label htmlFor="password" className="block text-[13px] font-medium text-text mb-1.5">비밀번호</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className={field} required />
          </div>

          {error && <p className="text-[13px] text-[#FF4757]" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gold text-white font-semibold text-[15px] py-3.5 rounded-pill hover:bg-gold-light transition-colors disabled:opacity-60"
          >
            {submitting ? '로그인 중…' : '로그인'}
          </button>

          <p className="text-center text-[13px] text-text-sub pt-1">
            아직 계정이 없으신가요?{' '}
            <Link to="/app/signup" state={{ from }} className="text-gold hover:underline">회원가입</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
