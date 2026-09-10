import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconHeart, IconCart, IconMenu, IconLive } from '../common/Icon'
import CartCountBadge from '../common/CartCountBadge'
import { CATEGORIES } from '../../constants'
import { supabase } from '../../lib/supabase'

// PC 전용 공용 헤더 — 지금까지 Desktop*.tsx 14개가 각자 비슷한 헤더를 따로
// 들고 있어 화면마다 미묘하게 달랐던 문제를 여기 하나로 통일한다(2026-08-05).
// 2단 구성(로고+아이콘 / 카테고리탭+바로가기 칩)은 대형몰 헤더의 위치·크기 배치를
// 참고했지만 색·폰트·이미지는 전부 이 시스템 규칙(ink/paper, 각진 4px, 무이모지) 그대로.
// 로그인 진입점이 하단 푸터에만 있어 PC에서 찾기 어렵다는 지적(2026-09-03)으로
// 상단 우측 아이콘 줄에 로그인/마이페이지 링크를 추가 — 이 컴포넌트 하나만 고치면
// 위 11개 화면 전부에 반영된다.
const QUICK_LINKS = [
  { href: '/app/mypage', label: '마이페이지' },
  { href: '/app/wishlist', label: '찜한 상품' },
  { href: '/app/orders', label: '주문내역' },
]

export default function DesktopHeader() {
  const [name, setName] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const menuBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const authUser = data.user
      if (!authUser) return
      const meta = authUser.user_metadata as { name?: string } | undefined
      setName(meta?.name || authUser.email?.split('@')[0] || null)
    })
    return () => {
      active = false
    }
  }, [])

  // 메뉴 바깥을 클릭하면 자동으로 접힌다.
  useEffect(() => {
    if (!showMenu) return
    const onClickOutside = (e: MouseEvent) => {
      if (menuBoxRef.current && !menuBoxRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [showMenu])

  return (
    <header className="bg-paper border-b border-rule sticky top-0 z-50">
      <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative" ref={menuBoxRef}>
            <button
              type="button"
              aria-label="전체 카테고리"
              aria-haspopup="true"
              aria-expanded={showMenu}
              onClick={() => setShowMenu((v) => !v)}
              className="text-ink hover:text-ink-soft transition-colors focus:outline-none focus-visible:shadow-ring"
            >
              <IconMenu className="w-[22px] h-[22px]" />
            </button>
            {showMenu && (
              <div
                className="absolute left-0 top-full mt-2 w-[180px] bg-paper border border-rule shadow-sm z-20"
                role="menu"
                aria-label="전체 카테고리"
              >
                <Link
                  to="/app/category/all"
                  onClick={() => setShowMenu(false)}
                  className="block px-4 py-2.5 text-[13px] font-bold text-ink hover:bg-quiet transition-colors"
                  role="menuitem"
                >
                  전체
                </Link>
                {CATEGORIES.map((c) => (
                  <Link
                    key={c.id}
                    to={`/app/category/${c.id}`}
                    onClick={() => setShowMenu(false)}
                    className="block px-4 py-2.5 text-[13px] font-semibold text-ink-soft hover:bg-quiet hover:text-ink transition-colors"
                    role="menuitem"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link to="/app/home" aria-label="뷰티그라운드 홈">
            <img src="/images/logo-gold.png" alt="뷰티그라운드" className="h-9 w-auto object-contain" />
          </Link>
        </div>
        <div className="flex items-center gap-5">
          {name ? (
            <Link to="/app/mypage" className="text-[13px] font-bold text-ink hover:text-ink-soft transition-colors">
              {name}님
            </Link>
          ) : (
            <Link
              to="/app/login"
              className="text-[13px] font-bold text-ink border border-rule rounded-control px-3 py-1.5 hover:border-ink transition-colors"
            >
              로그인
            </Link>
          )}
          <Link to="/app/wishlist" aria-label="찜" className="text-ink">
            <IconHeart className="w-[20px] h-[20px]" />
          </Link>
          <Link to="/app/cart" aria-label="장바구니" className="relative text-ink">
            <IconCart className="w-[20px] h-[20px]" />
            <CartCountBadge />
          </Link>
        </div>
      </div>

      <div className="border-t border-rule">
        <div className="max-w-[1280px] mx-auto px-6 h-11 flex items-center justify-between">
          <nav className="flex items-center gap-6" aria-label="카테고리">
            <Link
              to="/live"
              className="flex items-center gap-1 text-[13px] font-bold text-brand-pink hover:opacity-80 transition-opacity"
            >
              <IconLive className="w-[15px] h-[15px]" />
              라이브
            </Link>
            <Link to="/app/category/all" className="text-[13px] font-bold text-ink-soft hover:text-ink transition-colors">
              전체
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c.id}
                to={`/app/category/${c.id}`}
                className="text-[13px] font-bold text-ink-soft hover:text-ink transition-colors"
              >
                {c.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.href}
                to={q.href}
                className="text-[12px] font-bold text-ink-soft border border-rule rounded-control px-3 py-1.5 hover:border-ink hover:text-ink transition-colors"
              >
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
