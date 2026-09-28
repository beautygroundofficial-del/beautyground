import { supabase } from './supabase'

// Apple로 로그인 — 앱 심사 조건(Apple 4.8 Login Services: 카카오·네이버 같은 타사 로그인이 있으면 Apple 로그인도 같이 제공).
// Supabase Auth 의 apple 공급자(웹 OAuth 흐름)를 쓴다. 앱(WKWebView) 안에서도 같은 웹 흐름으로 동작한다.
// 켜는 조건: Apple Developer 계정 활성화 → Services ID·키 발급 → Supabase Auth > Providers > Apple 설정 →
//            Vercel 환경변수 VITE_APPLE_LOGIN=1. 그전엔 버튼이 아예 안 보인다(반쪽 기능 노출 방지).
export function appleLoginEnabled(): boolean {
  return (import.meta.env.VITE_APPLE_LOGIN as string | undefined) === '1'
}

// redirectTo: 로그인 화면은 신규가입 판별 게이트(/app/auth/kakao/gate — 이름은 카카오지만 공급자 무관), 가입 화면은 동의를 이미 받았으니 목적지 직행
export async function startAppleSignIn(redirectTo: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo },
  })
  return error ? 'Apple 로그인 연결에 실패했어요. 잠시 후 다시 시도해 주세요.' : null
}
