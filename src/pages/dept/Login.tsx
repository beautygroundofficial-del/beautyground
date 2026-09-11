import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// 백화점 담당자 로그인 — beautyground-erp(매장관리 시스템)의 로그인 화면과 같은 톤으로 통일:
// 옅은 라벤더그레이 배경 + 흰 카드(radius 18, soft shadow) + 네이비(#1a1e36) 강조.
// 온라인몰 헤더/푸터 없이 독립된 유틸리티 화면으로 둔다(ERP 로그인과 동일한 방식).
export default function DeptLogin() {
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
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      return
    }

    navigate(from ?? ('/dept/sales'))
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f9', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360, background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px rgba(20,25,60,.1)', padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 26 }}>
          <img src="/images/bg-logo-gold-wordmark.png" alt="뷰티그라운드" style={{ width: 140, margin: '0 auto 12px', display: 'block' }} />
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#8b90ad', letterSpacing: '.5px' }}>백화점 담당자 시스템</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 14 }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>
              아이디
            </label>
            <input
              id="email" type="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ak-gwangmyeong@beautyground.co.kr"
              style={{ width: '100%', padding: '13px 14px', border: '1px solid #d5d8e2', borderRadius: 10, fontSize: 15, color: '#1a1e36' }}
            />
          </div>
          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#666', marginBottom: 6 }}>
              비밀번호
            </label>
            <input
              id="password" type="password" required
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              style={{ width: '100%', padding: '13px 14px', border: '1px solid #d5d8e2', borderRadius: 10, fontSize: 15, color: '#1a1e36' }}
            />
          </div>

          {error && (
            <p role="alert" style={{ color: '#c0392b', fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', padding: 16, borderRadius: 12, fontSize: 15.5, fontWeight: 700,
              cursor: submitting ? 'default' : 'pointer', border: 'none',
              background: submitting ? '#999' : '#1a1e36', color: '#fff', marginTop: 4,
            }}
          >
            {submitting ? '로그인 중...' : '로그인'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12.5, color: '#8b90ad', margin: '4px 0 0' }}>
            가입코드를 받으셨나요?{' '}
            <Link to="/dept/register" style={{ color: '#1a1e36', fontWeight: 700 }}>가입하기</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
