import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { getMyPointsBalance } from '../lib/rewards'
import {
  getMyMissions, claimMission, missionProgressRatio, nextMilestone, remainingPoints,
  type MyMission,
} from '../lib/missions'

// 활동 미션 — 걷기·일기·라이브시청 등 참여하면 포인트를 받는 화면.
// 미션 목록은 관리자(/admin/missions)가 만든 것을 그대로 가져온다(코드에 미션이 하드코딩되지 않음).
// 걸음수는 네이티브 앱(헬스킷/헬스커넥트) 전환 후에 자동 연동되며, 그전까지 걷기 미션은 목록에만 노출된다.

// 버튼만 눌러 받는 게 아니라 실제 활동을 해야 적립되는 미션은 해당 화면으로 보낸다.
const ACTION_ROUTE: Record<string, { to: string; label: string }> = {
  diary_post: { to: '/app/diary', label: '쓰러 가기' },
}

const METRIC_UNIT: Record<string, string> = {
  steps: '보',
  live_minutes: '분',
  attendance: '회',
  diary_post: '개',
  review_post: '개',
}

export default function AppMissions() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [missions, setMissions] = useState<MyMission[]>([])
  const [points, setPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setLoggedIn(!!session)
    if (!session) { setLoading(false); return }
    const [ms, bal] = await Promise.all([getMyMissions(), getMyPointsBalance()])
    setMissions(ms)
    setPoints(bal)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleClaim = async (m: MyMission) => {
    setBusyKey(m.key)
    // 출석·일기 등 1회성은 1을 보고. 걸음수는 앱 연동 전이라 아직 보고할 값이 없다.
    const res = await claimMission(m.key, 1)
    setBusyKey('')
    if (!res) { showToast('잠시 후 다시 시도해 주세요'); return }
    showToast(res.awarded > 0 ? `${res.awarded}P를 받았어요` : res.message)
    void load()
  }

  if (loading) {
    return (
      <AppFrame>
        <BackHeader title="활동 미션" />
        <p className="px-5 py-10 text-[13px] text-ink-soft">불러오는 중…</p>
      </AppFrame>
    )
  }

  if (loggedIn === false) {
    return (
      <AppFrame>
        <BackHeader title="활동 미션" />
        <div className="px-5 py-12 text-center">
          <p className="text-[14px] text-ink mb-1 font-semibold">로그인이 필요해요</p>
          <p className="text-[13px] text-ink-soft mb-5">로그인하면 매일 포인트를 모을 수 있어요.</p>
          <button onClick={() => navigate('/app/login')}
            className="px-6 py-3 rounded-control bg-ink text-paper text-[14px] font-semibold">
            로그인하기
          </button>
        </div>
      </AppFrame>
    )
  }

  return (
    <AppFrame>
      {/* "아직 안 한 것"(이 화면)과 "이미 한 것"(오늘의 활동)을 오갈 수 있게 짝지어 둔다(2026-09-09) */}
      <BackHeader
        title="활동 미션"
        rightElement={
          <button
            type="button"
            onClick={() => navigate('/app/today')}
            className="text-[12.5px] text-ink-soft underline underline-offset-2 focus:outline-none focus-visible:shadow-ring"
          >
            오늘의 활동
          </button>
        }
      />

      {/* 내 포인트 */}
      <section className="mx-5 mt-4 rounded-card bg-ink text-paper px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[12px] opacity-70">내 적립금</p>
          <p className="text-[24px] font-bold leading-tight">{points.toLocaleString()}P</p>
        </div>
        <button onClick={() => navigate('/app/benefits')}
          className="text-[12px] underline opacity-80">혜택함 보기</button>
      </section>

      <p className="px-5 mt-5 mb-2 text-[13px] text-ink-soft">
        오늘의 미션을 완료하고 포인트를 받아보세요.
      </p>

      {missions.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-[13px] text-ink-soft">진행 중인 미션이 없어요.<br />곧 새로운 미션이 열릴 예정이에요.</p>
        </div>
      ) : (
        <ul className="px-5 pb-24 space-y-3">
          {missions.map((m) => {
            const ratio = missionProgressRatio(m)
            const next = nextMilestone(m)
            const left = remainingPoints(m)
            const done = left === 0
            const unit = METRIC_UNIT[m.metric] ?? ''
            const goal = m.milestones.length > 0
              ? Math.max(...m.milestones.map((s) => s.value))
              : m.target_value
            // 걸음수는 네이티브 앱 연동 전이라 사용자가 직접 받을 수 없다(자동 집계 대상).
            const autoOnly = m.metric === 'steps'
            // 실제 활동을 해야 적립되는 미션은 버튼으로 주지 않고 해당 화면으로 보낸다.
            // (일기는 글을 올리는 순간 create_diary RPC 안에서 적립된다)
            const goTo = ACTION_ROUTE[m.metric]

            return (
              <li key={m.id} className="rounded-card border border-rule bg-paper p-4">
                <div className="flex items-start gap-3">
                  <span className="text-[22px] leading-none mt-0.5">{m.icon ?? '🎯'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-ink">{m.title}</p>
                    {m.description && (
                      <p className="text-[12px] text-ink-soft mt-0.5">{m.description}</p>
                    )}

                    {/* 진행률 */}
                    <div className="mt-3">
                      <div className="h-1.5 rounded-full bg-ink/10 overflow-hidden">
                        <div className="h-full bg-signal-blue transition-all"
                          style={{ width: `${Math.round(ratio * 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[11px] text-ink-faint">
                          {m.current_value.toLocaleString()}{unit} / {goal.toLocaleString()}{unit}
                        </span>
                        <span className="text-[11px] text-ink-faint">
                          {done ? `오늘 ${m.awarded_points}P 받음`
                                : next ? `다음 ${next.value.toLocaleString()}${unit} → ${next.points}P`
                                       : `${left}P 남음`}
                        </span>
                      </div>
                    </div>

                    {m.reward_note && (
                      <p className="text-[11px] text-signal-blue mt-2">{m.reward_note}</p>
                    )}
                  </div>

                  <div className="shrink-0 self-center">
                    {done ? (
                      <span className="px-3 py-2 rounded-control bg-ink/5 text-ink-faint text-[12px] font-semibold">
                        완료
                      </span>
                    ) : autoOnly ? (
                      <span className="px-3 py-2 rounded-control bg-ink/5 text-ink-faint text-[11px] text-center leading-tight">
                        앱에서<br />자동 적립
                      </span>
                    ) : goTo ? (
                      <button onClick={() => navigate(goTo.to)}
                        className="px-4 py-2 rounded-control bg-signal-blue text-paper text-[12px] font-semibold">
                        {goTo.label}
                      </button>
                    ) : (
                      <button onClick={() => void handleClaim(m)} disabled={busyKey === m.key}
                        className="px-4 py-2 rounded-control bg-signal-blue text-paper text-[12px] font-semibold disabled:opacity-50">
                        {busyKey === m.key ? '처리 중' : '받기'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {toast}
        </div>
      )}
    </AppFrame>
  )
}
