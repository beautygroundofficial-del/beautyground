import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import { supabase } from '../lib/supabase'

const field =
  'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export default function AppSignup() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app/mypage'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')

    if (!name.trim()) return setError('이름을 입력해 주세요.')
    if (!phone.trim()) return setError('연락처를 입력해 주세요.')
    if (!EMAIL_RE.test(email.trim())) return setError('올바른 이메일 형식이 아닙니다.')
    if (!PASSWORD_RE.test(password)) return setError('비밀번호는 8자 이상, 영문+숫자를 포함해야 합니다.')
    if (password !== passwordConfirm) return setError('비밀번호가 일치하지 않습니다.')

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
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="text-5xl mb-5" aria-hidden="true">📩</div>
        <h1 className="text-[18px] font-bold text-text mb-2">인증 이메일을 보냈습니다</h1>
        <p className="text-[13px] text-text-sub leading-relaxed mb-8">
          {email} 로 전송된 링크를 확인한 후 로그인해 주세요.
        </p>
        <Link to="/app/login" className="text-gold text-[14px] font-medium hover:underline">로그인하러 가기</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <BackHeader title="회원가입" />
      <div className="max-w-[420px] mx-auto px-6 py-10">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-[13px] font-medium text-text mb-1.5">이름</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className={field} />
          </div>
          <div>
            <label htmlFor="phone" className="block text-[13px] font-medium text-text mb-1.5">연락처</label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className={field} />
          </div>
          <div>
            <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">이메일</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@example.com" className={field} />
          </div>
          <div>
            <label htmlFor="password" className="block text-[13px] font-medium text-text mb-1.5">비밀번호</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상, 영문+숫자" className={field} />
          </div>
          <div>
            <label htmlFor="passwordConfirm" className="block text-[13px] font-medium text-text mb-1.5">비밀번호 확인</label>
            <input id="passwordConfirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="비밀번호 재입력" className={field} />
          </div>

          {error && <p className="text-[13px] text-[#FF4757]" role="alert">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gold text-white font-semibold text-[15px] py-3.5 rounded-pill hover:bg-gold-light transition-colors disabled:opacity-60"
          >
            {submitting ? '가입 중…' : '회원가입'}
          </button>

          <p className="text-center text-[13px] text-text-sub pt-1">
            이미 계정이 있으신가요?{' '}
            <Link to="/app/login" state={{ from }} className="text-gold hover:underline">로그인</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
