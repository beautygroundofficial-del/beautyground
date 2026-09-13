import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import AppFrame from '../components/layout/AppFrame'
import AppFooter from '../components/layout/AppFooter'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopMyPage from '../components/mypage/DesktopMyPage'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import { getMyMembership, getTiers, type MembershipInfo, type MembershipTier } from '../lib/membership'
import { getMyPointsBalance, getMyValidCoupons } from '../lib/rewards'
import { IconUser } from '../components/common/Icon'
import { useIsStaff } from '../lib/staff'
import { useActiveMissions } from '../hooks/useActiveMissions'
import { getFriendRequestCount } from '../lib/friends'

// 실제 로그인 사용자 프로필 (포인트/쿠폰은 supabase/signup_bonus.sql 적용 후 실제 지급값)
interface RealUser {
  name: string
  email: string
  points: number
  coupons: number
  orders: number
  wishlist: number
}

// 이모지 대신 텍스트만 — 아이콘은 상태를 나타낼 때만 쓰고, 목록 항목 장식용으로는 쓰지 않는다.
interface MenuItem { label: string; path: string; count?: number; value?: string }

// 2026-09-13 대표님 지시("한눈에 보기 힘들다, 겹치는 카테고리를 묶어라") — 13개 일자
// 목록으로 쭉 나열되던 것을 "쇼핑/커뮤니티/설정" 3묶음으로 나눴다. 특히 혜택·쿠폰함·포인트
// 세 줄이 전부 같은 화면(/app/benefits)으로 가는 완전 중복이었어서 한 줄로 합쳤다.
function buildShoppingItems(user: RealUser): MenuItem[] {
  return [
    { label: '주문 내역', path: '/app/orders' },
    { label: '배송지 관리', path: '/app/addresses' },
    { label: '찜 목록', path: '/app/wishlist' },
    { label: '최근 본 상품', path: '/app/recently-viewed' },
    { label: '리뷰 관리', path: '/app/my-reviews' },
    { label: '혜택', value: `쿠폰 ${user.coupons}장 · ${user.points.toLocaleString()}P`, path: '/app/benefits' },
  ]
}

function buildCommunityItems(showMissions: boolean, friendRequests: number): MenuItem[] {
  return [
    // 참여형 기능은 관리자가 활동 미션을 켰을 때만 노출한다(=붙이는 스위치).
    ...(showMissions ? [
      { label: '살아가는 이야기', path: '/app/diary' },
      { label: '오늘의 활동', path: '/app/today' },
    ] : []),
    // 속 이야기·새 소식은 미션과 무관하게 항상 — 글을 썼으면 찾아갈 수 있어야 한다(2026-09-10)
    { label: '내가 쓴 속 이야기', path: '/app/board/mine' },
    { label: '새 소식', path: '/app/news' },
    // 친구 — 받은 신청이 있으면 개수만 조용히(2026-09-11)
    { label: '친구', path: '/app/friends', ...(friendRequests > 0 ? { count: friendRequests } : {}) },
    // 반려동물 — 등록하면 하루 이야기에 '같이 걸은 친구'로 붙는다(2026-09-12)
    { label: '내 반려동물', path: '/app/pets' },
  ]
}

// 묶음 하나(쇼핑/커뮤니티/설정)를 그리는 공통 틀 — 라벨 위 작은 회색 소제목 + 행 목록
function MenuGroup({ title, items, onNavigate }: { title: string; items: MenuItem[]; onNavigate: (path: string) => void }) {
  if (items.length === 0) return null
  return (
    <div className="mt-2 bg-paper">
      <p className="px-5 py-3 text-[12px] font-bold text-ink-faint tracking-wide">{title}</p>
      {items.map(({ label, path, count, value }) => (
        <button
          key={label}
          onClick={() => path && onNavigate(path)}
          className="w-full flex items-center justify-between px-5 py-3.5 border-b border-rule last:border-0 focus:outline-none focus-visible:shadow-ring"
        >
          <span className="text-[14px] text-ink">{label}</span>
          <div className="flex items-center gap-2">
            {count !== undefined && (
              <span className="text-[13px] font-bold tabular-nums text-ink">{count}</span>
            )}
            {value && (
              <span className="text-[13px] text-ink-soft">{value}</span>
            )}
            <span className="text-ink-faint" aria-hidden="true">›</span>
          </div>
        </button>
      ))}
    </div>
  )
}

