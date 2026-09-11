import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import LiveStatusBadge from './LiveStatusBadge'
import ProductPeek, { type PrimaryProduct } from './ProductPeek'
import { IconCart } from '../common/Icon'
import CartCountBadge from '../common/CartCountBadge'
import PromoBar from '../home/PromoBar'
import DesktopFooter from '../layout/DesktopFooter'
import { formatDateTime, formatDateOnly, formatTimeOnly, dateKey } from '../../lib/format'
import type { Live } from '../../lib/types'

interface Props {
  loading: boolean
  hero: Live | null
  otherLiveNow: Live[]
  scheduledLives: Live[]
  replays: Live[]
  hostNames: Record<string, string>
  primaryProducts: Record<string, PrimaryProduct>
}

// PC 버전 — 라이브 목록. 모바일의 세로 스택(히어로 1개 + 카드 리스트)을 넓은 화면에서는
// 큰 히어로 배너 + 3열 카드 그리드로 펼친다. 다시보기는 톤 낮춰 4열로 작게.
// 헤더는 공용 DesktopHeader(카테고리탭 포함) 대신 전용 단순 헤더를 쓴다 — 온라인몰 전체 탐색과
// 라이브커머스(지금 방송 중인 상품을 사러 오는 것)는 목적이 달라, 카테고리 탐색 UI가 안 맞는다
// (2026-08-06, 결제·계정설정 페이지가 공용헤더를 안 쓰는 것과 같은 이유).
// 구조(2026-08-06 확정): 지금 라이브 → 예정된 방송(정적, 스크롤 없음 — 다시보기 캐러셀과
// 겹쳐서 화면 전체가 계속 움직이면 산만해지므로 의도적으로 고정 그리드 유지) → 다시보기
// (조회수순 정렬 + 인기 배지, peak_viewers는 방송 중 실시간 갱신되는 실데이터라 신뢰 가능).
export default function DesktopLiveList({ loading, hero, otherLiveNow, scheduledLives, replays, hostNames, primaryProducts }: Props) {
  const railRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const sortedReplays = [...replays].sort((a, b) => (b.peak_viewers ?? 0) - (a.peak_viewers ?? 0))
  const topViewers = sortedReplays[0]?.peak_viewers ?? 0

  // 예정된 방송 — 날짜별로 묶어서 "며칠에 뭐가 있는지" 한눈에 보이게(2026-08-06).
  // scheduledLives는 이미 scheduled_at 오름차순으로 오므로 그룹 순서도 자연히 날짜순.
  const scheduleGroups = (() => {
    const order: string[] = []
    const byDate = new Map<string, Live[]>()
    for (const live of scheduledLives) {
      const key = dateKey(live.scheduled_at)
      if (!byDate.has(key)) { byDate.set(key, []); order.push(key) }
      byDate.get(key)!.push(live)
    }
    return order.map((key) => ({ key, label: formatDateOnly(byDate.get(key)![0].scheduled_at), items: byDate.get(key)! }))
  })()

  const scrollRail = (dir: 1 | -1) => {
    const el = railRef.current
    if (!el) return
    const tile = el.firstElementChild as HTMLElement | null
    const step = tile ? tile.getBoundingClientRect().width + 10 : el.clientWidth * 0.4
    const atEnd = dir === 1 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    if (atEnd) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: dir * step, behavior: 'smooth' })
    }
  }

  // 다시보기도 홈 히어로와 동일하게 2초마다 자동으로 한 칸씩 좌측 이동, 호버 시 정지.
  useEffect(() => {
    if (replays.length <= 1) return
    const timer = setInterval(() => {
      if (!pausedRef.current) scrollRail(1)
    }, 2000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replays.length])

  return (
    <div className="bg-paper min-h-screen">
      <PromoBar />
      <header className="bg-paper border-b border-rule sticky top-[34px] z-50">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/app/home" className="text-[19px] font-bold text-ink tracking-[-0.01em]">
            뷰티그라운드
          </Link>
          <Link to="/app/cart" aria-label="장바구니" className="relative text-ink">
            <IconCart className="w-[20px] h-[20px]" />
            <CartCountBadge />
          </Link>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        <h1 className="text-[22px] font-bold text-ink">라이브</h1>

        {loading ? (
          <p className="mt-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : !hero ? (
          <p className="mt-16 text-center text-[13px] text-ink-faint">진행 중이거나 예정된 라이브가 없습니다.</p>
        ) : (
          <>
            <Link
              to={`/app/live/${hero.id}`}
              className="mt-6 block max-w-[520px] border border-rule overflow-hidden focus:outline-none focus-visible:shadow-ring group"
            >
              <div className="relative">
                {hero.thumbnail_url ? (
                  <img
                    src={hero.thumbnail_url}
                    alt={hero.title}
                    className="w-full aspect-square object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full aspect-square bg-quiet flex items-center justify-center">
                    <img src="/images/bg-logo-mark.png" alt="" className="w-16 h-16 object-contain opacity-60" />
                  </div>
                )}
                <div className="absolute top-5 left-5 flex items-center gap-2">
                  <LiveStatusBadge live={hero} />
                  {hero.status === 'scheduled' && (
                    <span className="inline-flex items-center rounded-control bg-black/50 text-paper text-[12px] font-bold px-2.5 py-1 tabular-nums">
                      {formatDateTime(hero.scheduled_at)}
                      {hero.duration_minutes ? ` · 약 ${hero.duration_minutes}분` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-7">
                <p className="text-ink text-[26px] font-bold leading-snug max-w-[640px]">{hero.title}</p>
                {hero.host_id && hostNames[hero.host_id] && (
                  <p className="text-ink-soft text-[13px] mt-1.5">{hostNames[hero.host_id]} 진행</p>
                )}
                {primaryProducts[hero.id] && (
                  <div className="mt-3">
                    <ProductPeek product={primaryProducts[hero.id]} variant="inline" />
                  </div>
                )}
              </div>
            </Link>

            {otherLiveNow.length > 0 && (
              <div className="mt-8 grid grid-cols-3 gap-5">
                {otherLiveNow.map((live) => (
                  <Link
                    key={live.id}
                    to={`/app/live/${live.id}`}
                    className="block bg-paper border border-rule overflow-hidden hover:border-ink transition-colors focus:outline-none focus-visible:shadow-ring"
                  >
                    <div className="relative">
                      {live.thumbnail_url ? (
                        <img src={live.thumbnail_url} alt={live.title} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="w-full aspect-square bg-quiet flex items-center justify-center">
                          <img src="/images/bg-logo-mark.png" alt="" className="w-12 h-12 object-contain opacity-50" />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <LiveStatusBadge live={live} />
                      </div>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[14.5px] font-bold text-ink line-clamp-2">{live.title}</p>
                      {live.host_id && hostNames[live.host_id] && (
                        <p className="text-[12px] text-ink-soft mt-1">{hostNames[live.host_id]} 진행</p>
                      )}
                      {primaryProducts[live.id] && <ProductPeek product={primaryProducts[live.id]} variant="inline" />}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* 예정된 방송 — 다시보기 캐러셀과 달리 의도적으로 정적 그리드(화면 전체가 계속
            움직이면 산만해짐). 날짜·시간을 카드에 바로 명시해 "언제 뭐가 올라오는지" 한눈에. */}
        {!loading && scheduledLives.length > 0 && (
          <>
            <h2 className="text-[16px] font-bold text-ink mt-14 mb-5">예정된 방송</h2>
            {scheduleGroups.map((group) => (
              <div key={group.key} className="mt-6 first:mt-0">
                <p className="text-[13px] font-bold text-ink-soft mb-3 pb-2 border-b border-rule">{group.label}</p>
                <div className="grid grid-cols-3 gap-5">
                  {group.items.map((live) => (
                    <Link
                      key={live.id}
                      to={`/app/live/${live.id}`}
                      className="block bg-paper border border-rule overflow-hidden hover:border-ink transition-colors focus:outline-none focus-visible:shadow-ring"
                    >
                      <div className="relative">
                        {live.thumbnail_url ? (
                          <img src={live.thumbnail_url} alt={live.title} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-quiet flex items-center justify-center">
                            <img src="/images/bg-logo-mark.png" alt="" className="w-11 h-11 object-contain opacity-50" />
                          </div>
                        )}
                        <span className="absolute top-3 left-3 inline-flex items-center rounded-control bg-ink text-paper text-[11px] font-bold px-2.5 py-1 tabular-nums">
                          {formatTimeOnly(live.scheduled_at)}
                          {live.duration_minutes ? ` · 약 ${live.duration_minutes}분` : ''}
                        </span>
                      </div>
                      <div className="px-4 py-3.5">
                        <p className="text-[14.5px] font-bold text-ink line-clamp-2">{live.title}</p>
                        {live.host_id && hostNames[live.host_id] && (
                          <p className="text-[12px] text-ink-soft mt-1">{hostNames[live.host_id]} 진행</p>
                        )}
                        {primaryProducts[live.id] && <ProductPeek product={primaryProducts[live.id]} variant="inline" />}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && replays.length > 0 && (
          <>
            <h2 className="text-[16px] font-bold text-ink mt-14 mb-5">다시보기</h2>
            <div
              className="relative"
              onMouseEnter={() => { pausedRef.current = true }}
              onMouseLeave={() => { pausedRef.current = false }}
            >
              <div
                ref={railRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {sortedReplays.map((live) => (
                  <Link
                    key={live.id}
                    to={`/app/live/${live.id}`}
                    className="relative shrink-0 w-[calc((100%-20px)/3)] min-w-[280px] block bg-paper border border-rule overflow-hidden hover:border-ink transition-colors focus:outline-none focus-visible:shadow-ring"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    <div className="relative">
                      {live.thumbnail_url ? (
                        <img src={live.thumbnail_url} alt={live.title} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="w-full aspect-square bg-quiet flex items-center justify-center">
                          <img src="/images/bg-logo-mark.png" alt="" className="w-10 h-10 object-contain opacity-50" />
                        </div>
                      )}
                      <span className="absolute top-2.5 left-2.5 inline-flex items-center rounded-control bg-ink text-paper text-[10.5px] font-bold px-2 py-0.5 tracking-[0.04em]">
                        REPLAY
                      </span>
                      {/* 인기 배지 — 조회수 0인데 1등이라고 붙이면 오히려 신뢰를 깎아먹으니 실제 시청자가
                          있었던 것에만(topViewers>0) 붙인다. */}
                      {topViewers > 0 && live.peak_viewers === topViewers && (
                        <span className="absolute top-2.5 right-2.5 inline-flex items-center rounded-control bg-signal-red text-paper text-[10.5px] font-bold px-2 py-0.5 tracking-[0.04em]">
                          인기
                        </span>
                      )}
                    </div>
                    <div className="px-3.5 py-3">
                      <p className="text-[13px] font-medium text-ink line-clamp-2">{live.title}</p>
                      {primaryProducts[live.id] && <ProductPeek product={primaryProducts[live.id]} variant="inline" />}
                    </div>
                  </Link>
                ))}
              </div>

              {replays.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => scrollRail(-1)}
                    aria-label="이전 다시보기"
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center text-ink text-[26px] leading-none hover:opacity-70 transition-opacity focus:outline-none focus-visible:shadow-ring"
                    style={{ filter: 'drop-shadow(0 1px 3px rgba(255,255,255,0.9))' }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollRail(1)}
                    aria-label="다음 다시보기"
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center text-ink text-[26px] leading-none hover:opacity-70 transition-opacity focus:outline-none focus-visible:shadow-ring"
                    style={{ filter: 'drop-shadow(0 1px 3px rgba(255,255,255,0.9))' }}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <DesktopFooter />
    </div>
  )
}
