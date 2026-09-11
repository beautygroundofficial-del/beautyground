import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  IconLayoutDashboard,
  IconVideo,
  IconCash,
  IconLogout,
  IconMenu2,
  IconX,
  IconWorld,
  IconPackage,
  IconReceipt,
  IconBuildingStore,
  IconChartBar,
  IconHelpCircle,
} from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyBrandAccess } from '../../lib/partner'
import type { Partner, Settlement } from '../../lib/types'

// 해외 바이어 제안용 소개글 작성 (2026-08-15) — 브랜드는 이 정보만 넣고, 실제 바이어 발굴·컨택은
// 뷰티그라운드가 전담(바이어 정보는 /admin/export-buyers에서만 관리, 브랜드에는 비공개).
const EXPORT_NAV_ITEM = { label: '수출 소개', to: '/brand/export', icon: IconWorld }

const FULL_NAV_ITEMS = [
  { label: '대시보드', to: '/brand/dashboard', icon: IconLayoutDashboard },
  { label: '판매자 정보', to: '/brand/company', icon: IconBuildingStore },
  { label: '상품관리', to: '/brand/products', icon: IconPackage },
  { label: '주문내역', to: '/brand/orders', icon: IconReceipt },
  { label: '성과 리포트', to: '/brand/report', icon: IconChartBar },
  { label: '판매내역', to: '/brand/sales', icon: IconVideo },
  { label: '정산내역', to: '/brand/settlement', icon: IconCash },
  EXPORT_NAV_ITEM,
  { label: '이용 가이드', to: '/brand/guide', icon: IconHelpCircle },
]

// 수출 전용 계정(export_contacts로 로그인, 2026-08-16)은 라이브 판매실적·정산금을 볼 수 없어야
// 하므로 "수출 소개" 하나만 노출한다.
const EXPORT_ONLY_NAV_ITEMS = [EXPORT_NAV_ITEM]

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  active:    { className: 'bg-signal-blue/10 text-signal-blue', label: '이용중' },
  pending:   { className: 'bg-quiet text-ink-soft', label: '승인 대기' }, // OTP 셀프 가입 브랜드(2026-08-17)
  suspended: { className: 'bg-quiet text-ink-faint', label: '정지됨' },
}

// ERP(beautyground-erp) 사이드바와 동일한 남색 그라데이션 알약 버튼(2026-08-26 대표님 지시:
// "셀러페이지도 마찬가지로 같게 해줘") — HostLayout.tsx와 동일한 패턴.
const NAV_GRADIENT = 'linear-gradient(135deg, #1e4fd8 0%, #2b6cf0 35%, #4a8bf7 70%, #1e4fd8 100%)'
const NAV_GRADIENT_ACTIVE = 'linear-gradient(135deg, #dfe3f0 0%, #ffffff 40%, #f2f4fb 70%, #d8dceb 100%)'
const LOGOUT_GRADIENT = 'linear-gradient(135deg, #dc2626 0%, #ef4444 30%, #f87171 65%, #b91c1c 100%)'
const navShadow = { boxShadow: '0 10px 24px rgba(30,79,216,.45), inset 0 2px 2px rgba(255,255,255,.7), inset 0 -4px 8px rgba(0,0,0,.3)' }
const navShadowActive = { boxShadow: '0 10px 24px rgba(30,40,90,.28), inset 0 2px 2px rgba(255,255,255,.95), inset 0 -4px 8px rgba(0,0,0,.12)' }

export default function BrandLayout() {
  const navigate = useNavigate()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [isExportOnly, setIsExportOnly] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // 지급 대기 중인 정산 건수 — "새 정산이 생성됐다"는 신호로 정산내역 메뉴에 배지 표시.
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    getMyBrandAccess().then(({ partner: p, isExportOnly: exportOnly }) => {
      setPartner(p)
      setIsExportOnly(exportOnly)
      if (!p || exportOnly) return
      supabase
        .from('settlements')
        .select('id, status')
        .eq('partner_id', p.id)
        .eq('status', 'pending')
        .then(({ data }) => setPendingCount(((data ?? []) as Pick<Settlement, 'id' | 'status'>[]).length))
    })
  }, [])

  // 대시보드·판매내역·정산내역은 온라인 쇼핑몰(라이브 판매) 채널 메뉴 — 셀프 가입 수출 브랜드(pending)에게는
  // 채널 콘텐츠 격리 원칙(2026-08-17)에 따라 수출 소개만 노출한다.
  const navItems = isExportOnly || partner?.status === 'pending' ? EXPORT_ONLY_NAV_ITEMS : FULL_NAV_ITEMS

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/brand/login')
  }

  // 정의 안 된 상태값이 와도 화면이 죽지 않게 active로 폴백 (pending 미정의로 흰 화면 났던 사고 재발 방지)
  const badge = STATUS_BADGE[partner?.status ?? 'active'] ?? STATUS_BADGE.active

  return (
    <div className="flex min-h-screen bg-[#f7f4ef]">
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-[240px] min-h-screen bg-white flex flex-col fixed left-0 top-0 z-40 transition-transform duration-200 lg:translate-x-0 shadow-[2px_0_18px_rgba(30,40,90,.08)] ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMenuOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-ink-faint hover:text-ink"
          aria-label="메뉴 닫기"
        >
          <IconX size={20} />
        </button>
        <div className="px-6 pt-8 pb-6 border-b border-rule">
          <Link to="/" className="block">
            <p className="text-ink text-[20px] font-bold tracking-wide">
              뷰티그라운드
            </p>
            <p className="text-ink-faint text-[11px] mt-0.5 tracking-widest uppercase">Brand Center</p>
          </Link>
        </div>

        <div className="px-6 py-4 border-b border-rule">
          <p className="text-ink text-[13px] font-semibold">{partner?.brand_name ?? '-'}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-2 overflow-y-auto">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-center gap-2 px-4 py-3 rounded-full text-[13.5px] font-semibold transition-transform border relative hover:-translate-y-0.5 ${
                  isActive ? 'text-ink border-white/95' : 'text-white border-white/65'
                }`
              }
              style={({ isActive }) => ({
                background: isActive ? NAV_GRADIENT_ACTIVE : NAV_GRADIENT,
                ...(isActive ? navShadowActive : navShadow),
              })}
            >
              <Icon size={17} />
              {label}
              {to === '/brand/settlement' && pendingCount > 0 && (
                <span className="absolute right-3 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-signal-red text-paper text-[10.5px] font-bold">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-6 pt-3 border-t border-rule">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-[13px] font-semibold text-white border border-white/65 hover:-translate-y-0.5 transition-transform"
            style={{ background: LOGOUT_GRADIENT, boxShadow: '0 10px 24px rgba(220,38,38,.5), inset 0 2px 2px rgba(255,255,255,.7), inset 0 -4px 8px rgba(0,0,0,.28)' }}
          >
            <IconLogout size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      <div className="flex-1 ml-0 lg:ml-[240px] flex flex-col min-h-screen">
        <header className="h-[60px] bg-white border-b border-[#eee] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMenuOpen(true)}
              className="lg:hidden text-ink-faint hover:text-ink"
              aria-label="메뉴 열기"
            >
              <IconMenu2 size={22} />
            </button>
            <p className="text-[15px] font-semibold text-ink truncate">
              {partner?.brand_name ?? '브랜드 센터'}
            </p>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
