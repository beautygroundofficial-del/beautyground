import type { CapacitorConfig } from '@capacitor/cli'

// 뷰티그라운드 앱 껍데기 — 2026-09-12 앱 스토어 등록 준비(옵시디언 `03 홈페이지/앱 스토어 등록.md`).
//
// 방식: 웹(beautyground.co.kr)을 그대로 앱 안에 띄운다(server.url). 웹을 고치면 앱도 재심사 없이 바로 반영되고,
// 카카오·네이버 로그인 리다이렉트도 같은 주소라 그대로 동작한다. 걸음 수(HealthKit·Health Connect)·푸시 같은
// 네이티브 기능은 플러그인으로 붙인다 — 애플 심사 4.2(웹사이트만 감싼 앱 거절)를 넘기려면 이 네이티브 기능이 있어야 한다.
//
// 로컬에서 개발 서버를 앱에 띄우려면 CAP_SERVER_URL=http://<PC IP>:5199 로 실행(cleartext 필요).
// dist 를 앱에 내장하는 방식으로 바꾸려면 server 블록을 지우고 webDir 만 쓰면 된다(npm run build 후 npx cap sync).

const serverUrl = process.env.CAP_SERVER_URL || 'https://beautyground.co.kr'

const config: CapacitorConfig = {
  appId: 'kr.co.beautyground.app',
  appName: '뷰티그라운드',
  webDir: 'dist',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    // 로그인(카카오·네이버·Supabase)·결제(포트원/이니시스) 화면은 앱 안에서 열려야 한다
    allowNavigation: [
      'beautyground.co.kr',
      '*.beautyground.co.kr',
      '*.supabase.co',
      'kauth.kakao.com',
      'accounts.kakao.com',
      'nid.naver.com',
      '*.portone.io',
      '*.inicis.com',
    ],
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#FFFFFF',
  },
  android: {
    backgroundColor: '#FFFFFF',
    allowMixedContent: false,
  },
}

export default config
