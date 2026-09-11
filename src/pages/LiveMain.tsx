import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Live } from '../lib/types'
import AppHeader from '../components/layout/AppHeader'
import AppFrame from '../components/layout/AppFrame'
import AppFooter from '../components/layout/AppFooter'
import PromoBar from '../components/home/PromoBar'
import { comma, formatLiveSchedTime } from '../lib/format'
import { useShopLives } from '../hooks/useShopLives'

// /live — 라이브방송 메인페이지. 온라인몰 메인(/app/home)과 별개의 진입점이지만 상품 상세는
// 공유한다. 라이브에서 들어온 구매는 live_id로 태깅되어 정산·통계에서 구분된다(AppOrder.tsx).
// 2026-08-12 대표님 지시로 재구축 — 실데이터(Supabase) 그대로 연결, 별도 폴더 프로젝트 아님.
// ⚠️ 2026-08-12 전면 재작업: 목업(live-commerce-new) 디자인으로 완전 교체. 구 디자인 토큰
// (ink/ink-faint/paper/quiet/rule/accent-deep 등, "생방송 슬레이트"·"피그마 그린" 체계)은
// 이 페이지에서 전혀 쓰지 않는다 — 색은 tailwind.config.ts의 brand-pink/live-start/live-end/
// bg-overlay/bg-card/card-border(목업 designTokens.js와 1:1 동일)만 사용, 그 외는 black/white/
// #666666 리터럴로 목업과 동일하게 맞춘다.

const STORES: { key: 'hyundai' | 'ak' | 'lotte'; name: string; logo: string }[] = [
  { key: 'hyundai', name: '현대백화점', logo: '/images/memberships/hyundai.png' },
  { key: 'ak', name: 'AK플라자', logo: '/images/memberships/ak.png' },
  { key: 'lotte', name: '롯데백화점', logo: '/images/memberships/lotte.svg' },
]

// 우선순위: 진행중 라이브 > 가장 이른 예정 라이브 > 없음("방송 준비중")
function pickForDept(lives: Live[], dept: 'hyundai' | 'ak' | 'lotte') {
  const deptLives = lives.filter((l) => l.dept_key === dept)
  return deptLives.find((l) => l.status === 'live') ?? deptLives[0] ?? null
}

