import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { getMyMembership, TIERS, type MembershipInfo } from '../lib/membership'

// 실제 로그인 사용자 프로필 (포인트/쿠폰은 아직 적립·발급 시스템이 없어 0 — 가짜 숫자 금지)
interface RealUser {
  name: string
  email: string
  points: number
  coupons: number
  orders: number
  wishlist: number
}

function buildMenuItems(user: RealUser) {
  return [
    { icon: '📦', label: '주문 내역', path: '/app/orders' },
    { icon: '📍', label: '배송지 관리', path: '/app/addresses' },
    { icon: '❤️', label: '찜 목록', path: '/app/wishlist' },
    { icon: '🎫', label: '쿠폰함', count: user.coupons },
    { icon: '💎', label: '포인트', value: `${user.points.toLocaleString()}P` },
    { icon: '👁', label: '최근 본 상품' },
    { icon: '⭐', label: '리뷰 관리' },
  ]
}

const SETTING_ITEMS = [
  { icon: '🔔', label: '알림 설정' },
  { icon: '🔒', label: '계정/보안' },
  { icon: '📋', label: '이용약관', path: '/terms' },
  { icon: '🛡', label: '개인정보처리방침', path: '/privacy' },
  { icon: '❓', label: '고객센터', path: '/about' },
]

const EMPTY_USER: RealUser = { name: '게스트', email: '로그인이 필요해요', points: 0, coupons: 0, orders: 0, wishlist: 0 }

