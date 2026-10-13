import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { syncSteps } from '../lib/steps'

// 걷기 포인트 자동 동기화 — 앱(네이티브)에서만 동작하고, 화면에는 포인트를 받았을 때 잠깐 토스트만 띄운다.
//  - 앱을 열 때, 앱으로 돌아올 때, 열어둔 동안 10분마다 오늘 걸음수를 서버에 보고한다.
//  - 웹이거나 건강 권한이 없으면 아무 일도 하지 않는다(권한 요청은 /app/missions 의 버튼에서만 한다).
export default function StepSync() {
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let alive = true

    const run = async (force = false) => {
      const res = await syncSteps(force)
      if (alive && res && res.awarded > 0) {
        setToast(`걷기 포인트 ${res.awarded}P를 받았어요`)
        setTimeout(() => { if (alive) setToast('') }, 3500)
      }
    }

    void run(true)
    const timer = setInterval(() => { void run() }, 10 * 60 * 1000)
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => { if (isActive) void run() })

    return () => {
      alive = false
      clearInterval(timer)
      void sub.then((s) => s.remove())
    }
  }, [])

  if (!toast) return null
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[100] rounded-pill bg-ink text-paper text-[14px] font-bold px-5 py-3 shadow-card"
      role="status"
    >
      {toast}
    </div>
  )
}
