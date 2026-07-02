import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import { supabase } from '../lib/supabase'
import { MOCK_USER, DEPT_COLOR } from '../constants'

const MENU_ITEMS = [
  { icon: '📦', label: '주문 내역', path: '/app/order' },
  { icon: '❤️', label: '찜 목록', path: '/app/wishlist' },
  { icon: '🎫', label: '쿠폰함', count: MOCK_USER.coupons },
  { icon: '💎', label: '포인트', value: `${MOCK_USER.points.toLocaleString()}P` },
  { icon: '👁', label: '최근 본 상품' },
  { icon: '⭐', label: '리뷰 관리' },
]

const SETTING_ITEMS = [
  { icon: '🔔', label: '알림 설정' },
  { icon: '🔒', label: '계정/보안' },
  { icon: '📋', label: '이용약관' },
  { icon: '🛡', label: '개인정보처리방침' },
  { icon: '❓', label: '고객센터' },
]

const TIER_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  BASIC: { bg: '#f0ede8', text: '#5a5547', border: '#d4cfc8' },
  VIP: { bg: '#EEEDFE', text: '#3C3489', border: '#7F77DD' },
  VVIP: { bg: '#FFF8ED', text: '#7a6030', border: '#b8924a' },
}

export default function AppMyPage() {
  const navigate = useNavigate()
  const user = MOCK_USER
  const tierStyle = TIER_STYLE[user.tier]

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (active) setLoggedIn(!!data.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user)
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
    <div className="min-h-screen bg-cream-4 pb-20">
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
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-pill border"
                style={{ backgroundColor: tierStyle.bg, color: tierStyle.text, borderColor: tierStyle.border }}
              >
                {user.tier}
              </span>
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
        <div className="grid grid-cols-3 gap-2">
          {(['lotte', 'shinsegae', 'hyundai'] as const).map((key) => {
            const style = DEPT_COLOR[key]
            const names = { lotte: '롯데', shinsegae: '신세계', hyundai: '현대' }
            const connected = key === 'hyundai'
            return (
              <button
                key={key}
                className="rounded-md py-3 px-2 flex flex-col items-center gap-1.5 border transition-colors focus:outline-none focus:shadow-focus"
                style={{
                  backgroundColor: connected ? style.bg : '#f8f7f5',
                  borderColor: connected ? style.accent : '#e5e0d8',
                }}
                aria-label={`${names[key]}백화점 멤버십 ${connected ? '연동됨' : '연동하기'}`}
              >
                <span className="text-[20px]" aria-hidden="true">
                  {key === 'lotte' ? '🏪' : key === 'shinsegae' ? '🏬' : '🏢'}
                </span>
                <span className="text-[11px] font-medium" style={{ color: connected ? style.text : '#9a9080' }}>
                  {names[key]}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-pill font-medium"
                  style={{
                    backgroundColor: connected ? style.accent : '#e5e0d8',
                    color: connected ? '#fff' : '#9a9080',
                  }}
                >
                  {connected ? '연동됨' : '연동'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 메뉴 */}
      <div className="mt-2 bg-white">
        {MENU_ITEMS.map(({ icon, label, path, count, value }) => (
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
        {SETTING_ITEMS.map(({ icon, label }) => (
          <button
            key={label}
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
            onClick={() => navigate('/partner/login')}
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

      <BottomNav />
    </div>
  )
}
