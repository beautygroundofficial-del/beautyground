import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/app/home', icon: '🏠', label: '홈' },
  { path: '/app/live', icon: '📺', label: '라이브' },
  { path: '/app/category', icon: '🔍', label: '카테고리' },
  { path: '/app/wishlist', icon: '🤍', label: '찜' },
  { path: '/app/mypage', icon: '👤', label: '마이' },
]

const GOLD = '#b8924a'
const GRAY = '#9a9080'

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-[480px] mx-auto bg-white border-t border-cream-2 pb-safe">
        <div className="flex items-stretch h-14">
          {NAV_ITEMS.map(({ path, icon, label }) => {
            const isActive = pathname === path
            return (
              <Link
                key={path}
                to={path}
                className="flex-1 flex flex-col items-center justify-center gap-0.5"
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="text-lg leading-none" aria-hidden="true">{icon}</span>
                <span className="text-xs" style={{ color: isActive ? GOLD : GRAY }}>
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
