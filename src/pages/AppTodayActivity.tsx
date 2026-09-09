import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'

// 오늘의 활동 — "내가 오늘 뭘 했나"만 조용히 보여주는 개인 요약 화면.
// 커뮤니티 로드맵 4-2 "다음" 목록의 첫 번째 항목(2026-09-09) — 대표님 지시대로
// 로드맵을 따라 한 화면씩 늘려가는 첫걸음. AppMissions("오늘 할 수 있는 일")와 짝을 이루되
// 반대 방향이다 — 저건 아직 안 한 것, 이건 이미 한 것.
//
// 설계 원칙(로드맵 0장) 그대로: 등수·비교 없음, 숫자는 있는 그대로만, 재촉 문구 없음.
interface TodayActivity {
  answered_question: boolean
  question_text: string | null
  my_answer: string | null
  diary_count: number
  latest_diary: string | null
  reaction_count: number
  comment_count: number
  points_today: number
  phone_verified: boolean
}

export default function AppTodayActivity() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [data, setData] = useState<TodayActivity | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setLoggedIn(!!session)
      if (!session) { setLoading(false); return }
      const { data: rows, error } = await supabase.rpc('get_my_today_activity')
      if (!error && rows && rows[0]) setData(rows[0] as TodayActivity)
      setLoading(false)
    })()
  }, [])

  const didNothing = data
    && !data.answered_question && data.diary_count === 0
    && data.reaction_count === 0 && data.comment_count === 0

  return (
    <AppFrame>
      {/* AppMissions.tsx("아직 안 한 것")와 짝을 이룬다 — 서로 오갈 수 있게(2026-09-09) */}
      <BackHeader
        title="오늘의 활동"
        rightElement={
          <button
            type="button"
            onClick={() => navigate('/app/missions')}
            className="text-[12.5px] text-ink-soft underline underline-offset-2 focus:outline-none focus-visible:shadow-ring"
          >
            활동 미션
          </button>
        }
      />

      <div className="px-5 py-6">
        {loggedIn === false && (
          <div className="text-center py-16">
            <p className="text-[14px] text-ink-soft mb-4">로그인하면 오늘 한 일을 모아볼 수 있어요</p>
            <button
              onClick={() => navigate('/app/login', { state: { from: '/app/today' } })}
              className="rounded-control bg-ink text-paper font-bold text-[14px] px-6 py-3 focus:outline-none focus-visible:shadow-ring"
            >
              로그인
            </button>
          </div>
        )}

        {loading && loggedIn && (
          <p className="text-center py-16 text-[13px] text-ink-faint">불러오는 중…</p>
        )}

        {!loading && loggedIn && data && (
          <>
            <p className="text-[13px] text-ink-faint mb-1">오늘 하루</p>
            <h1 className="text-[19px] font-bold text-ink mb-6">이만큼 지내셨어요</h1>

            {didNothing ? (
              <div className="rounded-card bg-quiet px-5 py-8 text-center">
                <p className="text-[14px] text-ink-soft mb-1">아직 오늘은 조용하네요</p>
                <p className="text-[12.5px] text-ink-faint">
                  홈에서 오늘의 질문에 한 줄만 남겨도 괜찮아요
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 오늘의 질문 답변 */}
                <button
                  onClick={() => navigate('/app/home')}
                  className="w-full text-left rounded-card border border-rule px-4 py-4 focus:outline-none focus-visible:shadow-ring"
                >
                  <p className="text-[12px] text-ink-faint mb-1">오늘의 질문</p>
                  {data.answered_question ? (
                    <>
                      <p className="text-[13px] text-ink-faint truncate">{data.question_text}</p>
                      <p className="text-[14px] text-ink mt-1">{data.my_answer}</p>
                    </>
                  ) : data.question_text ? (
                    <p className="text-[13.5px] text-ink-soft">
                      "{data.question_text}" — 아직 답을 안 남기셨어요
                    </p>
                  ) : (
                    <p className="text-[13.5px] text-ink-faint">오늘은 걸린 질문이 없어요</p>
                  )}
                </button>

                {/* 이야기 */}
                {data.diary_count > 0 && (
                  <button
                    onClick={() => navigate('/app/diary')}
                    className="w-full text-left rounded-card border border-rule px-4 py-4 focus:outline-none focus-visible:shadow-ring"
                  >
                    <p className="text-[12px] text-ink-faint mb-1">
                      오늘 남긴 이야기 {data.diary_count}개
                    </p>
                    {data.latest_diary && (
                      <p className="text-[14px] text-ink line-clamp-2">{data.latest_diary}</p>
                    )}
                  </button>
                )}

                {/* 공감·댓글 — 숫자만, 경쟁 아님 */}
                {(data.reaction_count > 0 || data.comment_count > 0) && (
                  <button
                    onClick={() => navigate('/app/diary')}
                    className="w-full text-left rounded-card border border-rule px-4 py-4 focus:outline-none focus-visible:shadow-ring"
                  >
                    <p className="text-[12px] text-ink-faint mb-1">누군가에게 남긴 마음</p>
                    <p className="text-[14px] text-ink">
                      {[
                        data.reaction_count > 0 ? `공감 ${data.reaction_count}번` : null,
                        data.comment_count > 0 ? `댓글 ${data.comment_count}개` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                )}
              </div>
            )}

            {/* 포인트 — 앞세우지 않는다(로드맵 1-2 원칙). 인증 전이면 배너와 같은 안내만 조용히. */}
            <div className="mt-6 pt-5 border-t border-rule flex items-center justify-between">
              <span className="text-[12.5px] text-ink-faint">오늘 받은 포인트</span>
              {data.phone_verified ? (
                <span className="text-[14px] font-bold text-ink">
                  {data.points_today > 0 ? `${data.points_today.toLocaleString('ko-KR')}P` : '0P'}
                </span>
              ) : (
                <button
                  onClick={() => navigate('/app/home')}
                  className="text-[12px] text-ink-soft underline"
                >
                  전화번호 인증하면 받을 수 있어요
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </AppFrame>
  )
}