export default function AppMyPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<RealUser>(EMPTY_USER)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [showTierGuide, setShowTierGuide] = useState(false)

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const loadUser = async () => {
    const { data } = await supabase.auth.getUser()
    const authUser = data.user
    setLoggedIn(!!authUser)
    if (!authUser) { setUser(EMPTY_USER); setMembership(null); return }

    const meta = authUser.user_metadata as { name?: string } | undefined
    const name = meta?.name || authUser.email?.split('@')[0] || '고객'

    // 실제 주문 건수(같은 결제 1건 = payment_id 1개, 카트 다건이어도 중복집계 안 되게 dedupe)
    const [{ data: orderRows }, { count: wishlistCount }, ms] = await Promise.all([
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
    ])
    const orderCount = new Set((orderRows ?? []).map((r) => (r as { payment_id: string | null }).payment_id)).size

    setMembership(ms)
    setUser({ name, email: authUser.email ?? '', points: 0, coupons: 0, orders: orderCount, wishlist: wishlistCount ?? 0 })
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

  return (
    <AppFrame>
      <AppHeader />

      {/* 프로필 카드 */}
      <div className="bg-white px-5 pt-5 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center text-2xl flex-shrink-0" aria-hidden="true">
            👤
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-bold text-text">{user.name}</h1>
              <button
                onClick={() => setShowTierGuide((v) => !v)}
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-pill border"
                style={{
                  backgroundColor: membership?.tier.bg ?? '#f3f4f6',
                  color: membership?.tier.color ?? '#6b7280',
                  borderColor: membership?.tier.color ?? '#d4cfc8',
                }}
                aria-label="회원 등급 안내 보기"
              >
                {membership?.tier.label ?? 'BASIC'}
              </button>
            </div>
            <p className="text-[13px] text-text-sub mt-0.5">{user.email}</p>
          </div>
          <button className="text-[12px] text-text-sub border border-cream-2 rounded-pill px-3 py-1.5 hover:bg-cream-2 transition-colors">
            프로필 수정
          </button>
        </div>

        {/* 통계 */}
        <div className="mt-5 grid grid-cols-3 gap-0 border border-cream-2 rounded-md overflow-hidden">
          {[
            { label: '주문', value: user.orders },
            { label: '찜', value: user.wishlist },
            { label: '쿠폰', value: user.coupons },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              className={`py-4 text-center ${i < 2 ? 'border-r border-cream-2' : ''}`}
            >
              <p className="text-[20px] font-bold text-text">{value}</p>
              <p className="text-[12px] text-text-sub mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* 회원 등급 — 누적 구매금액 기반, 배지 클릭으로 등급표 열람 */}
        {loggedIn && membership && (
          <div className="mt-3 rounded-md border border-cream-2 px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-sub">누적 구매금액</span>
              <span className="text-[14px] font-bold text-text">{membership.totalSpent.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[12px] text-text-hint">
                현재 <b style={{ color: membership.tier.color }}>{membership.tier.label}</b> · 구매 시 {membership.tier.rewardRate}% 적립 예정
              </span>
              {membership.next && (
                <span className="text-[12px] text-text-hint">
                  {membership.next.next.label}까지 {membership.next.remain.toLocaleString('ko-KR')}원
                </span>
              )}
            </div>
            {membership.next && (
              <div className="mt-2 h-1.5 bg-cream-3 rounded-pill overflow-hidden" aria-hidden="true">
                <div
                  className="h-full rounded-pill"
                  style={{
                    width: `${Math.min(100, Math.round((membership.totalSpent / membership.next.next.min) * 100))}%`,
                    backgroundColor: membership.tier.color,
                  }}
                />
              </div>
            )}
            {showTierGuide && (
              <div className="mt-3 pt-3 border-t border-cream-3">
                <p className="text-[12px] font-bold text-text mb-2">회원 등급 안내 (누적 구매금액 기준)</p>
                <div className="space-y-1.5">
                  {TIERS.map((t) => (
                    <div key={t.key} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2">
                        <span
                          className="font-bold px-2 py-0.5 rounded-pill text-[10.5px]"
                          style={{ backgroundColor: t.bg, color: t.color }}
                        >
                          {t.label}
                        </span>
                        <span className="text-text-sub">{t.min === 0 ? '가입 시' : `${(t.min / 10000).toLocaleString()}만원 이상`}</span>
                      </span>
                      <span className="text-text">적립 {t.rewardRate}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-text-hint mt-2">적립금 사용은 결제 오픈 후 활성화됩니다.</p>
              </div>
            )}
          </div>
        )}

        {/* 포인트 */}
        <div
          className="mt-3 rounded-md px-4 py-3.5 flex items-center justify-between"
          style={{ backgroundColor: '#FFF8ED' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">✨</span>
            <span className="text-[14px] font-medium text-[#7a6030]">보유 포인트</span>
          </div>
          <span className="text-[18px] font-bold text-gold">
            {user.points.toLocaleString()}P
          </span>
        </div>
      </div>

      {/* 백화점 멤버십 */}
      <div className="mt-2 bg-white px-5 py-4">
        <h2 className="text-[14px] font-bold text-text mb-3">백화점 멤버십 연동</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'ak', name: 'AK플라자', logo: '/images/memberships/ak.png', connected: true },
            { key: 'lotte', name: '롯데백화점', logo: '/images/memberships/lotte.svg', connected: false },
            { key: 'shinsegae', name: '신세계백화점', logo: '/images/memberships/shinsegae.png', connected: false },
            { key: 'hyundai', name: '현대백화점', logo: '/images/memberships/hyundai.png', connected: false },
          ].map(({ key, name, logo, connected }) => (
            <button
              key={key}
              className="rounded-md py-4 px-3 flex flex-col items-center justify-center gap-2.5 border transition-colors focus:outline-none focus:shadow-focus"
              style={{
                backgroundColor: connected ? '#faf5ea' : '#f8f7f5',
                borderColor: connected ? '#b8924a' : '#e5e0d8',
              }}
              aria-label={`${name} 멤버십 ${connected ? '연동됨' : '연동하기'}`}
            >
              <img src={logo} alt={name} className="h-[16px] max-w-[120px] object-contain" />
              <span
                className="text-[10px] px-2 py-0.5 rounded-pill font-medium"
                style={{
                  backgroundColor: connected ? '#b8924a' : '#e5e0d8',
                  color: connected ? '#fff' : '#9a9080',
                }}
              >
                {connected ? '연동됨' : '연동'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 메뉴 */}
      <div className="mt-2 bg-white">
        {buildMenuItems(user).map(({ icon, label, path, count, value }) => (
          <button
            key={label}
            onClick={() => path && navigate(path)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-cream-2 last:border-0 hover:bg-cream-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl w-6 text-center" aria-hidden="true">{icon}</span>
              <span className="text-[14px] text-text">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              {count !== undefined && (
                <span className="text-[13px] font-bold text-gold">{count}</span>
              )}
              {value && (
                <span className="text-[13px] font-bold text-gold">{value}</span>
              )}
              <span className="text-text-hint" aria-hidden="true">›</span>
            </div>
          </button>
        ))}
      </div>

      {/* 설정 */}
      <div className="mt-2 bg-white">
        <p className="px-5 py-3 text-[12px] font-semibold text-text-hint tracking-wide">설정</p>
        {SETTING_ITEMS.map(({ icon, label, path }) => (
          <button
            key={label}
            onClick={() => path && navigate(path)}
            className="w-full flex items-center justify-between px-5 py-4 border-b border-cream-2 last:border-0 hover:bg-cream-4 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl w-6 text-center" aria-hidden="true">{icon}</span>
              <span className="text-[14px] text-text">{label}</span>
            </div>
            <span className="text-text-hint" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      <div className="px-5 py-6">
        {loggedIn === false ? (
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/mypage' } })}
            className="text-[13px] text-text-hint underline"
          >
            로그인
          </button>
        ) : (
          <button
            onClick={handleLogout}
            className="text-[13px] text-text-hint underline"
          >
            로그아웃
          </button>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-black/80 text-white text-[13px] px-4 py-2.5 rounded-pill" role="status">
          {toast}
        </div>
      )}

    </AppFrame>
  )
}
