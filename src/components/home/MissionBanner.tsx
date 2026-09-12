import { useNavigate } from 'react-router-dom'
import { useActiveMissions } from '../../hooks/useActiveMissions'

// 홈에서 활동 미션으로 들어가는 입구.
// 관리자가 미션을 하나도 켜지 않았으면 아예 렌더하지 않는다 — 코드가 배포돼도 쇼핑몰 화면은 그대로다.
// 비로그인 방문자에게도 보여야 유입 장치가 되므로 로그인 여부와 무관하게 missions 테이블만 읽는다.

export default function MissionBanner() {
  const navigate = useNavigate()
  const { missions } = useActiveMissions()

  if (missions.length === 0) return null

  return (
    <section className="px-5 py-3">
      <button
        onClick={() => navigate('/app/missions')}
        className="w-full rounded-card border border-rule bg-quiet px-4 py-3 flex items-center justify-between text-left focus:outline-none focus-visible:shadow-ring"
      >
        <span className="min-w-0">
          <span className="block text-[14px] font-bold text-ink">
            오늘의 활동 미션
          </span>
          <span className="block text-[12px] text-ink-soft mt-0.5 truncate">
            {missions.slice(0, 4).map((m) => `${m.icon ?? ''} ${m.title}`.trim()).join(' · ')}
          </span>
        </span>
        <span className="shrink-0 ml-3 px-3 py-1.5 rounded-full bg-ink text-paper text-[12px] font-semibold">
          포인트 받기
        </span>
      </button>
    </section>
  )
}
