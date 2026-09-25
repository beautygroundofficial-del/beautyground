import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import { supabase } from '../../lib/supabase'

const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

// 파트너스 회원가입 — 계정 체계는 쇼핑앱과 같지만(카카오·네이버·이메일, 같은 auth.users)
// "파트너스 회원가입"임을 화면에 명시한 전용 화면(2026-09-26 대표님: "회원가입은 동일하나 파트너스 회원가입을 명시해야 해").
// 카카오는 AppKakaoGate, 네이버는 AppNaverCallback 을 그대로 거치되(신규면 동의 화면 → from),
// 끝나면 from=/app/partners/info(개인정보·계좌 등록)으로 돌아온다.
const AFTER = '/app/partners/info'

export default function AppPartnersSignup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 이미 로그인돼 있으면 가입 화면을 건너뛰고 정보 등록으로
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) navigate(AFTER, { replace: true }) })
  }, [navigate])

  const handleKakao = async () => {
    setError('')
    sessionStorage.setItem('kakao_oauth_from', AFTER)
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/app/auth/kakao/gate`,
        scopes: 'profile_nickname account_email plusfriends',
        queryParams: { channel_public_id: '_vnwfX' },
      },
    })
    if (e) setError('카카오 연결에 실패했어요. 잠시 후 다시 시도해 주세요.')
  }

  const handleNaver = () => {
    setError('')
    const clientId = import.meta.env.VITE_NAVER_CLIENT_ID as string | undefined
    if (!clientId) { setError('네이버 로그인이 아직 설정되지 않았어요.'); return }
    const state = crypto.randomUUID()
    sessionStorage.setItem('naver_oauth_state', state)
    sessionStorage.setItem('naver_oauth_from', AFTER)
    sessionStorage.setItem('naver_oauth_entry', 'login')
    const url = new URL('https://nid.naver.com/oauth2.0/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', `${window.location.origin}/app/auth/naver/callback`)
    url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (!email.trim() || !password) { setError('이메일과 비밀번호를 입력해 주세요.'); return }
    setSubmitting(true)
    const { error: e2 } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSubmitting(false)
    if (e2) { setError('이메일 또는 비밀번호가 맞지 않아요. 처음이시면 카카오·네이버로 가입해 주세요.'); return }
    navigate(AFTER, { replace: true })
  }

  return (
    <AppFrame>
      <BackHeader title="파트너스 회원가입" onBack={() => navigate('/app/partners')} />
      <section className="px-5 pt-6 pb-10">
        <h2 className="text-[18px] font-bold text-ink leading-snug">파트너스 회원가입</h2>
        <p className="text-[13px] text-ink-soft mt-2 leading-relaxed">
          뷰티그라운드 앱 계정과 같은 방법으로 가입해요. 쇼핑 계정이 이미 있다면 그 계정으로 로그인하면 파트너스로 이어져요.
        </p>

        <p className="text-[12px] text-ink-faint text-center mt-6 mb-2">가장 많이 쓰는 방법이에요</p>
        <div className="space-y-2.5">
          <button type="button" onClick={handleKakao}
            className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 focus:outline-none focus-visible:shadow-ring"
            style={{ backgroundColor: '#FEE500', color: 'rgba(0,0,0,0.85)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="rgba(0,0,0,0.85)" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.85C22 6.54 17.52 3 12 3z" /></svg>
            카카오로 파트너스 가입
          </button>
          <button type="button" onClick={handleNaver}
            className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 text-paper focus:outline-none focus-visible:shadow-ring"
            style={{ backgroundColor: '#03C75A' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M13.6 12.5 8.9 5.5H4.9v13h4.5v-7l4.7 7h4v-13h-4.5v7Z" /></svg>
            네이버로 파트너스 가입
          </button>
        </div>
        <p className="text-center text-[12.5px] text-ink-faint mt-3">처음이면 가입, 이미 하셨다면 로그인됩니다</p>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-rule" /><span className="text-[12px] text-ink-faint">또는 이메일 계정으로</span><div className="flex-1 h-px bg-rule" />
        </div>

        <form onSubmit={handleEmail} noValidate className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className={field} autoComplete="email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className={field} autoComplete="current-password" />
          {error && <p className="text-[13px] text-signal-red" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring">
            {submitting ? '확인 중…' : '이메일로 파트너스 가입'}
          </button>
        </form>

        <p className="text-[11.5px] text-ink-faint mt-6 leading-relaxed">
          가입을 진행하면 파트너스 안내(링크 공유 방식, 다른 파트너 모집·하위 수당 없음, 구매 확정 기준 월 정산, 세법에 따른 공제 가능)에 동의한 것으로 봐요. 다음 화면에서 개인정보와 정산 계좌를 등록해요.
        </p>
      </section>
    </AppFrame>
  )
}
