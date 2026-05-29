import { Link, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { path: '/app/home', icon: '🏠', label: '홈' },
  { path: '/app/live', icon: '📺', label: '라이브' },
  { path: '/app/category', icon: '🔍', label: '카테고리' },
  { path: '/app/wishlist', icon: '🤍', label: '찜' },
  { path: '/app/mypage', icon: '👤', label: '마이' },
]

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-cream-2 flex items-center">
      {NAV_ITEMS.map(({ path, icon, label }) => {
        const isActive = pathname === path
        return (
          <Link
            key={path}
            to={path}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 transition-opacity hover:opacity-80"
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="text-xl" aria-hidden="true">{icon}</span>
            <span
              className="text-[10px] font-medium"
              style={{ color: isActive ? '#b8924a' : '#9a9080' }}
            >
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
