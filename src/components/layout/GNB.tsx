import { useState } from 'react'
import { Link } from 'react-router-dom'

const NAV_LINKS = [
  { href: '/join', label: '입점안내' },
  { href: '#success', label: '성공스토리' },
  { href: '#solution', label: 'B2B솔루션' },
  { href: '/partnership', label: '광고·제휴' },
  { href: '/career', label: '채용(영입)' },
]

export default function GNB() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      className="sticky top-0 z-50 border-b border-black/5"
      style={{
        backgroundColor: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between h-16">
        <Link to="/" className="font-serif text-[22px] font-bold text-gold" aria-label="뷰티그라운드 홈">
          뷰티그라운드
        </Link>

        {/* 데스크톱 메뉴 */}
        <nav className="hidden md:flex items-center gap-8" aria-label="주요 메뉴">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className="text-[14px] text-text-sub font-medium hover:text-text transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/app/home" className="hidden md:block text-[13px] text-text-sub hover:text-gold transition-colors">
            앱 보기
          </Link>

          {/* 모바일 햄버거 */}
          <button
            className="md:hidden p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={menuOpen}
          >
            <span className="text-xl" aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>

      {/* 모바일 드로어 */}
      {menuOpen && (
        <nav
          className="md:hidden bg-white border-t border-cream-2 px-6 py-4"
          aria-label="모바일 메뉴"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              to={href}
              className="block py-3 text-[15px] text-text border-b border-cream-2 last:border-0"
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
