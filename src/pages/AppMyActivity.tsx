import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import BottomNav from '../components/layout/BottomNav'
import { supabase } from '../lib/supabase'
import { getMyPointsBalance } from '../lib/rewards'
import { getMyActivityByDate, getPointsRecommendedProducts, type ActivityDayItem, type PointsProduct } from '../lib/myActivity'

// 나의 활동 — 마이페이지 상단 진입 버튼으로 들어오는 별도 화면(2026-09-13).
// 대표님 지시: "모임 가입/클래스 신청" 같은 개념 대신, 내가 이야기·속 이야기를 남긴 날짜를
// 캘린더로 보여줘서 자주 방문하는 동기부여를 만들고, 보유 포인트로 지금 살 수 있는
// 상품을 함께 추천해서 "포인트로 뭘 살 수 있는지"를 바로 보여준다.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad2(n: number) { return String(n).padStart(2, '0') }
function toISODate(y: number, m: number, d: number) { return `${y}-${pad2(m + 1)}-${pad2(d)}` }

export default function AppMyActivity() {
  const navigate = useNavigate()
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() }) // m: 0-11
  const [byDate, setByDate] = useState<Map<string, ActivityDayItem[]>>(new Map())
  const [selected, setSelected] = useState<string>(toISODate(today.getFullYear(), today.getMonth(), today.getDate()))
  const [points, setPoints] = useState(0)
  const [products, setProducts] = useState<PointsProduct[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/app/login', { replace: true, state: { from: '/app/my-activity' } }); return }
      setLoading(true)
      const monthStart = toISODate(cursor.y, cursor.m, 1)
      const monthEndExclusive = toISODate(cursor.m === 11 ? cursor.y + 1 : cursor.y, cursor.m === 11 ? 0 : cursor.m + 1, 1)
      const [activity, pts] = await Promise.all([
        getMyActivityByDate(monthStart, monthEndExclusive),
        getMyPointsBalance(),
      ])
      if (!active) return
      setByDate(activity)
      setPoints(pts)
      setProducts(await getPointsRecommendedProducts(pts))
      setLoading(false)
    })()
    return () => { active = false }
  }, [cursor, navigate])

  // 이번 달 날짜 그리드 — 앞뒤 빈칸을 null로 채운 6x7 형태
  const grid = useMemo(() => {
    const firstDow = new Date(cursor.y, cursor.m, 1).getDay()
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor])

  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate())
  const monthLabel = `${cursor.y}년 ${cursor.m + 1}월`
  const selectedItems = byDate.get(selected) ?? []

  const goMonth = (delta: number) => {
    setCursor((prev) => {
      const m = prev.m + delta
      if (m < 0) return { y: prev.y - 1, m: 11 }
      if (m > 11) return { y: prev.y + 1, m: 0 }
      return { y: prev.y, m }
    })
  }

  return (
    <AppFrame>
      <BackHeader title="나의 활동" onBack={() => navigate('/app/mypage')} />

      {/* 보유 포인트 */}
      <section className="px-5 pt-5">
        <div className="rounded-card bg-quiet/50 px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-bold text-ink">보유 포인트</span>
          <span className="text-[15px] font-bold tabular-nums text-ink bg-signal-yellow px-2 py-0.5">
            {points.toLocaleString()}P
          </span>
        </div>
      </section>

      {/* 캘린더 */}
      <section className="px-5 pt-6">
        <div className="rounded-card border border-rule bg-paper p-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => goMonth(-1)} aria-label="이전 달" className="w-8 h-8 flex items-center justify-center text-ink-soft focus:outline-none focus-visible:shadow-ring">‹</button>
            <span className="text-[15px] font-bold text-ink">{monthLabel}</span>
            <button type="button" onClick={() => goMonth(1)} aria-label="다음 달" className="w-8 h-8 flex items-center justify-center text-ink-soft focus:outline-none focus-visible:shadow-ring">›</button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11px] font-medium py-1 ${i === 0 ? 'text-signal-red' : i === 6 ? 'text-signal-blue' : 'text-ink-faint'}`}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1.5">
            {grid.map((d, i) => {
              if (d === null) return <div key={i} />
              const iso = toISODate(cursor.y, cursor.m, d)
              const has = byDate.has(iso)
              const isToday = iso === todayISO
              const isSelected = iso === selected
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(iso)}
                  className="flex flex-col items-center gap-0.5 py-0.5 focus:outline-none focus-visible:shadow-ring"
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] tabular-nums ${
                      isToday ? 'bg-ink text-paper font-bold'
                        : isSelected ? 'border-2 border-ink text-ink font-semibold'
                        : 'text-ink-soft'
                    }`}
                  >
                    {d}
                  </span>
                  <span className={`w-1 h-1 rounded-full ${has ? 'bg-accent-deep' : 'bg-transparent'}`} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        </div>

        {/* 선택한 날의 글 */}
        <div className="mt-4">
          <p className="text-[13px] font-bold text-ink mb-2">
            {Number(selected.slice(5, 7))}월 {Number(selected.slice(8, 10))}일에 남긴 글
          </p>
          {selectedItems.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint py-3">이 날은 남긴 글이 없어요</p>
          ) : (
            <ul className="space-y-2">
              {selectedItems.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => navigate(item.kind === 'diary' ? '/app/diary' : `/app/board/${item.id}`)}
                    className="w-full text-left rounded-card border border-rule bg-paper px-3.5 py-3 focus:outline-none focus-visible:shadow-ring"
                  >
                    <span className="text-[11px] font-semibold text-ink-soft bg-quiet rounded-full px-2 py-0.5">
                      {item.kind === 'diary' ? '이야기' : '속 이야기'}
                    </span>
                    <p className="text-[13px] text-ink leading-relaxed line-clamp-2 mt-1.5 whitespace-pre-wrap">{item.content}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 포인트로 살 수 있는 상품 */}
      {!loading && products.length > 0 && (
        <section className="px-5 pt-7 pb-10">
          <p className="text-[15px] font-bold text-ink mb-3">지금 포인트로 살 수 있어요</p>
          <ul className="space-y-2.5">
            {products.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/product/${p.id}`)}
                  className="w-full flex items-center gap-3 rounded-card border border-rule bg-paper p-3 text-left focus:outline-none focus-visible:shadow-ring"
                >
                  <div className="w-14 h-14 rounded-lg bg-quiet overflow-hidden shrink-0">
                    {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-ink truncate">{p.name}</p>
                    <p className="text-[13px] font-bold tabular-nums text-ink mt-0.5">
                      {(p.salePrice ?? p.price).toLocaleString()}원
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BottomNav />
    </AppFrame>
  )
}
