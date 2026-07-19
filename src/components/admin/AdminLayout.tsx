import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IconHome, IconClipboardCheck, IconLogout, IconUsers, IconAward, IconCashBanknote } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'

const NAV_ITEMS = [
  { label: '홈 화면 관리', to: '/admin/home', icon: IconHome },
  { label: '파트너 신청 관리', to: '/admin/applications', icon: IconClipboardCheck },
  { label: '진행자 관리', to: '/admin/hosts', icon: IconUsers },
  { label: '수수료 등급 관리', to: '/admin/commission-tiers', icon: IconAward },
  { label: '진행자 정산 관리', to: '/admin/host-settlements', icon: IconCashBanknote },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/partner/login')
  }

  return (
    <div className="flex min-h-screen bg-[#f7f4ef]">
      {/* 사이드바 */}
      <aside className="w-[240px] min-h-screen bg-[#0e0c08] flex flex-col fixed left-0 top-0 z-30">
        <div className="px-6 pt-8 pb-6 border-b border-white/10">
          <Link to="/" className="block">
            <p className="text-[#b8924a] font-serif text-[20px] font-bold tracking-wide hover:text-[#d4aa6a] transition-colors">
              뷰티그라운드
            </p>
            <p className="text-[#555] text-[11px] mt-0.5 tracking-widest uppercase">Admin Center</p>
          </Link>
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-[13px] transition-colors ${
                  isActive
                    ? 'text-[#b8924a] bg-[rgba(184,146,74,0.1)] border-l-[3px] border-[#b8924a] pl-[17px]'
                    : 'text-[#888] hover:text-white border-l-[3px] border-transparent pl-[17px]'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-6 py-6 border-t border-white/10">
          <button
            onClick={() => void handleLogout()}
            className="flex items-center gap-2 text-[#555] hover:text-white text-[13px] transition-colors"
          >
            <IconLogout size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 ml-[240px] min-h-screen">
        <Outlet />
      </div>
    </div>
  )
}
