import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopAuthLayout from '../components/auth/DesktopAuthLayout'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'

const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

export default function AppLogin() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app/mypage'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // 이미 다른 계정으로 로그인된 채 /app/login에 들어오면 로그인 폼만 보여서
  // 계정을 바꿀 방법이 없었음 — 현재 로그인 상태를 보여주고 로그아웃 버튼을 제공.
  // 카카오 가입 계정은 이메일이 없을 수 있어(비즈니스 인증 전) email 유무가 아니라
  // 세션 존재 자체로 판단하고, 표시 라벨은 이메일 → 닉네임(user_metadata.name) 순으로 대체한다.
  const [loggedInLabel, setLoggedInLabel] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (!session) { setLoggedInLabel(null); return }
      const meta = session.user.user_metadata as { name?: string } | undefined
      setLoggedInLabel(session.user.email ?? meta?.name ?? '로그인된 계정')
    })
    return () => { active = false }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setLoggedInLabel(null)
  }

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

  // 카카오 로그인 — 완료 후 원래 가려던 페이지로 복귀
  const handleKakao = async () => {
    setError('')
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}${from}`,
        // account_email: 혜택 중복지급 차단 기준 / plusfriends: 채널 추가 상태 조회
        scopes: 'profile_nickname account_email plusfriends',
        // 동의 화면에 "카카오톡 채널 추가" 체크 노출 (뷰티그라운드 채널 _vnwfX)
        queryParams: { channel_public_id: '_vnwfX' },
      },
    })
    if (oauthError) setError('카카오 로그인 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }

  // 네이버 로그인 — 회원가입 화면(AppSignup.tsx)과 같은 방식.
  // 네이버는 Supabase 공식 지원 밖이라 커스텀 OAuth다: state/from 을 sessionStorage 에 저장해두고
  // 콜백(AppNaverCallback.tsx)에서 CSRF 대조 후 /api/auth-naver 로 code 를 넘겨 세션을 완성한다.
  const handleNaver = () => {
    setError('')
    const clientId = import.meta.env.VITE_NAVER_CLIENT_ID as string | undefined
    if (!clientId) {
      setError('네이버 로그인이 아직 설정되지 않았습니다.')
      return
    }
    const state = crypto.randomUUID()
    sessionStorage.setItem('naver_oauth_state', state)
    sessionStorage.setItem('naver_oauth_from', from)
    const url = new URL('https://nid.naver.com/oauth2.0/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', `${window.location.origin}/app/auth/naver/callback`)
    url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  const formContent = (
    <>
      {/* 로그인 화면 구성 — 2026-09-09 대표님 지시
          "이메일 로그인도 있으나 카카오 네이버가 상단에 보여지게 해서 로그인 편리성을 강조"
          "우리가 지향하는 곳은 40대에서 60대의 고객이야 복잡하면 안돼"

          그래서 ①간편 로그인 두 개를 위에 크게(py-4·16px — 이 연령대는 작은 버튼을 잘 못 누른다)
          ②이메일/비밀번호는 아래로 내려 기존 가입자용으로 남긴다.

          ⚠️ 네이버 버튼은 회원가입 화면에만 있고 이 화면엔 없었다 — 네이버로 가입한 분이
             로그인하러 오면 들어올 방법이 아예 없던 실제 결함(2026-09-09 발견). */}
      <div className="space-y-2.5">
        {/* 카카오 — 공식 버튼 규격(#FEE500 배경 + 검정 85% 텍스트, 카카오 고유색 예외) */}
        <button
          type="button"
          onClick={handleKakao}
          className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 focus:outline-none focus-visible:shadow-ring"
          style={{ backgroundColor: '#FEE500', color: 'rgba(0,0,0,0.85)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="rgba(0,0,0,0.85)"
              d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.85C22 6.54 17.52 3 12 3z"
            />
          </svg>
          카카오로 시작하기
        </button>

        {/* 네이버 — 공식 버튼 규격(#03C75A 배경 + 흰 텍스트) */}
        <button
          type="button"
          onClick={handleNaver}
          className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 text-paper focus:outline-none focus-visible:shadow-ring"
          style={{ backgroundColor: '#03C75A' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" d="M13.6 12.5 8.9 5.5H4.9v13h4.5v-7l4.7 7h4v-13h-4.5v7Z" />
          </svg>
          네이버로 시작하기
        </button>
      </div>

      {/* 가입인지 로그인인지 고민하지 않게 한 줄로 정리한다 —
          두 버튼 모두 처음이면 가입, 이미 있으면 로그인으로 그대로 이어진다. */}
      <p className="text-center text-[12.5px] text-ink-faint mt-3">
        처음이면 가입, 이미 하셨다면 로그인됩니다
      </p>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-rule" />
        <span className="text-[12px] text-ink-faint">또는 이메일로</span>
        <div className="flex-1 h-px bg-rule" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">이메일</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@example.com" className={field} required />
        </div>
        <div>
          <label htmlFor="password" className="block text-[13px] font-bold text-ink mb-1.5">비밀번호</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className={field} required />
        </div>

        {error && <p className="text-[13px] text-signal-red" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring"
        >
          {submitting ? '로그인 중…' : '로그인'}
        </button>

        <p className="text-center text-[13px] text-ink-soft pt-1">
          아직 계정이 없으신가요?{' '}
          <Link to="/app/signup" state={{ from }} className="text-ink font-bold focus:outline-none focus-visible:shadow-ring">회원가입</Link>
        </p>
        <p className="text-center text-[12.5px] text-ink-faint">
          <Link to="/app/guest-order" className="underline underline-offset-2 focus:outline-none focus-visible:shadow-ring">비회원 주문 조회</Link>
        </p>
      </form>
    </>
  )

  const loggedInNotice = loggedInLabel && (
    <div className="flex items-center justify-between rounded-control bg-quiet px-4 py-3 mb-5">
      <p className="text-[12.5px] text-ink-soft truncate">
        <span className="font-bold text-ink">{loggedInLabel}</span>로 로그인되어 있어요
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="shrink-0 text-[12.5px] text-ink-faint underline ml-3 focus:outline-none focus-visible:shadow-ring"
      >
        로그아웃
      </button>
    </div>
  )

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopAuthLayout title="로그인">
          {loggedInNotice}
          {formContent}
        </DesktopAuthLayout>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule">
      <BackHeader
        title="로그인"
        rightElement={
          loggedInLabel ? (
            <button
              type="button"
              onClick={handleLogout}
              className="text-[13px] text-ink-faint underline focus:outline-none focus-visible:shadow-ring"
            >
              로그아웃
            </button>
          ) : undefined
        }
      />
      <div className="px-6 py-10">
        <h1 className="text-[24px] font-bold text-ink text-center mb-8">뷰티그라운드</h1>
        {formContent}
      </div>
    </div>
    </div>
  )
}
