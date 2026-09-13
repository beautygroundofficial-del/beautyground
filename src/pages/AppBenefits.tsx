import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopBenefits from '../components/benefits/DesktopBenefits'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import {
  getMyPointsBalance,
  getMyValidCoupons,
  claimKakaoFriendBonus,
  hasClaimedKakaoFriendBonus,
  type ValidCoupon,
} from '../lib/rewards'
import { BENEFIT_MIN_ORDER_AMOUNT, KAKAO_CHANNEL_URL } from '../constants'
import { isPushSupported, subscribeToPush } from '../lib/pushNotifications'

// 회원 혜택 모음 — 메인 상단 프로모션 띠(PromoBar)와 마이페이지 메뉴에서 여기로 연결된다.
// ① 회원가입 축하 적립금(자동 지급, supabase/signup_bonus.sql) ② 카카오 친구추가 혜택(자율신고 방식,
// supabase/kakao_friend_bonus.sql — 카카오 비즈니스 채널 친구확인 API 인증 전까지 임시) ③ 보유 적립금·쿠폰함.
// PC 전용 화면이 없어 데스크톱에서도 좁은 모바일 카드 그대로 보이던 것을 분리(2026-09-03).
export default function AppBenefits() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [points, setPoints] = useState(0)
  const [coupons, setCoupons] = useState<ValidCoupon[]>([])
  const [kakaoClaimed, setKakaoClaimed] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [toast, setToast] = useState('')
  // 쿠폰/이벤트 알림용 웹 푸시 — 지금까지는 브랜드 팔로우 시에만 구독을 유도했는데(ShopLiveWatch.tsx),
  // 팔로우한 적 없는 회원은 관리자 쿠폰 생성기로 쿠폰을 보내도 알림이 안 감 — 여기서도 별도로 유도.
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  )
  const [pushBusy, setPushBusy] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2200)
  }

  const handleEnablePush = async () => {
    setPushBusy(true)
    try {
      await subscribeToPush()
      if (Notification.permission === 'granted') {
        setPushEnabled(true)
        showToast('쿠폰·이벤트 알림을 켰어요')
      } else {
        showToast('알림 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.')
      }
    } finally {
      setPushBusy(false)
    }
  }

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoggedIn(false); return }
    setLoggedIn(true)
    const [pts, cps, claimed] = await Promise.all([
      getMyPointsBalance(),
      getMyValidCoupons(),
      hasClaimedKakaoFriendBonus(),
    ])
    setPoints(pts)
    setCoupons(cps)
    setKakaoClaimed(claimed)
  }

  useEffect(() => {
    load()
  }, [])

  const handleClaimKakao = async () => {
    setClaiming(true)
    try {
      const granted = await claimKakaoFriendBonus()
      if (granted) {
        showToast('무료배송 쿠폰 + 3,000P 지급되었습니다')
        await load()
      } else {
        showToast('이미 받은 혜택이에요')
        setKakaoClaimed(true)
      }
    } catch {
      showToast('혜택 받기에 실패했습니다. 다시 시도해 주세요')
    } finally {
      setClaiming(false)
    }
  }

  const minOrderText = `${BENEFIT_MIN_ORDER_AMOUNT.toLocaleString('ko-KR')}원 이상 구매 시 사용 가능`

  const sharedProps = {
    loggedIn,
    points,
    coupons,
    kakaoClaimed,
    claiming,
    pushEnabled,
    pushBusy,
    minOrderText,
    onClaimKakao: handleClaimKakao,
    onEnablePush: () => void handleEnablePush(),
  }

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopBenefits {...sharedProps} />
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
      <BackHeader title="혜택" />

      {loggedIn === false ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[14px] text-ink-soft mb-5">로그인하면 혜택을 확인하고 받을 수 있어요.</p>
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/benefits' } })}
            className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3 focus:outline-none focus-visible:shadow-ring"
          >
            로그인
          </button>
          <p className="text-[12.5px] text-ink-faint mt-4">
            아직 안 받으셨다면 지금 3,000P가 대기 중이에요{' '}
            <button onClick={() => navigate('/app/signup')} className="text-ink font-bold underline focus:outline-none focus-visible:shadow-ring">
              지금 회원가입하기
            </button>
          </p>
        </div>
      ) : (
        <div className="px-4 py-5 space-y-3">
          {/* ① 회원가입 축하 적립금 — 가입 시 자동 지급, 여기서는 안내만 */}
          <div className="border border-rule px-4 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-ink">회원가입 축하 적립금</h2>
              <span className="text-[13px] font-bold tabular-nums text-ink bg-signal-yellow px-2 py-0.5">3,000P</span>
            </div>
            <p className="text-[12.5px] text-ink-soft mt-2 leading-relaxed">
              회원가입 시 자동으로 지급돼요. {minOrderText}(지급 후 30일 뒤 자동 소멸 — 놓치지 마세요).
            </p>
          </div>

          {/* ② 카카오 친구추가 혜택 */}
          <div className="border border-rule px-4 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[14px] font-bold text-ink">카카오 채널 친구추가 혜택</h2>
              {kakaoClaimed && (
                <span className="flex items-center gap-1 text-[12px] font-bold text-ink-soft">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[14px] h-[14px]" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                  받았어요
                </span>
              )}
            </div>
            <p className="text-[12.5px] text-ink-soft mt-2 leading-relaxed">
              무료배송 쿠폰 + 3,000P를 드려요. {minOrderText}(지급일로부터 30일 이내).
            </p>

            {!kakaoClaimed && (
              <div className="flex gap-2 mt-3.5">
                <a
                  href={KAKAO_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-control border border-rule text-ink font-bold text-[13px] py-3 focus:outline-none focus-visible:shadow-ring"
                >
                  <span className="inline-flex items-center justify-center w-[16px] h-[16px] rounded-full bg-[#FEE500] shrink-0" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#3C1E1E" d="M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.66 1.79 5 4.5 6.34-.2.72-.72 2.62-.82 3.03-.13.5.18.5.39.36.16-.11 2.53-1.72 3.56-2.42.44.06.9.09 1.37.09 5.25 0 9.5-3.36 9.5-7.5S17.25 3.5 12 3.5Z" />
                    </svg>
                  </span>
                  채널 추가하기
                </a>
                <button
                  onClick={handleClaimKakao}
                  disabled={claiming}
                  className="flex-1 rounded-control bg-ink text-paper font-bold text-[13px] py-3 disabled:opacity-50 focus:outline-none focus-visible:shadow-ring"
                >
                  {claiming ? '처리 중…' : '혜택 받기'}
                </button>
              </div>
            )}
            <p className="text-[11px] text-ink-faint mt-2">
              친구추가 후 &lsquo;혜택 받기&rsquo;를 눌러주세요.
            </p>
          </div>

          {/* ③ 보유 적립금 · 쿠폰함 */}
          <div className="border border-rule px-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-ink">보유 적립금</span>
              <span className="text-[13px] font-bold tabular-nums text-ink">{points.toLocaleString('ko-KR')}P</span>
            </div>
          </div>

          <div className="border border-rule px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-ink">쿠폰함 ({coupons.length})</h2>
              {isPushSupported() && !pushEnabled && (
                <button
                  onClick={() => void handleEnablePush()}
                  disabled={pushBusy}
                  className="text-[12px] font-semibold text-signal-blue disabled:opacity-50"
                >
                  {pushBusy ? '설정 중...' : '🔔 쿠폰 알림 받기'}
                </button>
              )}
            </div>
            {coupons.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-2">지금 놓치고 있는 혜택이 있을 수 있어요, 위에서 확인해보세요</p>
            ) : (
              <div className="space-y-2.5">
                {coupons.map((c) => (
                  <div key={c.id} className="border-b border-rule pb-2.5 last:border-0 last:pb-0">
                    {c.bannerImage && (
                      <img src={c.bannerImage} alt={c.label} className="w-full rounded-control mb-2 border border-rule" />
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[13px] font-bold text-ink">{c.label}</p>
                        {/* 만료 임박(7일 이하)일 때만 손실회피 톤으로 강조 — 실제 만료일은 그대로,
                            라벨만 바뀐다(2026-09-14, live-input.ts 라이브 알림과 같은 패턴). */}
                        {(() => {
                          const daysLeft = Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 86400000)
                          const prefix = c.minOrderAmount > 0 ? `${c.minOrderAmount.toLocaleString('ko-KR')}원 이상 · ` : ''
                          if (daysLeft <= 7) {
                            return (
                              <p className="text-[11px] font-bold text-signal-red mt-0.5">
                                {prefix}D-{Math.max(daysLeft, 0)} · {daysLeft <= 0 ? '오늘' : `${daysLeft}일 뒤`} 사라져요
                              </p>
                            )
                          }
                          return (
                            <p className="text-[11px] text-ink-faint mt-0.5">
                              {prefix}{new Date(c.expiresAt).toLocaleDateString('ko-KR')}까지
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-control bg-ink text-paper text-[13px] px-4 py-2.5" role="status">
          {toast}
        </div>
      )}
    </AppFrame>
  )
}
