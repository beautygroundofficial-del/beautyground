import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'

const NAV = [
  { to: '/partner/dashboard', label: '대시보드', icon: '📊' },
  { to: '/partner/products', label: '상품관리', icon: '🛍️' },
  { to: '/partner/live', label: '라이브관리', icon: '📺' },
  { to: '/partner/orders', label: '주문관리', icon: '📦' },
  { to: '/partner/settlement', label: '정산관리', icon: '💰' },
]

export default function PartnerLayout() {
  const navigate = useNavigate()
  const [brand, setBrand] = useState<string>('')

  useEffect(() => {
    getMyPartner().then((p) => setBrand(p?.brand_name ?? '입점 대기 중'))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/partner/login')
  }

  return (
    <div className="min-h-screen flex bg-cream">
      {/* 사이드바 */}
      <aside className="w-[220px] flex-shrink-0 bg-dark text-white/70 flex flex-col">
        <Link
          to="/partner/dashboard"
          className="font-serif text-[20px] font-bold text-gold px-6 h-16 flex items-center"
        >
          뷰티그라운드
        </Link>
        <p className="px-6 text-[12px] text-white/40 -mt-2 mb-4">파트너센터</p>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/partner/dashboard'}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-[14px] transition-colors',
                  isActive
                    ? 'bg-gold text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white/90',
                ].join(' ')
              }
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="m-3 px-3 py-2.5 rounded-md text-[14px] text-white/60 hover:bg-white/5 hover:text-white/90 text-left flex items-center gap-3"
        >
          <span aria-hidden="true">🚪</span>
          로그아웃
        </button>
      </aside>

      {/* 본문 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-cream-2 flex items-center justify-between px-6 flex-shrink-0">
          <p className="text-[15px] font-semibold text-text truncate">{brand}</p>
          <button
            onClick={handleLogout}
            className="text-[13px] text-text-sub hover:text-gold transition-colors"
          >
            로그아웃
          </button>
        </header>
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
