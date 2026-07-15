import { NavLink } from 'react-router-dom'

// 상단 텍스트 메뉴 (med-ligne 참고: 화이트 배경 + 블랙 텍스트, 골드 사용 안 함)
// 기본값은 실제 존재하는 페이지로 구성 — 문구는 추후 자유롭게 수정 가능.
const MENU_ITEMS = [
  { label: '홈', to: '/app/home' },
  { label: '라이브', to: '/app/live' },
  { label: '카테고리', to: '/app/category' },
  { label: '마이페이지', to: '/app/mypage' },
]

export default function TopNavMenu() {
  return (
    <nav className="bg-white border-b border-cream-2" aria-label="상단 메뉴">
      <div className="flex items-center justify-center gap-8 h-11">
        {MENU_ITEMS.map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `text-[13px] font-medium ${isActive ? 'text-text font-bold' : 'text-text-sub'}`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
