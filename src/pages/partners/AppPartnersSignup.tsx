import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PartnersEntryLayout from '../../components/partners/PartnersEntryLayout'
import { supabase } from '../../lib/supabase'
import { startAppleSignIn } from '../../lib/appleAuth'
import AppleSignInButton from '../../components/auth/AppleSignInButton'

const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

// 파트너스 회원가입 — 계정 체계는 쇼핑앱과 같지만(카카오·네이버·이메일, 같은 auth.users)
// "파트너스 회원가입"임을 화면에 명시한 전용 화면(2026-09-26 대표님: "회원가입은 동일하나 파트너스 회원가입을 명시해야 해").
// 카카오는 AppKakaoGate, 네이버는 AppNaverCallback 을 그대로 거치되(신규면 동의 화면 → from),
// 끝나면 from=/app/partners/info(개인정보·계좌 등록)으로 돌아온다.
// 끝나면 입구(/app/partners)로 돌아가 상태를 보고 갈린다: 이미 파트너스 → 홈, 아직 → 정보 등록.
const AFTER = '/app/partners'
type Mode = 'new' | 'member' | 'partner'

export default function AppPartnersSignup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const raw = params.get('mode')
  const mode: Mode = raw === 'member' || raw === 'partner' ? raw : 'new'
  const isNew = mode === 'new'
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

  const handleApple = async () => {
    setError('')
    sessionStorage.setItem('kakao_oauth_from', AFTER)
    const msg = await startAppleSignIn(`${window.location.origin}/app/auth/kakao/gate`)
    if (msg) setError(msg)
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
    if (e2) { setError('이메일 또는 비밀번호가 맞지 않아요. 처음이시면 [처음이에요]에서 카카오·네이버로 가입해 주세요.'); return }
    navigate(AFTER, { replace: true })
  }

  const verb = isNew ? '가입' : '로그인'
  const title = isNew ? '처음이에요 · 회원가입' : mode === 'member' ? '쇼핑몰 회원 로그인' : '파트너스 로그인'
  const lead = isNew
    ? '뷰티그라운드 계정을 새로 만들어요. 가입 뒤 파트너스 정보(계좌)를 등록하면 시작할 수 있어요.'
    : mode === 'member'
      ? '쇼핑에 쓰던 계정으로 로그인하세요. 새로 가입하지 않고 파트너스 정보만 등록하면 돼요.'
      : '파트너스로 가입한 계정으로 로그인하세요. 내 링크와 정산을 바로 볼 수 있어요.'

  return (
    <PartnersEntryLayout backTo="/app/partners">
      <h2>{title}</h2>
      <p className="pe-sub">{lead}</p>

      <div className="space-y-2.5" style={{ marginTop: 18 }}>
        <button type="button" onClick={handleKakao}
          className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 focus:outline-none focus-visible:shadow-ring"
          style={{ backgroundColor: '#FEE500', color: 'rgba(0,0,0,0.85)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="rgba(0,0,0,0.85)" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.85C22 6.54 17.52 3 12 3z" /></svg>
          카카오로 {verb}
        </button>
        <button type="button" onClick={handleNaver}
          className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 text-paper focus:outline-none focus-visible:shadow-ring"
          style={{ backgroundColor: '#03C75A' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M13.6 12.5 8.9 5.5H4.9v13h4.5v-7l4.7 7h4v-13h-4.5v7Z" /></svg>
          네이버로 {verb}
        </button>
        <AppleSignInButton onClick={() => void handleApple()} label={`Apple로 ${verb}`} />
      </div>
      {error && isNew && <p className="text-[13px] text-signal-red" role="alert" style={{ marginTop: 10 }}>{error}</p>}

      {isNew ? (
        <p className="pe-sub" style={{ marginTop: 14 }}>
          이메일 계정은 쇼핑몰에 이미 있는 분만 로그인할 수 있어요.{' '}
          <button type="button" onClick={() => navigate('/app/partners/signup?mode=member')} className="underline text-ink-soft">이미 회원이세요?</button>
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-rule" /><span className="text-[12px] text-ink-faint">또는 이메일 계정으로</span><div className="flex-1 h-px bg-rule" />
          </div>
          <form onSubmit={handleEmail} noValidate className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" className={field} autoComplete="email" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className={field} autoComplete="current-password" />
            {error && <p className="text-[13px] text-signal-red" role="alert">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring">
              {submitting ? '확인 중…' : '이메일로 로그인'}
            </button>
          </form>
        </>
      )}

      <p className="pe-sub" style={{ marginTop: 18, fontSize: 11.5 }}>
        {isNew
          ? '가입을 진행하면 파트너스 안내(링크 공유 방식, 다른 파트너 모집·하위 수당 없음, 결제 완료 후 취소·환불되지 않은 주문 기준 월 정산·익월 10일 지급, 본인 구매 제외, 세법에 따른 공제 가능)에 동의한 것으로 봐요. 다음 화면에서 개인정보와 정산 계좌를 등록해요.'
          : '로그인 뒤 파트너스 정보가 없으면 정보 등록 화면으로, 이미 파트너스면 내 파트너스 홈으로 이동해요.'}
      </p>
    </PartnersEntryLayout>
  )
}
