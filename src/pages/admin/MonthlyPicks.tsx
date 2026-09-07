import { useCallback, useEffect, useState } from 'react'
import { IconTrophy } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'

// 월간 선정 — 이달의 이야기 / 이달의 토닥이 (2026-09-07)
//
// 대표님 지시: "조회수 참여도 좋아요 댓글 등 지수가 높은 월 1회 선정하여 포인트",
//             "히로인즈와 차별화로 가야 해"
//
// 설계 —
//  · 조회수는 지수에 넣지 않는다(가장 쉽게 조작되고, 자극적인 제목을 쓰게 만든다)
//  · 받은 쪽은 '서로 다른 사람 수'로 센다 — 한 사람이 연타해도 1
//  · 히로인스는 잘 쓴 사람에게 보상하지만, 우리는 **남을 토닥인 사람**도 함께 뽑는다
//  · 자동 지급하지 않는다. 이 화면에서 사람이 보고 확정할 때만 포인트가 나간다
//
// ⚠️ 확정은 되돌릴 수 없다(포인트가 원장에 즉시 기록됨) — 확인 문구를 반드시 거친다.

type Kind = 'story' | 'comforter'

interface StoryRow {
  diary_id: string
  user_id: string
  nickname: string | null
  content: string
  images: string[] | null
  reactor_count: number
  commenter_count: number
  score: number
  created_at: string
  already_picked: boolean
}

interface ComforterRow {
  user_id: string
  nickname: string | null
  given_reactions: number
  given_comments: number
  active_days: number
  score: number
  already_picked: boolean
}

