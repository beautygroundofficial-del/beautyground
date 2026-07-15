import { Link } from 'react-router-dom'

// 소비자 앱 공통 상단바: 로고 + 우측 아이콘 2개(찜/장바구니)
export default function AppHeader() {
  return (
    <header className="bg-white flex items-center justify-between px-4 h-14 border-b border-cream-2 sticky top-0 z-50">
      <Link to="/app/home" className="font-sans text-[20px] font-bold text-text">
        뷰티그라운드
      </Link>
      <div className="flex items-center gap-1">
        <Link
          to="/app/wishlist"
          aria-label="찜"
          className="w-11 h-11 flex items-center justify-center"
        >
          <span className="text-xl" aria-hidden="true">🤍</span>
        </Link>
        <Link
          to="/app/cart"
          aria-label="장바구니"
          className="w-11 h-11 flex items-center justify-center"
        >
          <span className="text-xl" aria-hidden="true">🛒</span>
        </Link>
      </div>
    </header>
  )
}
