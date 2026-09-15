import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'

// 네이버 로그인 콜백 — AppSignup.tsx / AppLogin.tsx 양쪽에서 네이버로 보낼 때 sessionStorage에
// 저장해둔 state/from과 대조(CSRF 방지)한 뒤, 서버(/api/auth-naver)에 code를 넘겨 세션 토큰을 받는다.
//
// entry로 어느 화면에서 시작됐는지 구분한다. AppSignup.tsx는 버튼을 누르기 전에 이미 체크박스로
// 동의를 받으므로 그대로 from으로 통과시키고, AppLogin.tsx는 동의 절차가 없으므로 서버가
// isNewUser=true(신규가입)를 돌려주면 AppSignup.tsx의 동의 화면(pendingConsent)으로 돌려보낸다
// (2026-09-15, 로그인 화면 소셜 버튼이 동의 없이 신규가입을 완료시키는 문제의 후속 조치).
export default function AppNaverCallback() {
  const navigate = useNavigate()
  const { mode, toggle } = useViewMode()
  const [error, setError] = useState('')
  const [returnTo, setReturnTo] = useState('/app/signup')

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const savedState = sessionStorage.getItem('naver_oauth_state')
      const from = sessionStorage.getItem('naver_oauth_from') || '/app/mypage'
      const entry = sessionStorage.getItem('naver_oauth_entry') || 'signup'
      setReturnTo(from)
      sessionStorage.removeItem('naver_oauth_state')
      sessionStorage.removeItem('naver_oauth_from')
      sessionStorage.removeItem('naver_oauth_entry')

      if (params.get('error')) {
        setError('네이버 로그인이 취소되었습니다.')
        return
      }
      if (!code || !state || !savedState || state !== savedState) {
        setError('로그인 요청이 올바르지 않습니다. 다시 시도해 주세요.')
        return
      }

      try {
        const res = await fetch('/api/auth-naver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state }),
        })
        const json = await res.json()
        if (!res.ok || !json.ok) {
          setError(json.reason || '네이버 로그인에 실패했습니다.')
          return
        }
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: json.email,
          token: json.emailOtp,
          type: 'email',
        })
        if (verifyError) {
          setError('로그인 세션 생성에 실패했습니다.')
          return
        }
        if (entry === 'login' && json.isNewUser) {
          navigate('/app/signup', { replace: true, state: { pendingConsent: true, from } })
          return
        }
        navigate(from, { replace: true })
      } catch (e) {
        setError('네이버 로그인 처리 중 오류가 발생했습니다.')
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule flex flex-col items-center justify-center px-8 text-center">
      {error ? (
        <>
          <p className="text-[15px] text-signal-red font-bold mb-4">{error}</p>
          <button
            onClick={() => navigate(returnTo)}
            className="text-ink text-[14px] font-bold underline focus:outline-none focus-visible:shadow-ring"
          >
            회원가입으로 돌아가기
          </button>
        </>
      ) : (
        <p className="text-[14px] text-ink-faint">네이버 로그인 처리 중…</p>
      )}
    </div>
    </div>
  )
}
