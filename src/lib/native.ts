import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'

// 앱(Capacitor) 안에서 웹이 앱답게 동작하게 하는 최소 장치. (2026-09-12, 앱 스토어 등록 준비)
// 웹 브라우저에서는 아무 일도 하지 않는다 — isNativeApp() 이 false 면 전부 건너뜀.
//
//  ① 안드로이드 뒤로가기 버튼 — 기본은 누르면 앱이 꺼진다. 화면 이력이 있으면 뒤로, 홈이면 앱을 뒤로 보낸다(종료 아님).
//  ② 외부 링크(다른 도메인·target=_blank) — 앱 밖 브라우저로 튕기지 않고 앱 안 브라우저 시트로 연다.
//     같은 도메인·Supabase·카카오/네이버 로그인·결제(포트원/이니시스)는 capacitor.config.ts allowNavigation 대로 앱 안에서 그대로.
//  ③ isNativeApp() — 나중에 "앱에서 만나요"(PC 차단)·앱 전용 동작(걸음 수 등)을 나눌 때 쓰는 스위치.

export function isNativeApp(): boolean {
  try { return Capacitor.isNativePlatform() } catch { return false }
}

export function nativePlatform(): 'ios' | 'android' | 'web' {
  try { return Capacitor.getPlatform() as 'ios' | 'android' | 'web' } catch { return 'web' }
}

// 앱 안에서 그대로 열어도 되는 호스트 — capacitor.config.ts 의 allowNavigation 과 같은 목록
const IN_APP_HOSTS = [
  /(^|\.)beautyground\.co\.kr$/,
  /\.supabase\.co$/,
  /kakao\.com$/,
  /naver\.com$/,
  /portone\.io$/,
  /inicis\.com$/,
]

function isInAppHost(url: URL) {
  if (url.origin === window.location.origin) return true
  return IN_APP_HOSTS.some((re) => re.test(url.hostname))
}

let initialized = false

export function initNative() {
  if (initialized || !isNativeApp()) return
  initialized = true

  // ① 뒤로가기
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) window.history.back()
    else void CapApp.minimizeApp()
  })

  // ② 외부 링크 — 캡처 단계에서 가로채 앱 안 브라우저로
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    let url: URL
    try { url = new URL(a.href, window.location.href) } catch { return }
    if (!/^https?:$/.test(url.protocol)) return            // tel:, mailto: 등은 OS 에 맡긴다
    if (isInAppHost(url) && a.target !== '_blank') return  // 우리 화면 이동은 그대로
    e.preventDefault()
    void Browser.open({ url: url.toString(), presentationStyle: 'popover' })
  }, true)

  // window.open 도 같은 규칙 — 결제창·SNS 공유 등이 앱 밖으로 나가지 않게
  const origOpen = window.open.bind(window)
  window.open = ((target?: string | URL, name?: string, features?: string) => {
    if (typeof target === 'string' || target instanceof URL) {
      try {
        const url = new URL(String(target), window.location.href)
        if (/^https?:$/.test(url.protocol) && !isInAppHost(url)) {
          void Browser.open({ url: url.toString(), presentationStyle: 'popover' })
          return null
        }
      } catch { /* 형식이 이상하면 원래대로 */ }
    }
    return origOpen(target as string, name, features)
  }) as typeof window.open
}
