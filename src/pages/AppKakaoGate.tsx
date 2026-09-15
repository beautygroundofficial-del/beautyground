import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'

// 카카오 로그인 콜백(AppLogin.tsx 전용 게이트) — 카카오 버튼은 "처음이면 자동가입, 이미
// 있으면 로그인" 방식이라 로그인 화면에는 회원가입 화면(AppSignup.tsx)의 필수 약관 체크박스가
// 없다. 그대로 두면 로그인 화면에서도 동의 없이 신규가입이 완료돼버린다(2026-09-15 발견,
// 동의 체크박스 추가 작업의 후속 조치 — 대표님 지시: "신규가입이면 동의화면으로 리다이렉트").
//
// Supabase OAuth는 콜백에서 바로 세션을 완성해버려 가입 자체를 미리 막을 수는 없다. 대신
// 여기서 신규가입 여부를 판별해(created_at ≈ last_sign_in_at) 신규면 AppSignup.tsx의 동의
// 화면(pendingConsent)으로 보내 체크박스 동의를 받게 하고, 동의를 거부하면 로그아웃시킨다.
// 기존 가입자는 판별만 거치고 그대로 from으로 통과 — 로그인 정상 흐름은 바뀌지 않는다.
//
// ⚠️ AppSignup.tsx 자체의 카카오 버튼(handleKakao)은 클릭 전에 이미 체크박스로 동의를 받으므로
//    redirectTo가 여전히 ${origin}${from} 직행이다 — 이 게이트를 거치지 않는다(중복 방지).
const NEW_USER_THRESHOLD_MS = 10_000

export default function AppKakaoGate() {
  const navigate = useNavigate()
  const { mode, toggle } = useViewMode()
  const [error, setError] = useState('')

  useEffect(() => {
    const run = async () => {
      const from = sessionStorage.getItem('kakao_oauth_from') || '/app/home'
      sessionStorage.removeItem('kakao_oauth_from')

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        setError('카카오 로그인 처리에 실패했습니다. 다시 시도해 주세요.')
        return
      }

      const createdAt = new Date(session.user.created_at).getTime()
      const lastSignInAt = session.user.last_sign_in_at
        ? new Date(session.user.last_sign_in_at).getTime()
        : createdAt
      // 신규 유저는 첫 로그인 시점에 created_at과 last_sign_in_at이 사실상 같다.
      // 기존 유저는 last_sign_in_at만 갱신되므로 created_at과의 차이가 크다.
      const isNewUser = Math.abs(lastSignInAt - createdAt) < NEW_USER_THRESHOLD_MS

      if (isNewUser) {
        navigate('/app/signup', { replace: true, state: { pendingConsent: true, from } })
      } else {
        navigate(from, { replace: true })
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
            onClick={() => navigate('/app/login')}
            className="text-ink text-[14px] font-bold underline focus:outline-none focus-visible:shadow-ring"
          >
            로그인으로 돌아가기
          </button>
        </>
      ) : (
        <p className="text-[14px] text-ink-faint">로그인 처리 중…</p>
      )}
    </div>
    </div>
  )
}
