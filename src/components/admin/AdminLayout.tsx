import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  IconHome,
  IconLogout,
  IconUsers,
  IconAward,
  IconCashBanknote,
  IconAddressBook,
  IconShoppingBag,
  IconBox,
  IconBroadcast,
  IconTicket,
  IconPalette,
  IconSpeakerphone,
  IconBuildingStore,
  IconWorld,
  IconTargetArrow,
  IconClipboardList,
  IconMessageQuestion,
  IconTrophy,
  IconChevronRight, IconTruck, IconGift, IconFlag } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'

// 온라인몰과 라이브커머스를 당분간 분리 운영하기로 한 방침(2026-07-31)을 관리자 메뉴에도 그대로
// 반영 — 채널별로 묶어서 한눈에 훑을 수 있게 소제목으로 나눈다(2026-08-08).
// 매입 후 직접 판매하는 구조라 브랜드사가 상품/방송을 직접 등록하는 파트너센터는 없음(2026-08-08 폐지).
// 단 브랜드가 자기 라이브 판매실적·정산을 읽기 전용으로 보는 /brand/* 포털은 2026-08-15 추가 —
// 계정 연결·수수료율 관리는 아래 "브랜드" 메뉴에서.
const NAV_GROUPS = [
  {
    title: '쇼핑몰',
    items: [
      { label: '홈 화면 관리', to: '/admin/home', icon: IconHome },
      { label: '홈 테마 설정', to: '/admin/theme', icon: IconPalette },
      { label: '마케팅 센터', to: '/admin/marketing', icon: IconSpeakerphone },
      { label: '전체 주문 관리', to: '/admin/orders', icon: IconShoppingBag },
      { label: '배송 / 물류', to: '/admin/shipping', icon: IconTruck },
      { label: '전체 상품 관리', to: '/admin/products', icon: IconBox },
    ],
  },
  {
    title: '라이브커머스',
    items: [
      { label: '라이브 방송 관리', to: '/admin/lives', icon: IconBroadcast },
      { label: '쿠폰 현황', to: '/admin/coupons', icon: IconTicket },
      { label: '진행자 관리', to: '/admin/hosts', icon: IconUsers },
      { label: '수수료 등급 관리', to: '/admin/commission-tiers', icon: IconAward },
      { label: '진행자 정산 관리', to: '/admin/host-settlements', icon: IconCashBanknote },
    ],
  },
  {
    title: '브랜드',
    items: [
      { label: '브랜드 관리', to: '/admin/partners', icon: IconBuildingStore },
      { label: '브랜드 정산 관리', to: '/admin/partner-settlements', icon: IconCashBanknote },
      { label: '파트너 허브 콘텐츠', to: '/admin/partner-hub-posts', icon: IconClipboardList },
    ],
  },
  {
    title: '백화점',
    items: [
      { label: '백화점 계정 관리', to: '/admin/dept-accounts', icon: IconBuildingStore },
    ],
  },
  {
    // beautyground가 직접 수출자(재판매자)로서 보유 브랜드를 해외 바이어에게 제안하는 채널
    // (/export 페이지) 문의 관리(2026-08-15)
    title: '해외',
    items: [
      { label: '해외 바이어 문의', to: '/admin/export-inquiries', icon: IconWorld },
      { label: '해외 바이어 타겟관리', to: '/admin/export-buyers', icon: IconTargetArrow },
    ],
  },
  {
    title: '회원',
    items: [
      { label: '회원 관리', to: '/admin/members', icon: IconAddressBook },
      { label: '쿠폰 생성기', to: '/admin/coupon-generator', icon: IconGift },
      { label: '활동 미션 관리', to: '/admin/missions', icon: IconFlag },
      // 커뮤니티 놀거리 — 홈에 하루 한 개씩 걸리는 질문(2026-09-07)
      { label: '오늘의 질문 관리', to: '/admin/daily-questions', icon: IconMessageQuestion },
      // 월 1회 선정 — 지수는 자동 계산하되 지급은 사람이 확인하고 누른다(2026-09-07)
      { label: '월간 선정', to: '/admin/monthly-picks', icon: IconTrophy },
      // 속 이야기(손님 게시판) 신고 — 자동 숨김 없이 사람이 보고 결정(2026-09-10)
      { label: '속 이야기 신고', to: '/admin/board-reports', icon: IconFlag },
    ],
  },
]

