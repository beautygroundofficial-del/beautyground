import { useEffect, useState } from 'react'

export type ViewMode = 'mobile' | 'desktop'

const KEY = 'bg_view_mode'
const DESKTOP_MIN_WIDTH = 1024
// 실제 폰 화면(대부분 430px 이하)에서는 PC 2단 레이아웃이 찌그러져 글자가 겹치고 깨져 보임
// (매장 직원 피드백 2026-08-10: "PC버전" 토글을 실수로 눌렀다가 폰에서 계속 깨진 화면이 뜸).
// 이 너비보다 좁으면 저장된 값·?view= 값과 무관하게 항상 모바일 레이아웃을 강제한다.
const MOBILE_FORCE_MAX_WIDTH = 640

function detectByWidth(): ViewMode {
  if (typeof window === 'undefined') return 'mobile'
  return window.innerWidth >= DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile'
}

function computeMode(): ViewMode {
  if (typeof window === 'undefined') return 'mobile'
  if (window.innerWidth < MOBILE_FORCE_MAX_WIDTH) return 'mobile'
  const qp = new URLSearchParams(window.location.search).get('view')
  if (qp === 'desktop' || qp === 'mobile') {
    window.localStorage.setItem(KEY, qp)
    return qp
  }
  const v = window.localStorage.getItem(KEY)
  if (v === 'desktop' || v === 'mobile') return v
  return detectByWidth()
}

// 사용자가 PC버전 버튼으로 명시적으로 전환했거나 ?view= 링크로 들어온 경우엔 그 값을 다음 방문에도 유지한다.
// 아직 한 번도 선택한 적 없는 첫 방문(localStorage 없음)은 실제 화면 너비로 자동 판별한다 —
// PC 화면 너비(1024px 이상)로 들어오면 모바일 배너가 늘어나 보이는 대신 PC버전이 바로 뜬다.
// 단, 화면이 MOBILE_FORCE_MAX_WIDTH보다 좁으면 위 모든 값을 무시하고 항상 모바일 — 폰에서
// "PC버전"에 갇혀 화면이 깨지는 사고를 원천적으로 막는다.
// ─────────────────────────────────────────────────────────────────────────
// 2026-09-12 대표님 확정: "PC 버전은 마스터 관리자 페이지나 브랜드 입점사에서만. 앞으로 모든 유저 페이지는
// 모바일 버전으로만." → 유저 화면(/app/*)은 화면 폭·저장값·?view= 와 무관하게 항상 모바일 레이아웃.
// PC용 컴포넌트(Desktop*.tsx)는 지우지 않고 이 스위치로만 끈다 — 되돌릴 일이 있으면 false 로.
// 다음 단계(로드맵): 앱 등록·애플/안드로이드 연결 뒤에는 유저는 PC 웹 자체를 못 쓰게 하고 앱 다운로드 필수.
export const USER_PAGES_MOBILE_ONLY = true

export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(() => (USER_PAGES_MOBILE_ONLY ? 'mobile' : computeMode()))

  useEffect(() => {
    if (USER_PAGES_MOBILE_ONLY) return
    window.localStorage.setItem(KEY, mode)
  }, [mode])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < MOBILE_FORCE_MAX_WIDTH) setMode('mobile')
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return {
    mode,
    isDesktop: mode === 'desktop',
    toggle: () =>
      setMode((m) => {
        if (USER_PAGES_MOBILE_ONLY) return 'mobile'
        const next = m === 'desktop' ? 'mobile' : 'desktop'
        // 폰 화면에서는 "PC버전" 전환 자체를 막는다(눌러도 무반응) — 찌그러진 화면 방지.
        if (next === 'desktop' && typeof window !== 'undefined' && window.innerWidth < MOBILE_FORCE_MAX_WIDTH) {
          return m
        }
        return next
      }),
  }
}
