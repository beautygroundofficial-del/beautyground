import { Link, useLocation } from 'react-router-dom'
import { IconHome, IconGrid, IconLive, IconTalk, IconUser } from '../common/Icon'

// 2026-09-02 개편 — 하단 5칸 중 3칸이 제품(카테고리·장바구니)이라 쇼핑몰로만 보였다.
// 커뮤니티를 앞세우는 라이프스타일 플랫폼 방향에 맞춰 제품은 '쇼핑' 한 칸으로 묶고,
// 그 자리에 '이야기'(살아가는 이야기)를 넣었다. 장바구니는 상단 헤더에 아이콘·개수 뱃지가
// 이미 있어 중복이므로 하단에서 뺐다.
const NAV_ITEMS = [
  { path: '/app/home', Icon: IconHome, label: '홈' },
  { path: '/app/diary', Icon: IconTalk, label: '이야기' },
  { path: '/live', Icon: IconLive, label: '라이브' },
  { path: '/app/category', Icon: IconGrid, label: '쇼핑' },
  { path: '/app/mypage', Icon: IconUser, label: '마이' },
]

// 2026-08-12: 목업(live-commerce-new) 하단 네비와 색까지 완전히 통일 — 활성 탭에 brand-pink 사용
// (기존엔 accent 그린이었으나 대표님 지시로 라이브 메인 톤이 앱 전체 최우선). 카테고리 아이콘도
// 돋보기(IconSearch, 실제 검색과 혼동) 대신 목업의 그리드 아이콘(IconGrid)으로 교체.
export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-[480px] mx-auto bg-paper border-t border-rule pb-safe">
        <div className="flex items-stretch h-14">
          {NAV_ITEMS.map(({ path, Icon, label }) => {
            // '이야기'는 하루 이야기(/app/diary)와 속 이야기(/app/board) 두 갈래 — 둘 다 같은 탭이 켜진다
            const isActive = pathname === path || (path === '/app/diary' && pathname.startsWith('/app/board'))
            return (
              <Link
                key={label}
                to={path}
                className={`flex-1 flex flex-col items-center justify-center gap-1 focus:outline-none focus-visible:shadow-ring ${
                  isActive ? 'text-brand-pink' : 'text-ink-faint'
                }`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="relative inline-flex">
                  <Icon className="w-[21px] h-[21px]" strokeWidth={isActive ? 2 : 1.6} />
                </span>
                <span className={`text-[11px] leading-none ${isActive ? 'font-bold' : ''}`}>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
