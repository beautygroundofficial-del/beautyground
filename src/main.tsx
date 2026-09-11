import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App'
import { initNative } from './lib/native'

// 앱(Capacitor) 안에서만 동작 — 뒤로가기 버튼·외부 링크 처리. 브라우저에선 아무 것도 안 한다(2026-09-12)
initNative()

// 우클릭(컨텍스트 메뉴) 사이트 전체 차단 — 이미지 주소 복사·저장을 일반 고객이 쉽게 못 하도록.
// 참고: 개발자도구 등으로는 우회 가능한 약한 방어라, 완전한 이미지 보호 수단은 아님.
document.addEventListener('contextmenu', (e) => e.preventDefault())

// 웹 푸시 알림용 서비스 워커 등록(팔로우한 브랜드 라이브 시작 알림). 미지원 브라우저(iOS 사파리 탭 등)는 조용히 무시.
// 재배포 직후 열려 있던 탭에서 lazy 라우트 청크(옛 해시 파일)가 사라져 로드 실패 → 빈 화면이 되는 문제 방지.
// 세션당 1회만 자동 새로고침해 새 index.html·청크로 갈아탄다(무한 새로고침 방지). 2026-08-26 /export→/x 빈 화면 사고.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'bg:chunk-reload'
  if (sessionStorage.getItem(KEY) === location.href) return
  sessionStorage.setItem(KEY, location.href)
  event.preventDefault()
  location.reload()
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