// ERP(beautyground-erp) 사이드바와 동일한 남색/청록 그라데이션 알약 버튼(2026-08-26 대표님 지시:
// "관리자 페이지의 모든 좌측 박스는 erp 좌측 박스와 똑같이 디자인 변경해")
const GROUP_GRADIENT = 'linear-gradient(135deg, #1e4fd8 0%, #2b6cf0 35%, #4a8bf7 70%, #1e4fd8 100%)'
const ITEM_GRADIENT = 'linear-gradient(135deg, #14b8a6 0%, #2dd4bf 30%, #5eead4 65%, #14b8a6 100%)'
const ITEM_GRADIENT_ACTIVE = 'linear-gradient(135deg, #dfe3f0 0%, #ffffff 40%, #f2f4fb 70%, #d8dceb 100%)'
const LOGOUT_GRADIENT = 'linear-gradient(135deg, #dc2626 0%, #ef4444 30%, #f87171 65%, #b91c1c 100%)'
const groupShadow = { boxShadow: '0 10px 24px rgba(30,79,216,.45), inset 0 2px 2px rgba(255,255,255,.7), inset 0 -4px 8px rgba(0,0,0,.3)' }
const itemShadow = { boxShadow: '0 8px 18px rgba(20,184,166,.45), inset 0 2px 2px rgba(255,255,255,.7), inset 0 -4px 8px rgba(0,0,0,.22)' }
const itemShadowActive = { boxShadow: '0 10px 24px rgba(30,40,90,.28), inset 0 2px 2px rgba(255,255,255,.95), inset 0 -4px 8px rgba(0,0,0,.12)' }

function groupHasActive(group: (typeof NAV_GROUPS)[number], pathname: string) {
  return group.items.some((it) => pathname === it.to || pathname.startsWith(it.to + '/'))
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  // 아코디언: 한 번에 한 그룹만 펼침 — 기본값은 현재 경로가 속한 그룹, 사용자가 누르면 그 선택이 우선(ERP와 동일 규칙)
  const activeGroupTitle = NAV_GROUPS.find((g) => groupHasActive(g, pathname))?.title ?? null
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined)
  const currentOpen = openGroup === undefined ? activeGroupTitle : openGroup

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/app/home')
  }

  // 전체 화면 폭에 그대로 늘어붙는 대신, 콘텐츠 영역에 최대폭을 두고 가운데 정렬 —
  // 넓은 모니터에서 좌우 여백이 생기고 그 안에서 사이드바:본문 비율이 고정된다
  // (2026-08-27 대표님 지시: "좌측 버튼과 우측 비율을 잡고 전체 화면 좌우 여백을 잡아줘").
  return (
    <div className="min-h-screen bg-[#f4f5f9]">
    <div className="flex max-w-[1440px] mx-auto min-h-screen bg-white shadow-[0_0_40px_rgba(30,40,90,.06)]">
      <aside className="w-[264px] shrink-0 min-h-screen bg-white flex flex-col sticky top-0 h-screen z-30 shadow-[2px_0_18px_rgba(30,40,90,.08)] overflow-y-auto">
        <div className="px-6 pt-8 pb-6 border-b border-rule">
          <Link to="/" className="block">
            <p className="text-ink text-[20px] font-bold tracking-wide">
              뷰티그라운드
            </p>
            <p className="text-ink-faint text-[11px] mt-0.5 tracking-widest uppercase">Admin Center</p>
          </Link>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-[7px]">
          {NAV_GROUPS.map((group) => {
            const isOpen = currentOpen === group.title
            return (
              <div key={group.title}>
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : group.title)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-[12.5px] font-extrabold tracking-wide text-white border border-white/65 hover:-translate-y-0.5 transition-transform relative"
                  style={{ background: GROUP_GRADIENT, ...groupShadow }}
                >
                  {group.title}
                  <IconChevronRight
                    size={13}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-[5px] mt-[5px] mb-1">
                    {group.items.map(({ label, to, icon: Icon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                          `flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-transform border hover:-translate-y-0.5 ${
                            isActive ? 'text-ink border-white/95' : 'text-white border-white/65'
                          }`
                        }
                        style={({ isActive }) => ({
                          background: isActive ? ITEM_GRADIENT_ACTIVE : ITEM_GRADIENT,
                          ...(isActive ? itemShadowActive : itemShadow),
                        })}
                      >
                        <Icon size={16} />
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="px-3 pb-6 pt-3 border-t border-rule">
          <button
            onClick={() => void handleLogout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full text-[13px] font-semibold text-white border border-white/65 hover:-translate-y-0.5 transition-transform"
            style={{ background: LOGOUT_GRADIENT, boxShadow: '0 10px 24px rgba(220,38,38,.5), inset 0 2px 2px rgba(255,255,255,.7), inset 0 -4px 8px rgba(0,0,0,.28)' }}
          >
            <IconLogout size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 min-h-screen">
        <Outlet />
      </div>
    </div>
    </div>
  )
}
