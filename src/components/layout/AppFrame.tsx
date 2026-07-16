import type { ReactNode } from 'react'
import BottomNav from './BottomNav'

/**
 * 고객 앱 공통 프레임 — PC에서도 모바일 앱처럼 가운데 480px 고정 폭 + 바깥 여백/배경.
 * AppHome(HomeBody)과 동일 규격. 모든 /app/* 페이지는 이 프레임 안에 렌더링한다.
 */
export default function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-2 md:py-6">
      <div className="max-w-[480px] mx-auto bg-cream-4 min-h-screen md:min-h-0 md:rounded-lg md:overflow-hidden md:shadow-[0_12px_28px_-16px_rgba(23,19,16,.35)] pb-24">
        {children}
        <BottomNav />
      </div>
    </div>
  )
}