export default function LiveMain() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dept = searchParams.get('dept') ?? ''
  // 백화점 카드용 — 현재 dept 필터와 무관하게 항상 전체 진행중/예정 라이브를 본다(카드 2개 동시 비교용).
  const { lives: allLives } = useShopLives()
  const [lives, setLives] = useState<Live[]>([])
  const [replays, setReplays] = useState<Live[]>([])
  const [hostNames, setHostNames] = useState<Record<string, string>>({})
  const [brandNames, setBrandNames] = useState<Record<string, string>>({})
  const [primaryProducts, setPrimaryProducts] = useState<Record<string, { id: string; name: string; price: number; sale_price: number | null; thumbnail_url: string | null; partner_id: string | null }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      let liveQuery = supabase.from('lives').select('*').in('status', ['live', 'scheduled'])
        .not('title', 'ilike', '호스트검증방송%').order('scheduled_at', { ascending: true, nullsFirst: false })
      let endedQuery = supabase.from('lives').select('*').eq('status', 'ended')
        .not('title', 'ilike', '호스트검증방송%').order('scheduled_at', { ascending: false, nullsFirst: false }).limit(12)
      if (dept) {
        liveQuery = liveQuery.eq('dept_key', dept)
        endedQuery = endedQuery.eq('dept_key', dept)
      }
      const [{ data }, { data: endedData }] = await Promise.all([liveQuery, endedQuery])
      if (!active) return
      const liveList = (data ?? []) as Live[]
      const replayList = ((endedData ?? []) as Live[]).filter((l) => l.stream_url || l.playback_url || l.stream_uid)
      setLives(liveList)
      setReplays(replayList)

      const all = [...liveList, ...replayList]
      const hostIds = Array.from(new Set(all.map((l) => l.host_id).filter((id): id is string => Boolean(id))))
      if (hostIds.length > 0) {
        const { data: hostsData } = await supabase.from('hosts').select('id, name').in('id', hostIds)
        if (active && hostsData) setHostNames(Object.fromEntries(hostsData.map((h) => [h.id, h.name])))
      }

      const primaryIdByLive: Record<string, string> = {}
      all.forEach((l) => {
        const pid = l.highlight_product_id || l.product_ids?.[0]
        if (pid) primaryIdByLive[l.id] = pid
      })
      const productIds = Array.from(new Set(Object.values(primaryIdByLive)))
      if (productIds.length > 0) {
        const { data: productsData } = await supabase.from('products')
          .select('id, name, price, sale_price, thumbnail_url, partner_id').in('id', productIds)
        if (active && productsData) {
          const byId = Object.fromEntries(productsData.map((p) => [p.id, p]))
          const map: typeof primaryProducts = {}
          Object.entries(primaryIdByLive).forEach(([liveId, pid]) => {
            const p = byId[pid]
            if (p) map[liveId] = p
          })
          setPrimaryProducts(map)

          // 진행자(host) 미지정 방송은 대표상품의 브랜드명을 핑크 라벨로 쓴다 (목업 스펙: 시간/브랜드/설명)
          const partnerIds = Array.from(new Set(productsData.map((p) => p.partner_id).filter((v): v is string => Boolean(v))))
          if (partnerIds.length > 0) {
            const { data: brandRows } = await supabase.from('partner_brands').select('id, brand_name').in('id', partnerIds)
            if (active && brandRows) setBrandNames(Object.fromEntries(brandRows.map((b) => [b.id, b.brand_name])))
          }
        }
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [dept])

  const nowLive = lives.filter((l) => l.status === 'live')
  const scheduled = lives.filter((l) => l.status === 'scheduled')
  // 캐러셀엔 실제 영상이 있는 것만(진행중 방송 + 다시보기 녹화본) — 예고는 아래 "LIVE 예고" 목록 전용.
  // (2026-08-12 대표님 지시: 제품 카드 말고 실제 보유 영상자료로 채울 것)
  const carouselItems = [...nowLive, ...replays].slice(0, 10)

  // 라이브 추천 상품: 일반 할인 특가가 아니라 실제 라이브 방송(진행중→예정→다시보기 순)에
  // 걸린 대표상품을 그대로 노출 — 이 페이지 성격에 맞게 "할인 특가" 대신 채택(2026-08-25 대표님 지시).
  const recommendedProducts = (() => {
    const seen = new Set<string>()
    const list: typeof primaryProducts[string][] = []
    for (const l of [...nowLive, ...scheduled, ...replays]) {
      const p = primaryProducts[l.id]
      if (p && !seen.has(p.id)) { seen.add(p.id); list.push(p) }
      if (list.length >= 6) break
    }
    return list
  })()

  // ── 캐러셀 자동 슬라이드 + 드래그 (목업 LiveCarousel.jsx 동작 그대로) ──
  // 3초마다 한 칸씩 좌측으로, 끝에 닿으면 처음으로. 손가락 스와이프/마우스 드래그로
  // 직접 밀 수 있고, 조작하는 동안 자동 슬라이드는 멈췄다가 4초 뒤 재개된다.
  const CARD_STEP = 168 + 12 // 카드 폭 + gap-3
  const trackRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartScrollRef = useRef(0)
  const draggedRef = useRef(false)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused) return undefined
    const track = trackRef.current
    if (!track) return undefined
    const timer = setInterval(() => {
      const maxScroll = track.scrollWidth - track.clientWidth
      if (maxScroll <= 4) return // 카드가 화면에 다 들어오면 슬라이드 불필요
      // 끝에 도달한 상태면 처음으로, 아니면 다음 칸(끝을 넘으면 끝까지만) — 카드가 적어도
      // "끝까지 갔다가 처음으로" 움직임이 항상 보이게 (3개일 때 0→0으로 멈춰 보이던 문제 수정)
      if (track.scrollLeft >= maxScroll - 4) track.scrollTo({ left: 0, behavior: 'smooth' })
      else track.scrollTo({ left: Math.min(track.scrollLeft + CARD_STEP, maxScroll), behavior: 'smooth' })
    }, 3000)
    return () => clearInterval(timer)
    // loading 의존성 필수: 캐러셀 DOM은 로딩이 끝나야 렌더되는데, 데이터(length)만 의존하면
    // 로딩 해제 시점에 효과가 재실행되지 않아 타이머가 영영 안 생김(2026-08-12 E2E로 발견한 버그)
  }, [isPaused, loading, carouselItems.length])

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
  }, [])

  const pauseAndScheduleResume = () => {
    setIsPaused(true)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setIsPaused(false), 4000)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const track = trackRef.current
    if (!track) return
    isDraggingRef.current = true
    draggedRef.current = false
    dragStartXRef.current = e.pageX
    dragStartScrollRef.current = track.scrollLeft
    pauseAndScheduleResume()
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return
    const track = trackRef.current
    if (!track) return
    e.preventDefault()
    const delta = e.pageX - dragStartXRef.current
    if (Math.abs(delta) > 4) draggedRef.current = true
    track.scrollLeft = dragStartScrollRef.current - delta
  }

  const stopDragging = () => {
    isDraggingRef.current = false
  }

  // 드래그로 밀다 놓은 것을 카드 클릭(페이지 이동)으로 오인하지 않게 차단
  const handleClickCapture = (e: React.MouseEvent) => {
    if (draggedRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  // PC버전 복원(2026-08-13) 이후에도 라이브 메인은 전용 PC 레이아웃이 없어 "준비 중" 대신
  // 모바일 레이아웃(중앙 480px)을 그대로 보여준다 — 영상이 세로형이라 PC에서도 자연스러움.
  // PC 전환 토글도 이 페이지에선 숨김(전환할 PC 레이아웃이 없어 눌러도 변화가 없기 때문).
  return (
    <AppFrame>
      <PromoBar />
      <AppHeader promoBarAbove />

      <main className="bg-white pb-2">
        <section className="pt-4 px-4">
          {loading ? (
            <p className="text-[13px] text-[#666666] py-8 text-center">불러오는 중…</p>
          ) : carouselItems.length === 0 ? (
            <p className="text-[13px] text-[#666666] py-8 text-center">진행 중이거나 지난 라이브가 없습니다.</p>
          ) : (
            <div
              ref={trackRef}
              className="flex gap-3 -mx-4 px-4 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDragging}
              onMouseLeave={stopDragging}
              onTouchStart={pauseAndScheduleResume}
              onClickCapture={handleClickCapture}
            >
              {carouselItems.map((live) => {
                const product = primaryProducts[live.id]
                const brand = product?.partner_id ? brandNames[product.partner_id] : undefined
                const channel = (live.host_id ? hostNames[live.host_id] : undefined) || brand
                const isLive = live.status === 'live'
                const isScheduled = live.status === 'scheduled'
                return (
                  <Link
                    key={live.id}
                    to={`/app/live/${live.id}`}
                    className="relative w-[168px] h-[240px] rounded-2xl overflow-hidden shrink-0 bg-bg-card focus:outline-none focus-visible:shadow-ring"
                  >
                    {/* 젠스파크 스펙: 방송 녹화본(mp4)이 연결된 카드는 무음 자동재생 (목업 LiveCard의 video 대응) */}
                    {live.playback_url && /\.mp4(\?|$)/i.test(live.playback_url) ? (
                      <video
                        src={live.playback_url}
                        poster={live.thumbnail_url ?? undefined}
                        className="absolute inset-0 w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : live.thumbnail_url ? (
                      <img src={live.thumbnail_url} alt={live.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-bg-card flex items-center justify-center">
                        <img src="/images/bg-logo-mark.png" alt="" className="w-10 h-10 object-contain opacity-40" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5">
                      {isLive ? (
                        <span className="inline-flex items-center text-white text-[10px] font-bold px-2 py-1 rounded-full bg-gradient-to-r from-live-start to-live-end">LIVE</span>
                      ) : isScheduled ? (
                        <span className="inline-flex items-center rounded-full bg-bg-overlay/70 text-white text-[10px] font-bold px-2 py-1">예정</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-bg-overlay/70 text-white text-[10px] font-bold px-2 py-1">종료</span>
                      )}
                    </div>
                    <div className="absolute top-9 left-2.5 right-2.5 flex justify-center">
                      <span className="text-white text-[10px] font-semibold text-center leading-tight line-clamp-2" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                        {live.title}
                      </span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-bg-overlay/90 via-bg-overlay/40 to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 left-3 right-3">
                      {channel && <p className="text-white text-[11px] font-medium truncate">{channel}</p>}
                      {product && <p className="text-white text-[13px] font-semibold truncate mt-0.5">{product.name}</p>}
                      {product && (
                        <p className="text-white text-sm font-bold mt-1">
                          {comma(product.sale_price ?? product.price)}원
                        </p>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <div className="mt-6 mx-4 border-t border-card-border" aria-hidden="true" />
        <section className="pt-6 px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-black">백화점 라이브</h2>
            {dept && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="text-[12px] font-bold text-[#666666]"
              >
                전체보기 ›
              </button>
            )}
          </div>
          <div className={`grid gap-3 ${STORES.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {STORES.map((store) => {
              const live = pickForDept(allLives, store.key)
              const isActive = dept === store.key
              const statusLabel = live?.status === 'live' ? 'LIVE' : live ? '방송 예정' : '방송 준비중'
              return (
                <button
                  key={store.key}
                  type="button"
                  onClick={() => setSearchParams(isActive ? {} : { dept: store.key })}
                  className={`relative text-left rounded-2xl overflow-hidden bg-white border transition-colors ${
                    isActive ? 'border-black' : 'border-black/10'
                  }`}
                >
                  {live?.thumbnail_url && (
                    <img src={live.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="relative flex flex-col items-center gap-5 px-3 py-7">
                    <img src={store.logo} alt={store.name} className="h-5 w-auto object-contain" />
                    <span
                      className={`text-[11px] font-bold px-4 py-2 rounded-full ${
                        live?.status === 'live'
                          ? 'text-white bg-gradient-to-r from-live-start to-live-end'
                          : live
                            ? 'text-white bg-bg-overlay/70'
                            : 'text-text-sub bg-cream-2'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {!loading && scheduled.length > 0 && (
          <>
            <div className="mt-8 mx-4 border-t border-card-border" aria-hidden="true" />
            <section className="pt-8 px-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-black">LIVE 예고</h2>
                <Link to="/live/schedule" className="text-xs text-[#666666] focus:outline-none focus-visible:shadow-ring">
                  전체보기 →
                </Link>
              </div>
              <ul className="flex flex-col gap-6">
                {scheduled.map((live) => {
                  const product = primaryProducts[live.id]
                  const brand = product?.partner_id ? brandNames[product.partner_id] : ''
                  const channel = (live.host_id ? hostNames[live.host_id] : '') || brand
                  const thumb = product?.thumbnail_url ?? live.thumbnail_url
                  return (
                    <li key={live.id}>
                      <Link to={`/app/live/${live.id}`} className="flex items-center gap-3 focus:outline-none focus-visible:shadow-ring">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={channel || live.title}
                            className="w-16 h-16 rounded-lg object-cover bg-bg-card border border-card-border shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-bg-card border border-card-border shrink-0 flex items-center justify-center">
                            <img src="/images/bg-logo-mark.png" alt="" className="w-6 h-6 object-contain opacity-40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[#666666]">{formatLiveSchedTime(live.scheduled_at)}</p>
                          <p className="text-sm font-bold text-brand-pink mt-1 truncate">{channel || live.title}</p>
                          <p className="text-xs text-[#666666] mt-1 truncate">{live.title}</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}

        {!loading && recommendedProducts.length > 0 && (
          <>
            <div className="mt-8 mx-4 border-t border-card-border" aria-hidden="true" />
            <section className="pt-8 px-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-black">라이브 추천 상품</h2>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                {recommendedProducts.map((p) => (
                  <Link key={p.id} to={`/app/product/${p.id}`} data-product-id={p.id} className="text-left focus:outline-none focus-visible:shadow-ring">
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-bg-card border border-card-border">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <img src="/images/bg-logo-mark.png" alt="" className="w-8 h-8 object-contain opacity-40" />
                        </div>
                      )}
                    </div>
                    <p className="text-[13px] font-bold text-black line-clamp-2 mt-2 leading-tight">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-bold text-brand-pink">{comma(p.sale_price ?? p.price)}원</span>
                      {p.sale_price != null && p.sale_price < p.price && (
                        <span className="text-xs font-bold text-brand-pink">
                          {Math.round((1 - p.sale_price / p.price) * 100)}%
                        </span>
                      )}
                    </div>
                    {p.sale_price != null && p.sale_price < p.price && (
                      <p className="text-[11px] text-[#666666] line-through mt-0.5">{comma(p.price)}원</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        {/* 브랜드 레일은 카테고리 페이지로 이동 (2026-08-12 대표님 지시 — AppCategory.tsx) */}
      </main>
      <AppFooter />
    </AppFrame>
  )
}