function monthStartKST(offsetMonths = 0) {
  const now = new Date()
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const d = new Date(kst.getFullYear(), kst.getMonth() + offsetMonths, 1)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-01`
}

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

const inputCls =
  'border border-rule rounded-control px-3 py-2 text-[13px] text-ink focus:outline-none focus:border-ink transition-colors bg-paper'

export default function AdminMonthlyPicks() {
  const [period, setPeriod] = useState(monthStartKST())
  const [kind, setKind] = useState<Kind>('story')
  const [stories, setStories] = useState<StoryRow[]>([])
  const [comforters, setComforters] = useState<ComforterRow[]>([])
  const [points, setPoints] = useState(1000)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [s, c] = await Promise.all([
      supabase.rpc('get_monthly_story_candidates', { p_period: period, p_limit: 20 }),
      supabase.rpc('get_monthly_comforter_candidates', { p_period: period, p_limit: 20 }),
    ])
    if (s.error || c.error) setError(`불러오지 못했습니다: ${s.error?.message ?? c.error?.message}`)
    setStories((s.data ?? []) as StoryRow[])
    setComforters((c.data ?? []) as ComforterRow[])
    setLoading(false)
  }, [period])

  useEffect(() => { void load() }, [load])

  const confirm = async (target: { userId: string; diaryId?: string; label: string; rowKey: string }) => {
    const label = kind === 'story' ? '이달의 이야기' : '이달의 토닥이'
    if (!window.confirm(
      `${period.slice(0, 7)} ${label}\n\n${target.label}\n지급 포인트: ${points.toLocaleString()}P\n\n` +
      '확정하면 포인트가 즉시 지급되고 되돌릴 수 없습니다. 진행할까요?'
    )) return

    setBusyId(target.rowKey)
    const { data, error: err } = await supabase.rpc('confirm_monthly_pick', {
      p_period: period,
      p_kind: kind,
      p_user_id: target.userId,
      p_points: points,
      p_diary_id: target.diaryId ?? null,
      p_note: null,
    })
    setBusyId(null)
    const row = (Array.isArray(data) ? data[0] : data) as { pick_id: string | null; message: string } | null
    if (err || !row?.pick_id) { setError(row?.message || err?.message || '확정하지 못했습니다'); return }
    void load()
  }

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">월간 선정</p>
      </header>

      <main className="max-w-[1200px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">월간 선정</h1>
        <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">
          한 달에 한 번, 커뮤니티에 마음을 나눈 분을 뽑아 포인트를 드립니다.
          <br />
          <strong>이달의 이야기</strong>는 서로 다른 사람 몇 명에게 가닿았는지로,{' '}
          <strong>이달의 토닥이</strong>는 남에게 얼마나 마음을 나눠줬는지로 셉니다.
          <br />
          조회수는 지수에 넣지 않습니다 — 가장 쉽게 조작되고, 자극적인 글을 쓰게 만들기 때문입니다.
          <br />
          <span className="text-signal-red">확정하면 포인트가 즉시 지급되며 되돌릴 수 없습니다.</span>
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls}>
            {[0, -1, -2, -3].map((off) => {
              const v = monthStartKST(off)
              return <option key={v} value={v}>{v.slice(0, 7)}</option>
            })}
          </select>

          <div className="flex gap-2">
            {([['story', '이달의 이야기'], ['comforter', '이달의 토닥이']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-3.5 py-2 rounded-pill text-[13px] border transition-colors ${
                  kind === k ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            지급 포인트
            <input
              type="number"
              min={0}
              step={100}
              value={points}
              onChange={(e) => setPoints(Math.max(0, Number(e.target.value) || 0))}
              className={`${inputCls} w-[120px] tabular-nums`}
            />
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{error}</div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : kind === 'story' ? (
          stories.length === 0 ? (
            <div className="text-center py-24 bg-paper rounded-md border border-rule">
              <IconTrophy size={40} className="text-rule mx-auto mb-3" />
              <p className="text-[14px] text-ink-faint">이 달에는 아직 공감·댓글을 받은 이야기가 없습니다</p>
            </div>
          ) : (
            <div className="bg-paper rounded-md border border-rule overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead>
                  <tr className="border-b border-rule text-ink-soft">
                    <th className="px-4 py-3 font-medium whitespace-nowrap">지수</th>
                    <th className="px-4 py-3 font-medium">이야기</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">공감한 사람</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">댓글 남긴 사람</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">작성자</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">선정</th>
                  </tr>
                </thead>
                <tbody>
                  {stories.map((r) => (
                    <tr key={r.diary_id} className="border-b border-rule last:border-b-0">
                      <td className="px-4 py-3 font-bold text-ink tabular-nums">{r.score}</td>
                      <td className="px-4 py-3 text-ink max-w-[420px]">
                        <p className="line-clamp-2">{r.content}</p>
                      </td>
                      <td className="px-4 py-3 text-ink-soft tabular-nums">{r.reactor_count}</td>
                      <td className="px-4 py-3 text-ink-soft tabular-nums">{r.commenter_count}</td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{maskName(r.nickname)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.already_picked ? (
                          <span className="text-[12px] text-ink-faint">선정됨</span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === r.diary_id}
                            onClick={() => void confirm({
                              userId: r.user_id, diaryId: r.diary_id, rowKey: r.diary_id,
                              label: `${maskName(r.nickname)} — ${r.content.slice(0, 40)}`,
                            })}
                            className="text-[12px] text-signal-blue hover:underline disabled:opacity-40"
                          >
                            {busyId === r.diary_id ? '처리 중…' : '선정하고 지급'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : comforters.length === 0 ? (
          <div className="text-center py-24 bg-paper rounded-md border border-rule">
            <IconTrophy size={40} className="text-rule mx-auto mb-3" />
            <p className="text-[14px] text-ink-faint">이 달에는 아직 남의 글에 마음을 남긴 분이 없습니다</p>
          </div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">지수</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">회원</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">공감한 글</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">댓글 단 글</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">활동한 날</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">선정</th>
                </tr>
              </thead>
              <tbody>
                {comforters.map((r) => (
                  <tr key={r.user_id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3 font-bold text-ink tabular-nums">{r.score}</td>
                    <td className="px-4 py-3 text-ink whitespace-nowrap">{maskName(r.nickname)}</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums">{r.given_reactions}</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums">{r.given_comments}</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums">{r.active_days}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.already_picked ? (
                        <span className="text-[12px] text-ink-faint">선정됨</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === r.user_id}
                          onClick={() => void confirm({
                            userId: r.user_id, rowKey: r.user_id,
                            label: `${maskName(r.nickname)} — 공감 ${r.given_reactions} · 댓글 ${r.given_comments} · ${r.active_days}일 활동`,
                          })}
                          className="text-[12px] text-signal-blue hover:underline disabled:opacity-40"
                        >
                          {busyId === r.user_id ? '처리 중…' : '선정하고 지급'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
