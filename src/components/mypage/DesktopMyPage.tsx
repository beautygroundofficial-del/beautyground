import { useNavigate } from 'react-router-dom'
import { IconUser } from '../common/Icon'
import DesktopHeader from '../layout/DesktopHeader'
import { useActiveMissions } from '../../hooks/useActiveMissions'
import type { MembershipInfo, MembershipTier } from '../../lib/membership'

interface RealUser {
  name: string
  email: string
  points: number
  coupons: number
  orders: number
  wishlist: number
}

// 모바일(AppMyPage.tsx)과 같은 메뉴 구성이어야 하는데 이 파일은 별도 컴포넌트라 그동안
// "살아가는 이야기"·"오늘의 활동" 링크가 통째로 빠져 있었다(2026-09-09 발견·수정) —
// PC 마이페이지에서 커뮤니티로 들어갈 방법이 아예 없었던 실제 결함.
function buildMenuItems(user: RealUser, showMissions: boolean) {
  return [
    { label: '주문 내역', path: '/app/orders' },
    { label: '배송지 관리', path: '/app/addresses' },
    { label: '찜 목록', path: '/app/wishlist' },
    { label: '혜택', path: '/app/benefits' },
    { label: '쿠폰함', count: user.coupons, path: '/app/benefits' },
    { label: '포인트', value: `${user.points.toLocaleString()}P`, path: '/app/benefits' },
    // 참여형 기능은 관리자가 활동 미션을 켰을 때만 노출한다(=붙이는 스위치) — AppMyPage.tsx와 동일 규칙.
    ...(showMissions ? [
      { label: '살아가는 이야기', path: '/app/diary' },
      { label: '오늘의 활동', path: '/app/today' },
    ] : []),
    { label: '최근 본 상품', path: '/app/recently-viewed' },
    { label: '리뷰 관리', path: '/app/my-reviews' },
  ]
}

const SETTING_ITEMS = [
  { label: '계정/보안', path: '/app/account' },
  { label: '이용약관', path: '/terms' },
  { label: '개인정보처리방침', path: '/privacy' },
  { label: '고객센터', path: '/about' },
]

interface Props {
  user: RealUser
  membership: MembershipInfo | null
  tiers: MembershipTier[]
  showTierGuide: boolean
  onToggleTierGuide: () => void
  loggedIn: boolean | null
  onLogout: () => void
  isStaff?: boolean
}

// PC 버전 — 프로필/등급을 상단 넓은 배너로, 메뉴·설정은 2열로 나란히 배치.
export default function DesktopMyPage({
  user,
  membership,
  tiers,
  showTierGuide,
  onToggleTierGuide,
  loggedIn,
  onLogout,
  isStaff,
}: Props) {
  const navigate = useNavigate()
  const { missions: activeMissions } = useActiveMissions()

  return (
    <div className="bg-paper min-h-screen">
      <DesktopHeader />

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        {/* 프로필 배너 */}
        <div className="border border-rule px-8 py-6 flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-quiet flex items-center justify-center flex-shrink-0 text-ink-soft" aria-hidden="true">
            <IconUser className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[19px] font-bold text-ink">{user.name}</h1>
              <button
                onClick={onToggleTierGuide}
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
          <div className="flex items-center gap-8 shrink-0">
            {[
              { label: '주문', value: user.orders },
              { label: '찜', value: user.wishlist },
              { label: '쿠폰', value: user.coupons },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[20px] font-bold tabular-nums text-ink">{value}</p>
                <p className="text-[12px] text-ink-soft mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/app/account')}
              className="text-[12px] text-ink-soft rounded-control border border-rule px-4 py-2 focus:outline-none focus-visible:shadow-ring"
            >
              프로필 수정
            </button>
            {loggedIn && (
              <button
                onClick={onLogout}
                className="text-[12px] text-ink-faint rounded-control border border-rule px-4 py-2 focus:outline-none focus-visible:shadow-ring"
              >
                로그아웃
              </button>
            )}
          </div>
        </div>

        {/* 회원 등급 */}
        {loggedIn && membership && (
          <div className="mt-3 border border-rule px-8 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-ink-soft">누적 구매금액</span>
              <span className="text-[14px] font-bold tabular-nums text-ink">{membership.totalSpent.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
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
              <div className="mt-2 h-1.5 bg-quiet overflow-hidden" aria-hidden="true">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${Math.min(100, Math.round((membership.totalSpent / membership.next.next.min) * 100))}%` }}
                />
              </div>
            )}
            {showTierGuide && (
              <div className="mt-3 pt-3 border-t border-rule">
                <p className="text-[12px] font-bold text-ink mb-2">회원 등급 안내 (누적 구매금액 기준)</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                  {tiers.map((t) => (
                    <div key={t.key} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2">
                        <span className="font-bold px-2 py-0.5 rounded-control text-[10.5px]" style={{ backgroundColor: t.bg, color: t.color }}>
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

        <div className="mt-3 border border-rule px-8 py-3.5 flex items-center justify-between">
          <span className="text-[14px] font-bold text-ink">보유 포인트</span>
          <span className="text-[13px] font-bold tabular-nums text-ink bg-signal-yellow px-2 py-0.5">{user.points.toLocaleString()}P</span>
        </div>

        {/* 메뉴 · 설정 2열 */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="border border-rule">
            {buildMenuItems(user, activeMissions.length > 0).map(({ label, path, count, value }) => (
              <button
                key={label}
                onClick={() => path && navigate(path)}
                className="w-full flex items-center justify-between px-6 py-4 border-b border-rule last:border-0 focus:outline-none focus-visible:shadow-ring"
              >
                <span className="text-[14px] text-ink">{label}</span>
                <div className="flex items-center gap-2">
                  {count !== undefined && <span className="text-[13px] font-bold tabular-nums text-ink">{count}</span>}
                  {value && <span className="text-[13px] font-bold tabular-nums text-ink">{value}</span>}
                  <span className="text-ink-faint" aria-hidden="true">›</span>
                </div>
              </button>
            ))}
          </div>

          <div className="border border-rule">
            <p className="px-6 py-3 text-[12px] font-bold text-ink-faint tracking-wide border-b border-rule">설정</p>
            {SETTING_ITEMS.map(({ label, path }) => (
              <button
                key={label}
                onClick={() => path && navigate(path)}
                className="w-full flex items-center justify-between px-6 py-4 border-b border-rule last:border-0 focus:outline-none focus-visible:shadow-ring"
              >
                <span className="text-[14px] text-ink">{label}</span>
                <span className="text-ink-faint" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </div>

        {/* 직원 전용 바로가기 — app_staff 지정 계정에만 노출(관리자 회원관리 > 직원 지정) */}
        {isStaff && (
          <div className="mt-6 border border-rule">
            <button
              onClick={() => navigate('/app/staff-buy')}
              className="w-full flex items-center justify-between px-6 py-4 focus:outline-none focus-visible:shadow-ring"
            >
              <span className="text-[14px] text-ink font-bold">🏷️ 직원 전용 구매</span>
              <span className="text-ink-faint" aria-hidden="true">›</span>
            </button>
          </div>
        )}


        {loggedIn === false && (
          <div className="py-6">
            <button
              onClick={() => navigate('/app/login', { state: { from: '/app/mypage' } })}
              className="text-[13px] text-ink-faint underline focus:outline-none focus-visible:shadow-ring"
            >
              로그인
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
