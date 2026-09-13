import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopRecentlyViewed from '../components/recentlyViewed/DesktopRecentlyViewed'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import { getRecentlyViewed, removeRecentlyViewed, type RecentlyViewedLine } from '../lib/recentlyViewed'
import ImagePlaceholder from '../components/common/ImagePlaceholder'
import { IconClose, IconHome } from '../components/common/Icon'

// "최근 본 상품" — 마이페이지에 자리만 있고 연결이 안 돼 있던 메뉴를 실제로 구현(2026-09-03).
// 찜(wishlist)과 동일한 회원 전용 구조 — 상품 상세를 열 때 recordView()가 upsert로 기록한다.
export default function AppRecentlyViewed() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [lines, setLines] = useState<RecentlyViewedLine[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { setLoggedIn(false); setLoading(false); return }
      const list = await getRecentlyViewed()
      if (!active) return
      setLines(list)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const handleRemove = async (line: RecentlyViewedLine) => {
    setLines((prev) => prev.filter((l) => l.id !== line.id))
    await removeRecentlyViewed(line.product.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        {isDesktop ? (
          <div className="max-w-[1280px] mx-auto px-6 py-24 flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</div>
        ) : (
          <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</div>
        )}
      </div>
    )
  }

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopRecentlyViewed loggedIn={loggedIn} lines={lines} onRemove={handleRemove} />
      </>
    )
  }

  if (!loggedIn) {
    return (
      <AppFrame>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <BackHeader title="최근 본 상품" />
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <IconHome className="w-10 h-10 mb-4 text-ink-faint" />
          <p className="text-[15px] text-ink-soft mb-6">로그인이 필요해요</p>
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/recently-viewed' } })}
            className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3 focus:outline-none focus-visible:shadow-ring"
          >
            로그인하기
          </button>
        </div>
      </AppFrame>
    )
  }

  return (
    <AppFrame>
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <BackHeader title="최근 본 상품" />

      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <IconHome className="w-10 h-10 mb-4 text-ink-faint" />
          <p className="text-[16px] font-bold text-ink mb-2">아직 마음에 둔 제품이 없으신가요?</p>
          <p className="text-[13px] text-ink-soft mb-6">지금 인기 상품부터 볼까요?</p>
          <button
            onClick={() => navigate('/app/home')}
            className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3 focus:outline-none focus-visible:shadow-ring"
          >
            쇼핑 계속하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {lines.map((line) => {
            const p = line.product
            const sell = p.sale_price ?? p.price
            return (
              <div key={line.id} className="relative">
                <button
                  onClick={() => handleRemove(line)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 bg-paper border border-rule flex items-center justify-center text-ink focus:outline-none focus-visible:shadow-ring"
                  aria-label="기록 삭제"
                >
                  <IconClose className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => navigate(`/app/product/${p.id}`)} className="text-left w-full focus:outline-none focus-visible:shadow-ring">
                  <div className="aspect-square overflow-hidden bg-quiet">
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                  </div>
                  <p className="text-[13px] text-ink mt-1.5 line-clamp-1">{p.name}</p>
                  <p className="text-[13px] font-bold tabular-nums text-ink mt-0.5">{sell.toLocaleString('ko-KR')}원</p>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </AppFrame>
  )
}
