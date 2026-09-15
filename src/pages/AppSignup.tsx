import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopAuthLayout from '../components/auth/DesktopAuthLayout'
import AppFooter from '../components/layout/AppFooter'
import Footer from '../components/layout/Footer'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'

// 회원가입 진입 화면 — 카카오 + 네이버(2026-08-24 재노출). 휴대폰(SMS) 인증 가입은
// 여전히 SMS API 미도입으로 보류라 대신 비회원 주문조회(연락처 기반)로 안내.
// 이메일(AppSignupEmail.tsx) 가입 버튼은 여기서 뺐을 뿐 코드 자체는 남겨둠 — 기존
// 이메일/비번 가입자는 AppLogin.tsx에서 계속 로그인 가능.
export default function AppSignup() {
  const location = useLocation()
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  // AppLogin.tsx 와 같은 이유로 기본 목적지를 홈(커뮤니티)으로 맞춘다(2026-09-09).
  const from = (location.state as { from?: string } | null)?.from ?? '/app/home'
  // AppLogin.tsx의 카카오·네이버 버튼(게이트: AppKakaoGate.tsx / AppNaverCallback.tsx)이
  // 신규가입으로 판별해 여기로 돌려보낸 경우 — 소셜 로그인은 이미 끝나 세션이 있는 상태다.
  // 이때는 버튼을 다시 누르게 하지 않고 동의 체크박스만 받아 가입을 완료시킨다(2026-09-15).
  const pendingConsent = Boolean((location.state as { pendingConsent?: boolean } | null)?.pendingConsent)
  const [notice, setNotice] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const canProceed = agreeTerms && agreePrivacy

  // pendingConsent 전용 — 동의 확인 후 가입 완료(원래 가려던 곳으로 이동)
  const handleContinue = () => {
    if (!canProceed) {
      setNotice('이용약관과 개인정보 수집·이용에 모두 동의해주세요.')
      return
    }
    navigate(from, { replace: true })
  }

  // pendingConsent 전용 — 동의를 원치 않으면 방금 생성된 세션을 로그아웃하고 로그인 화면으로
  const handleCancelConsent = async () => {
    await supabase.auth.signOut()
    navigate('/app/login', { replace: true })
  }

  const handleKakao = async () => {
    setNotice('')
    if (!canProceed) {
      setNotice('이용약관과 개인정보 수집·이용에 모두 동의해주세요.')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}${from}`,
        // account_email: 혜택 중복지급 차단 기준 / plusfriends: 채널 추가 상태 조회
        scopes: 'profile_nickname account_email plusfriends',
        // 동의 화면에 "카카오톡 채널 추가" 체크 노출 (뷰티그라운드 채널 _vnwfX)
        queryParams: { channel_public_id: '_vnwfX' },
      },
    })
    if (error) setNotice('카카오 로그인 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
  }

  // 네이버 앱을 회사 계정으로 재등록(2026-08-24) — 개인계정 앱은 client info invalid 오류로 실패,
  // 회사 계정 신규 등록 후 정상 확인(YEG1xy5kENWD037qOt3T). 빌드 캐시 무효화용 재배포 트리거 2차.
  // 네이버는 Supabase 공식 지원 밖이라 커스텀 OAuth — state/from을 sessionStorage에 저장해두고
  // 콜백(AppNaverCallback.tsx)에서 CSRF 대조 후 /api/auth-naver 로 code를 넘겨 세션을 완성한다.
  // entry='signup' — 이 화면은 버튼을 누르기 전에 이미 canProceed로 동의를 확인했으므로,
  // 콜백이 다시 동의 화면으로 돌려보내지 않고 그대로 from으로 통과시킨다(AppLogin.tsx와 구분).
  const handleNaver = () => {
    setNotice('')
    if (!canProceed) {
      setNotice('이용약관과 개인정보 수집·이용에 모두 동의해주세요.')
      return
    }
    const clientId = import.meta.env.VITE_NAVER_CLIENT_ID as string | undefined
    if (!clientId) {
      setNotice('네이버 로그인이 아직 설정되지 않았습니다.')
      return
    }
    const state = crypto.randomUUID()
    sessionStorage.setItem('naver_oauth_state', state)
    sessionStorage.setItem('naver_oauth_from', from)
    sessionStorage.setItem('naver_oauth_entry', 'signup')
    const url = new URL('https://nid.naver.com/oauth2.0/authorize')
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', `${window.location.origin}/app/auth/naver/callback`)
    url.searchParams.set('state', state)
    window.location.href = url.toString()
  }

  // 필수 약관 동의 체크박스 — 일반 진입(소셜 버튼 누르기 전)과 pendingConsent(소셜 로그인은
  // 이미 끝난 뒤 동의만 받는 경우) 두 화면에서 같이 쓰므로 한 번만 작성해 재사용한다.
  const consentCheckboxes = (
    <div className="rounded-control bg-quiet p-4 space-y-2.5 mb-4">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreeTerms}
          onChange={(e) => setAgreeTerms(e.target.checked)}
          className="w-4 h-4 accent-ink mt-0.5 shrink-0"
        />
        <span className="text-[13px] text-ink">
          <span className="text-signal-red font-bold">(필수)</span>{' '}
          <Link to="/terms" target="_blank" rel="noreferrer" className="underline font-bold">이용약관</Link>에 동의합니다
        </span>
      </label>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={agreePrivacy}
          onChange={(e) => setAgreePrivacy(e.target.checked)}
          className="w-4 h-4 accent-ink mt-0.5 shrink-0"
        />
        <span className="text-[13px] text-ink">
          <span className="text-signal-red font-bold">(필수)</span>{' '}
          <Link to="/privacy" target="_blank" rel="noreferrer" className="underline font-bold">개인정보 수집·이용</Link>에 동의합니다
        </span>
      </label>
    </div>
  )

  // pendingConsent — AppLogin.tsx의 카카오·네이버 버튼에서 신규가입으로 판별돼 넘어온 경우.
  // 소셜 로그인 자체는 이미 끝나 세션이 있으므로 버튼을 다시 보여주지 않고 동의만 받는다.
  const formContent = pendingConsent ? (
    <>
      <p className="text-[13px] text-ink-soft text-center mb-4 leading-relaxed">
        소셜 로그인 확인이 끝났어요. 약관에 동의하시면 가입이 완료됩니다.
      </p>
      {consentCheckboxes}

      {notice && (
        <p className="text-center text-[13px] text-ink-faint mt-1 mb-4" role="status">{notice}</p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!canProceed}
        className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
      >
        동의하고 가입 완료
      </button>

      <button
        type="button"
        onClick={handleCancelConsent}
        className="w-full text-center text-[13px] text-ink-faint underline mt-4 focus:outline-none focus-visible:shadow-ring"
      >
        가입을 취소하고 로그아웃할게요
      </button>
    </>
  ) : (
    <>
      {/* 필수 약관 동의 — 소셜 로그인 시작 전 명시적 opt-in (PG 심사 대응) */}
      {consentCheckboxes}

      <div className="rounded-control border border-rule p-6 space-y-3">
        {/* 카카오 — 공식 버튼 규격(#FEE500 배경 + 검정 85% 텍스트) */}
        <button
          type="button"
          onClick={handleKakao}
          disabled={!canProceed}
          className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[15px] py-3.5 focus:outline-none focus-visible:shadow-ring disabled:opacity-40"
          style={{ backgroundColor: '#FEE500', color: 'rgba(0,0,0,0.85)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="rgba(0,0,0,0.85)"
              d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.85C22 6.54 17.52 3 12 3z"
            />
          </svg>
          카카오 1초 회원가입
        </button>

        {/* 네이버 — 공식 버튼 규격(#03C75A 배경 + 흰 텍스트) */}
        <button
          type="button"
          onClick={handleNaver}
          disabled={!canProceed}
          className="w-full flex items-center justify-center gap-2 rounded-control font-bold text-[15px] py-3.5 text-paper focus:outline-none focus-visible:shadow-ring disabled:opacity-40"
          style={{ backgroundColor: '#03C75A' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" d="M13.6 12.5 8.9 5.5H4.9v13h4.5v-7l4.7 7h4v-13h-4.5v7Z" />
          </svg>
          네이버로 시작하기
        </button>
      </div>

      {notice && (
        <p className="text-center text-[13px] text-ink-faint mt-4" role="status">{notice}</p>
      )}

      {/* 휴대폰 인증 회원가입은 SMS API 미도입으로 보류 — 대신 비회원도 주문번호+연락처로
          자기 주문을 조회할 수 있는 기존 기능으로 안내(2026-08-24 대표님 지시) */}
      <p className="text-center text-[13px] text-ink-faint mt-4">
        회원가입 없이 확인하실래요?{' '}
        <Link to="/app/guest-order" className="text-ink-soft font-bold underline focus:outline-none focus-visible:shadow-ring">
          비회원 주문조회(연락처)
        </Link>
      </p>

      <p className="text-center text-[13px] text-ink-soft mt-6">
        이미 쇼핑몰 회원이세요?{' '}
        <Link to="/app/login" state={{ from }} className="text-ink font-bold underline focus:outline-none focus-visible:shadow-ring">로그인</Link>
      </p>
    </>
  )

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopAuthLayout title="회원가입">{formContent}</DesktopAuthLayout>
        <Footer />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div className="max-w-[480px] mx-auto bg-paper md:border md:border-rule">
      <BackHeader title="" />
      <div className="px-6 py-10">
        <h1 className="text-[24px] font-bold text-ink text-center mb-8">회원가입</h1>
        {formContent}
      </div>
      <AppFooter />
    </div>
    </div>
  )
}