const SETTING_ITEMS = [
  { label: '계정/보안', path: '/app/account' },
  { label: '이용약관', path: '/terms' },
  { label: '개인정보처리방침', path: '/privacy' },
  { label: '고객센터', path: '/about' },
]

const EMPTY_USER: RealUser = { name: '게스트', email: '로그인이 필요해요', points: 0, coupons: 0, orders: 0, wishlist: 0 }

export default function AppMyPage() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const { isStaff } = useIsStaff()
  const { missions: activeMissions } = useActiveMissions()
  const [user, setUser] = useState<RealUser>(EMPTY_USER)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [tiers, setTiers] = useState<MembershipTier[]>([])
  const [showTierGuide, setShowTierGuide] = useState(false)

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [friendRequests, setFriendRequests] = useState(0)

  const loadUser = async () => {
    const { data } = await supabase.auth.getUser()
    const authUser = data.user
    setLoggedIn(!!authUser)
    if (!authUser) { setUser(EMPTY_USER); setMembership(null); setFriendRequests(0); return }
    void getFriendRequestCount().then(setFriendRequests)

    const meta = authUser.user_metadata as { name?: string } | undefined
    const name = meta?.name || authUser.email?.split('@')[0] || '고객'

    // 실제 주문 건수(같은 결제 1건 = payment_id 1개, 카트 다건이어도 중복집계 안 되게 dedupe)
    const [{ data: orderRows }, { count: wishlistCount }, ms, tiersLoaded, points, coupons] = await Promise.all([
      supabase
        .from('orders')
        .select('payment_id')
        .eq('user_id', authUser.id)
        .in('status', ['paid', 'shipped', 'done']),
      supabase
        .from('wishlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', authUser.id),
      getMyMembership(),
      getTiers(),
      getMyPointsBalance(),
      getMyValidCoupons(),
    ])
    const orderCount = new Set((orderRows ?? []).map((r) => (r as { payment_id: string | null }).payment_id)).size

    setMembership(ms)
    setTiers(tiersLoaded)
    setUser({ name, email: authUser.email ?? '', points, coupons: coupons.length, orders: orderCount, wishlist: wishlistCount ?? 0 })
  }

  useEffect(() => {
    let active = true
    loadUser()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      if (active) loadUser()
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setToast('로그아웃되었습니다')
    setTimeout(() => navigate('/app/home'), 900)
  }

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopMyPage
          user={user}
          membership={membership}
          tiers={tiers}
          showTierGuide={showTierGuide}
          onToggleTierGuide={() => setShowTierGuide((v) => !v)}
          loggedIn={loggedIn}
          onLogout={handleLogout}
          isStaff={isStaff}
        />
        {toast && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-10 z-50 rounded-control bg-ink text-paper text-[13px] px-4 py-2.5" role="status">
            {toast}
          </div>
        )}
      </>
    )
  }

  return (
    <AppFrame>
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <AppHeader />

      {/* 프로필 카드 */}
      <div className="bg-paper px-5 pt-4 pb-4">
        <div className="flex items-center gap-4">
          {/* 원형은 프로필 이미지에만 허용 */}
          <div className="w-16 h-16 rounded-full bg-quiet flex items-center justify-center flex-shrink-0 text-ink-soft" aria-hidden="true">
            <IconUser className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-bold text-ink">{user.name}</h1>
              <button
                onClick={() => setShowTierGuide((v) => !v)}
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-control border focus:outline-none focus-visible:shadow-ring"
                style={
                  isStaff
                    ? { backgroundColor: '#EAF0FF', color: '#0047FF', borderColor: '#0047FF' }
                    : {
                        backgroundColor: membership?.tier.bg ?? '#F4F5F7',
                        color: membership?.tier.color ?? '#8E9199',
                        borderColor: membership?.tier.color ?? '#E3E5E9',
                      }
                }
                aria-label="회원 등급 안내 보기"
              >
                {isStaff ? '직원' : membership?.tier.label ?? 'BASIC'}
              </button>
            </div>
            <p className="text-[13px] text-ink-soft mt-0.5">{user.email}</p>
          </div>
          {/* 2026-09-13 대표님 지시: 프로필 수정 밑에 로그아웃 버튼 — 페이지 맨 아래 것과 별개로 여기서도 바로 가능하게 */}
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={() => navigate('/app/account')}
              className="text-[12px] text-ink-soft rounded-control border border-rule px-3 py-1.5 whitespace-nowrap focus:outline-none focus-visible:shadow-ring"
            >
              프로필 수정
            </button>
            <button
              onClick={handleLogout}
              className="text-[11.5px] text-ink-faint underline whitespace-nowrap focus:outline-none focus-visible:shadow-ring"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 나의 활동 — 이야기 출석 캘린더 + 포인트로 살 수 있는 상품 추천 진입 버튼(2026-09-13) */}
        <button
          type="button"
          onClick={() => navigate('/app/my-activity')}
          className="mt-4 w-full rounded-card bg-ink text-paper px-4 py-3 flex items-center justify-between text-left focus:outline-none focus-visible:shadow-ring"
        >
          <span>
            <span className="block text-[14px] font-bold">나의 활동</span>
            <span className="block text-[12px] opacity-75 mt-0.5">이야기 출석 캘린더 · 포인트로 살 수 있는 상품</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>

        {/* 통계 — 2026-09-13 대표님 지시("앱이 너무 뚱뚱하다", 레퍼런스 마이 화면 참고)로
            테두리 박스 4개(통계·등급·포인트·미션)를 겹겹이 쌓던 구조를 없애고, 옅은 배경 톤 하나로
            가볍게 묶었다. 테두리선을 최소화하고 세로 간격도 좁혔다. */}
        <div className="mt-4 grid grid-cols-3 gap-0 rounded-card bg-quiet/50">
          {[
            { label: '주문', value: user.orders },
            { label: '찜', value: user.wishlist },
            { label: '쿠폰', value: user.coupons },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              className={`py-3 text-center ${i < 2 ? 'border-r border-paper' : ''}`}
            >
              <p className="text-[18px] font-bold tabular-nums text-ink">{value}</p>
              <p className="text-[11.5px] text-ink-soft mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 회원 등급 — 누적 구매금액 기반, 배지 클릭으로 등급표 열람 */}
        {loggedIn && membership && (
          <div className="mt-2 rounded-card bg-quiet/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-soft">누적 구매금액</span>
              <span className="text-[14px] font-bold tabular-nums text-ink">{membership.totalSpent.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[12px] text-ink-faint">
                현재 <b style={{ color: membership.tier.color === '#FFFFFF' ? '#17181C' : membership.tier.color }}>{membership.tier.label}</b> · 구매 시 {membership.tier.rewardRate}% 적립 예정
              </span>
              {membership.next && (
                <span className="text-[12px] text-ink-faint tabular-nums">
                  {membership.next.next.label}까지 {membership.next.remain.toLocaleString('ko-KR')}원
                </span>
              )}
            </div>
            {membership.next && (
              <div className="mt-2 h-1.5 bg-paper overflow-hidden" aria-hidden="true">
                <div
                  className="h-full bg-ink"
                  style={{
                    width: `${Math.min(100, Math.round((membership.totalSpent / membership.next.next.min) * 100))}%`,
                  }}
                />
              </div>
            )}
            {showTierGuide && (
              <div className="mt-2.5 pt-2.5 border-t border-paper">
                <p className="text-[12px] font-bold text-ink mb-2">회원 등급 안내 (누적 구매금액 기준)</p>
                <div className="space-y-1.5">
                  {tiers.map((t) => (
                    <div key={t.key} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2">
                        <span
                          className="font-bold px-2 py-0.5 rounded-control text-[10.5px]"
                          style={{ backgroundColor: t.bg, color: t.color }}
                        >
                          {t.label}
                        </span>
                        <span className="text-ink-soft">{t.min === 0 ? '가입 시' : `${(t.min / 10000).toLocaleString()}만원 이상`}</span>
                      </span>
                      <span className="text-ink tabular-nums">적립 {t.rewardRate}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-ink-faint mt-2">적립금 사용은 결제 오픈 후 활성화됩니다.</p>
              </div>
            )}
          </div>
        )}

        {/* 포인트 — 조건부 혜택 성격이라 신호색(노랑) 작은 칩으로 */}
        <div className="mt-2 rounded-card bg-quiet/50 px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] font-bold text-ink">보유 포인트</span>
          <span className="text-[13px] font-bold tabular-nums text-ink bg-signal-yellow px-2 py-0.5">
            {user.points.toLocaleString()}P
          </span>
        </div>

        {/* 활동 미션 — 구매 없이도 포인트를 모을 수 있는 진입구. 유입 장치라 목록에 묻히지 않게 따로 뺀다.
            켜진 미션이 없으면 렌더하지 않는다(관리자 스위치). */}
        {activeMissions.length > 0 && (
        <button
          onClick={() => navigate('/app/missions')}
          className="mt-2 w-full rounded-card bg-quiet/50 px-4 py-3 flex items-center justify-between text-left focus:outline-none focus-visible:shadow-ring"
        >
          <span>
            <span className="text-[14px] font-bold text-ink">활동 미션</span>
            <span className="block text-[12px] text-ink-soft mt-0.5">
              걷고, 이야기 남기고 포인트 받아가세요
            </span>
          </span>
          <span className="text-ink-faint" aria-hidden="true">›</span>
        </button>
        )}
      </div>

      {/* 메뉴 — 쇼핑/커뮤니티/설정 3묶음으로 나눠 한눈에 들어오게(2026-09-13) */}
      <MenuGroup title="쇼핑" items={buildShoppingItems(user)} onNavigate={navigate} />
      <MenuGroup title="커뮤니티" items={buildCommunityItems(activeMissions.length > 0, friendRequests)} onNavigate={navigate} />

      {/* 설정 */}
      <div className="mt-2 bg-paper">
        <p className="px-5 py-3 text-[12px] font-bold text-ink-faint tracking-wide">설정</p>
        {SETTING_ITEMS.map(({ label, path }) => (
          <button
            key={label}
            onClick={() => path && navigate(path)}
            className="w-full flex items-center justify-between px-5 py-3.5 border-b border-rule last:border-0 focus:outline-none focus-visible:shadow-ring"
          >
            <span className="text-[14px] text-ink">{label}</span>
            <span className="text-ink-faint" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      {/* 직원 전용 바로가기 — app_staff 지정 계정에만 노출(관리자 회원관리 > 직원 지정) */}
      {isStaff && (
        <div className="mt-2 bg-paper">
          <button
            onClick={() => navigate('/app/staff-buy')}
            className="w-full flex items-center justify-between px-5 py-3.5 border-b border-rule last:border-0 focus:outline-none focus-visible:shadow-ring"
          >
            <span className="text-[14px] text-ink font-bold">🏷️ 직원 전용 구매</span>
            <span className="text-ink-faint" aria-hidden="true">›</span>
          </button>
        </div>
      )}


      <div className="px-5 py-6">
        {loggedIn === false ? (
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/mypage' } })}
            className="text-[13px] text-ink-faint underline focus:outline-none focus-visible:shadow-ring"
          >
            로그인
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="text-[13px] text-ink-faint underline focus:outline-none focus-visible:shadow-ring"
          >
            로그아웃
          </button>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-control bg-ink text-paper text-[13px] px-4 py-2.5" role="status">
          {toast}
        </div>
      )}

      <AppFooter />
    </AppFrame>
  )
}
