import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import * as PortOne from '@portone/browser-sdk/v2'
import BackHeader from '../components/layout/BackHeader'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopOrder from '../components/order/DesktopOrder'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import { COMPANY_INFO } from '../lib/companyInfo'
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../constants'
import { getAddresses, addAddress, type Address } from '../lib/addresses'
import { clearCartItems } from '../lib/cart'
import { embedAddressSearch } from '../lib/daumPostcode'
import type { LiveCoupon } from '../lib/types'
import { couponDiscountAmount, couponEligible, couponLabel, couponSoldOut } from '../lib/coupons'
import {
  getMyPointsBalance, getMyValidCoupons, couponDiscountFor, redeemPoints, releasePoints,
  redeemSignupCoupon, releaseSignupCoupon, type ValidCoupon,
} from '../lib/rewards'
import { revalidateOrderItems, buildOrderRows, type OrderItem } from '../lib/orders'

type Status = 'idle' | 'paying' | 'verifying' | 'done' | 'error'

const field =
  'w-full rounded-control bg-paper border border-rule px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

// 다른 /app/* 페이지들과 동일하게 480px 모바일 카드 폭으로 고정 (BottomNav는 없음 — 결제 흐름 중엔 하단 탭 숨김)
function OrderFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { mode, toggle } = useViewMode()
  return (
    <div className="min-h-screen bg-quiet md:py-6">
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <div className={`max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule ${className}`}>
        {children}
      </div>
    </div>
  )
}

export default function AppOrder() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const location = useLocation()
  const [params, setParams] = useSearchParams()

  const navState = location.state as { items?: OrderItem[]; liveId?: string } | null
  const initialItems: OrderItem[] = navState?.items ?? []
  // 라이브 방송 중 구매면 어느 방송에서 나온 주문인지 태깅(방송 통계·파트너 정산용)
  const liveId = navState?.liveId ?? null
  // 서버 재검증(가격/재고/판매상태) 결과가 반영되는 실제 주문 목록
  const [items, setItems] = useState<OrderItem[]>(initialItems)
  const [itemNotices, setItemNotices] = useState<string[]>([]) // 가격변경/수량조정 등 안내
  const [blockedNames, setBlockedNames] = useState<string[]>([]) // 품절/판매종료로 주문 불가
  const [checkedAuth, setCheckedAuth] = useState(false)
  // 비회원 주문(2026-08-18): 로그인 없이 배송지 입력만으로 구매 — 적립금·쿠폰·배송지저장은 회원 전용
  const [isGuest, setIsGuest] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  // 비회원 주문 이메일(2026-09-01): KG이니시스 V2 일반결제는 구매자 이메일이 필수 —
  // 없으면 prepare 단계에서 400으로 막혀 결제창 자체가 안 뜬다. 회원은 가입 이메일을 그대로 쓴다.
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [addressDetail, setAddressDetail] = useState('')
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [saveNewAddress, setSaveNewAddress] = useState(true)
  const [deliveryMemo, setDeliveryMemo] = useState('')

  // 배송지 입력칸 수정 시: 저장된 배송지를 그대로 쓰는 게 아니게 되므로 선택상태 해제(다시 "저장" 체크박스 노출)
  const editField = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setSelectedAddressId(null)
  }
  const selectSavedAddress = (a: Address) => {
    setName(a.recipient_name)
    setPhone(a.phone)
    setAddress(a.address)
    setAddressDetail('')
    setSelectedAddressId(a.id)
  }
  // 팝업(window.open) 대신 화면에 바로 끼워넣는 방식 — 모바일 사파리에서 스크립트 로딩을
  // 기다린 뒤(await) 팝업을 열면 사용자 제스처 밖으로 밀려나 조용히 차단되는 문제가 있었음
  // (2026-08-27 실제 방송 중 발견: "주소 검색" 눌러도 아무 반응 없음).
  const [addrSearchOpen, setAddrSearchOpen] = useState(false)
  const addrContainerRef = useRef<HTMLDivElement>(null)
  // 입력 오류 시 이 지점(폼 맨 위)으로 스크롤 — 메시지가 화면 하단(결제버튼 근처)에만 뜨면
  // 위쪽 입력칸을 보고 있던 유저가 못 보고 넘어가는 문제 방지(2026-09-15 박채널 UX 검토)
  const formTopRef = useRef<HTMLDivElement>(null)
  const handleSearchAddress = () => setAddrSearchOpen(true)
  useEffect(() => {
    if (!addrSearchOpen || !addrContainerRef.current) return
    void embedAddressSearch(addrContainerRef.current, (result) => {
      setAddress(result.address)
      setSelectedAddressId(null)
      setAddrSearchOpen(false)
    })
  }, [addrSearchOpen])
  const addressSearchOverlay = addrSearchOpen && (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end justify-center" onClick={() => setAddrSearchOpen(false)}>
      <div className="w-full sm:max-w-[480px] bg-paper rounded-t-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
          <p className="text-[14px] font-bold text-ink">주소 검색</p>
          <button type="button" onClick={() => setAddrSearchOpen(false)} className="text-ink-faint text-[18px] leading-none" aria-label="닫기">✕</button>
        </div>
        <div ref={addrContainerRef} className="h-[70vh]" />
      </div>
    </div>
  )
  // 모바일 간편결제는 결제 후 이 페이지로 새로 리다이렉트됨 — 복귀 첫 화면부터 '결제 확인 중'으로 시작해야
  // 확인이 끝나기 전에 "주문할 상품이 없습니다"(빈 주문서)가 먼저 보이는 혼란이 없다
  const [status, setStatus] = useState<Status>(() =>
    new URLSearchParams(window.location.search).get('paymentId') ? 'verifying' : 'idle'
  )
  const [message, setMessage] = useState('')
  const [doneOrder, setDoneOrder] = useState<{ orderName: string; amount: number; paymentId: string } | null>(null)
  const [liveCoupon, setLiveCoupon] = useState<LiveCoupon | null>(null)
  // 결제확인이 오래 걸리면(네트워크 지연 등) 탈출구를 보여준다 — 스피너만 보고 멈춰있던 문제(2026-09-15 박채널 UX 검토)
  const [verifyStuck, setVerifyStuck] = useState(false)

  // 적립금·가입 쿠폰(첫구매 등 공용 혜택) — 라이브 쿠폰과 별개, 동시 사용 가능
  const [pointsBalance, setPointsBalance] = useState(0)
  const [usePoints, setUsePoints] = useState(false)
  const [myCoupons, setMyCoupons] = useState<ValidCoupon[]>([])
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null)
  // VVIP 할인(백화점 입점 20% / 온라인 전용 30%, 적립 없음) — revalidateItems()가 매번 다시 판별해
  // items[].price에 이미 반영해둔다(서버 api/payment-complete.ts가 동일 로직으로 재검증).
  const [isVvip, setIsVvip] = useState(false)

  const storeId = import.meta.env.VITE_PORTONE_STORE_ID as string | undefined
  const channelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY as string | undefined
  const paymentReady = Boolean(storeId && channelKey)

  // ── 주문 상품 서버 재검증 ─────────────────────────────────────────────────
  // 장바구니에 담아둔 사이 가격·재고·판매상태가 바뀔 수 있으므로, 화면에 보이는
  // 값이 아니라 "지금 DB의 값"을 기준으로 주문한다. (진입 시 + 결제 직전 각 1회)
  // 실제 로직은 src/lib/orders.ts revalidateOrderItems() — 여기서는 결과의 isVvip를 상태에 반영만 한다.
  const revalidateItems = async (current: OrderItem[]) => {
    const reval = await revalidateOrderItems(current)
    setIsVvip(reval.isVvip)
    return reval
  }

  // 로그인 확인 + 이름/연락처 기본값(가입정보) 채우기
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) {
        // 비회원 주문 허용 — 배송지 직접 입력, 혜택(적립금·쿠폰·배송지저장)은 미적용
        const reval = await revalidateItems(initialItems)
        if (!active) return
        setIsGuest(true)
        setSaveNewAddress(false)
        setItems(reval.items)
        setItemNotices(reval.notices)
        setBlockedNames(reval.blocked)
        setCheckedAuth(true)
        return
      }
      const meta = session.user.user_metadata as { name?: string; phone?: string } | undefined
      setEmail(session.user.email ?? '')
      const [addrs, reval, balance, coupons] = await Promise.all([
        getAddresses(), revalidateItems(initialItems), getMyPointsBalance(), getMyValidCoupons(),
      ])
      if (!active) return
      setItems(reval.items)
      setItemNotices(reval.notices)
      setBlockedNames(reval.blocked)
      setSavedAddresses(addrs)
      setPointsBalance(balance)
      setMyCoupons(coupons)
      const def = addrs.find((a) => a.is_default) ?? addrs[0]
      if (def) {
        setName(def.recipient_name)
        setPhone(def.phone)
        setAddress(def.address)
        setSelectedAddressId(def.id)
      } else {
        setName(meta?.name ?? '')
        setPhone(meta?.phone ?? '')
      }
      setCheckedAuth(true)
    })()
    return () => { active = false }
  }, [navigate])

  // 라이브 구매면 해당 방송의 활성 쿠폰을 조회(있으면 배너 노출 + 결제 직전 자동 적용)
  useEffect(() => {
    if (!liveId) return
    let active = true
    supabase
      .from('live_coupons')
      .select('*')
      .eq('live_id', liveId)
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setLiveCoupon(data as LiveCoupon | null)
      })
    return () => { active = false }
  }, [liveId])

  // 결제창 리다이렉트 복귀(모바일 간편결제 등) 처리 — location.state 는 유실될 수 있어 DB에서 재조회
  useEffect(() => {
    const paymentId = params.get('paymentId')
    if (!paymentId) return
    const code = params.get('code')
    if (code) {
      setStatus('error')
      setMessage(params.get('message') || '결제가 취소되었거나 실패했습니다.')
    } else {
      void verify(paymentId)
    }
    params.delete('paymentId')
    params.delete('code')
    params.delete('message')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 결제창 호출 실패·사용자 취소 시 주문을 실패로 정리한다.
  // 브라우저에서 orders 를 직접 update 하면 RLS 에 막혀 조용히 무시되므로 서버를 거친다(2026-09-01).
  const markOrderFailed = async (paymentId: string) => {
    try {
      await fetch('/api/payment-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, markFailed: true }),
      })
    } catch {
      /* 실패해도 결제 흐름 자체엔 영향 없음 */
    }
  }

  const verify = async (paymentId: string) => {
    setStatus('verifying')
    setMessage('')
    setVerifyStuck(false)
    const stuckTimer = window.setTimeout(() => setVerifyStuck(true), 15000)
    try {
      const res = await fetch('/api/payment-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      const json = await res.json()
      if (json?.ok) {
        // 장바구니에서 온 항목이면 결제 완료된 것만 장바구니에서 제거 (게스트 장바구니 포함)
        const cartItemIds = items.map((i) => i.cart_item_id).filter((v): v is string => !!v)
        if (cartItemIds.length > 0) {
          await clearCartItems(cartItemIds)
        }
        // 성공 요약: DB에서 실제 저장된 주문행으로 재구성(리다이렉트 복귀 시 items state 유실 대비)
        const { data } = await supabase
          .from('orders')
          .select('order_name, amount')
          .eq('payment_id', paymentId)
        const rows = (data ?? []) as { order_name: string | null; amount: number }[]
        // 비회원은 RLS로 주문행 조회가 안 되므로 화면 state로 요약 구성(동기 결제 흐름에선 state가 살아있음)
        const stateAmount = items.reduce((s, i) => s + i.price * i.quantity, 0)
        const stateName = items.length > 1 ? `${items[0].name} 외 ${items.length - 1}건` : items[0]?.name ?? '주문 상품'
        const amount = rows.length > 0 ? rows.reduce((s, r) => s + r.amount, 0) : stateAmount
        const orderName = rows[0]?.order_name ?? stateName
        setDoneOrder({ orderName, amount, paymentId })
        setStatus('done')
      } else {
        setStatus('error')
        setMessage(json?.reason || '결제 검증에 실패했습니다.')
      }
    } catch {
      setStatus('error')
      setMessage('결제 검증 요청에 실패했습니다.')
    } finally {
      window.clearTimeout(stuckTimer)
    }
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const selectedCoupon = selectedCouponId ? myCoupons.find((c) => c.id === selectedCouponId) ?? null : null
  const isFreeShipCoupon = selectedCoupon?.discountType === 'free_shipping'
  const baseDeliveryFee = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const deliveryFee = isFreeShipCoupon ? 0 : baseDeliveryFee
  // 결제 직전 실제 적용 여부는 handlePay 에서 서버(redeem_live_coupon 등)로 원자적으로 확정됨 — 이건 화면 미리보기용
  const couponPreview = liveCoupon && couponEligible(liveCoupon, subtotal) ? couponDiscountAmount(liveCoupon, subtotal) : 0
  const signupCouponPreview = selectedCoupon ? couponDiscountFor(selectedCoupon, subtotal) : 0
  // 적립금은 3만원 이상 구매에만 사용 가능 (2026-08-18 정책 — 서버 payment-complete에서도 동일 검증)
  const pointsEligible = subtotal >= 30000
  const pointsPreview = usePoints && pointsEligible ? Math.min(pointsBalance, subtotal - couponPreview - signupCouponPreview) : 0
  const total = subtotal + deliveryFee - couponPreview - signupCouponPreview - pointsPreview

  const fullAddress = [address, addressDetail].map((s) => s.trim()).filter(Boolean).join(' ')

  const handlePay = async () => {
    setMessage('')
    if (items.length === 0) { setMessage('주문할 상품이 없습니다.'); return }
    // 필드별로 어디가 비었는지 한 번에 모아서 보여준다 — 하나씩 걸려서 여러 번 눌러야 하는 문제 방지(2026-09-15 박채널 UX 검토)
    const fieldErrors: string[] = []
    if (!name.trim()) fieldErrors.push('받는 분 성함을 입력해 주세요')
    if (!phone.trim()) fieldErrors.push('연락처를 입력해 주세요')
    else if (!/^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone.trim())) fieldErrors.push('연락처를 휴대폰 번호 형식(010-0000-0000)으로 입력해 주세요')
    if (!address.trim()) fieldErrors.push('배송 주소를 입력해 주세요')
    // 이니시스 V2 일반결제 필수값 — 비면 결제창 호출 자체가 실패한다
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fieldErrors.push('결제 영수증을 받으실 이메일을 정확히 입력해 주세요')
    if (fieldErrors.length > 0) {
      setMessage(fieldErrors.join(' · '))
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (!storeId || !channelKey) {
      setMessage('아직 결제 수단을 준비하고 있어요. 정식 오픈 후 결제하실 수 있습니다. 조금만 기다려 주세요!')
      return
    }

    // 결제 직전 최종 재검증 — 그 사이 품절/가격변경이 생겼다면 반영하고 사용자 재확인을 받는다
    const reval = await revalidateItems(items)
    if (reval.blocked.length > 0 || reval.notices.length > 0) {
      setItems(reval.items)
      setItemNotices(reval.notices)
      setBlockedNames(reval.blocked)
      setMessage('주문 내용이 변경되었어요. 위 안내를 확인하신 후 다시 결제해 주세요.')
      return
    }

    // 새로 입력한(=저장된 배송지 아닌) 주소면 다음에 쓰게 저장 (회원 전용)
    if (!isGuest && !selectedAddressId && saveNewAddress) {
      await addAddress({ recipientName: name.trim(), phone: phone.trim(), address: fullAddress, makeDefault: savedAddresses.length === 0 })
    }

    setStatus('paying')
    const { data: { user } } = await supabase.auth.getUser()
    const buyerEmail = email.trim() || user?.email || null

    // 상품별 partner_id 조회 (파트너 주문관리 연결용)
    const productIds = items.map((i) => i.product_id)
    const { data: products } = await supabase.from('products').select('id, partner_id').in('id', productIds)
    const partnerOf = new Map(((products ?? []) as { id: string; partner_id: string | null }[]).map((p) => [p.id, p.partner_id]))

    // 라이브 쿠폰 결제 직전 확정 — 재고처럼 원자적으로 처리(동시 결제 시 선착순, redeem_live_coupon 이 조건 재검증)
    let couponDiscount = 0
    let redeemedCoupon = false
    if (liveId && liveCoupon && couponEligible(liveCoupon, subtotal)) {
      const { data: redeemed, error: redeemErr } = await supabase.rpc('redeem_live_coupon', {
        p_live_id: liveId,
        p_subtotal: subtotal,
      })
      if (redeemErr) {
        console.error('[order] coupon redeem failed', redeemErr.message)
      } else {
        const row = (redeemed as LiveCoupon[] | null)?.[0] ?? null
        if (row) {
          redeemedCoupon = true
          couponDiscount = couponDiscountAmount(row, subtotal)
        } else {
          setItemNotices((prev) => [...prev, '라이브 쿠폰이 모두 소진되어 할인 없이 진행돼요.'])
        }
      }
    }
    const paymentId = `order${Date.now()}${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`

    // 적립금·가입 쿠폰(라이브 쿠폰과 별개) 결제 직전 확정 — 실패하면 결제 진행 안 하고 안내 후 재시도 유도
    let redeemedPoints = 0
    let redeemedCouponId: string | null = null
    if (usePoints && pointsPreview > 0) {
      try {
        await redeemPoints(pointsPreview, paymentId)
        redeemedPoints = pointsPreview
      } catch {
        setStatus('idle')
        setMessage('적립금 사용에 실패했어요(잔액이 바뀌었을 수 있어요). 다시 시도해 주세요.')
        return
      }
    }
    if (selectedCoupon) {
      const ok = await redeemSignupCoupon(selectedCoupon.id, paymentId)
      if (!ok) {
        if (redeemedPoints > 0) await releasePoints(paymentId)
        setStatus('idle')
        setMessage('선택한 쿠폰을 사용할 수 없어요(이미 사용됐거나 만료됐을 수 있어요). 다시 시도해 주세요.')
        return
      }
      redeemedCouponId = selectedCoupon.id
    }
    const signupDiscount = redeemedPoints + (redeemedCouponId ? signupCouponPreview : 0)
    const finalTotal = subtotal + deliveryFee - couponDiscount - signupDiscount
    const orderName = items.length > 1 ? `${items[0].name} 외 ${items.length - 1}건` : items[0].name

    const memo = deliveryMemo.trim() || null
    const rows = buildOrderRows({
      items, paymentId, orderName, partnerOf, liveId,
      buyerName: name.trim(), buyerPhone: phone.trim(), buyerEmail, memo, fullAddress,
      deliveryFee, couponDiscount, redeemedPoints, redeemedCouponId,
      signupCouponPreview, selectedCouponLabel: selectedCoupon?.label ?? null,
      userId: user?.id ?? null,
    })

    let { error: insErr } = await supabase.from('orders').insert(rows)
    if (insErr && /delivery_memo/i.test(insErr.message)) {
      // orders_customer_flow.sql 미실행 환경 폴백 — 요청사항 없이라도 주문은 진행
      const fallbackRows = rows.map(({ delivery_memo: _m, ...rest }) => rest)
      ;({ error: insErr } = await supabase.from('orders').insert(fallbackRows))
    }
    if (insErr && /option_label/i.test(insErr.message)) {
      // product_options.sql 미실행 환경 폴백 — 옵션 정보 없이라도 주문은 진행
      const fallbackRows = rows.map(({ option_label: _o, ...rest }) => rest)
      ;({ error: insErr } = await supabase.from('orders').insert(fallbackRows))
    }
    if (insErr) {
      console.error('[order] insert failed', insErr.message)
      setStatus('error')
      setMessage('일시적인 오류로 주문을 완료하지 못했어요. 다시 시도해 주시거나 고객센터로 문의해 주세요.')
      return
    }

    let res: Awaited<ReturnType<typeof PortOne.requestPayment>> | undefined
    try {
      res = await PortOne.requestPayment({
        storeId,
        channelKey,
        paymentId,
        orderName,
        totalAmount: finalTotal,
        currency: 'CURRENCY_KRW',
        payMethod: 'CARD',
        customer: { fullName: name.trim(), phoneNumber: phone.trim(), email: buyerEmail ?? undefined },
        redirectUrl: `${window.location.origin}/app/order`,
      })
    } catch (err) {
      console.error('[order] PortOne.requestPayment threw', err)
      await markOrderFailed(paymentId)
      if (redeemedCoupon && liveId) await supabase.rpc('release_live_coupon', { p_live_id: liveId })
      if (redeemedPoints > 0) await releasePoints(paymentId)
      if (redeemedCouponId) await releaseSignupCoupon(paymentId)
      setStatus('error')
      setMessage('결제창을 여는 데 실패했어요. 다시 시도해 주세요.')
      return
    }

    if (res?.code != null) {
      await markOrderFailed(paymentId)
      // 결제창이 그 자리에서 닫힌 동기 실패 경로에 한해 쿠폰 반환(모바일 리다이렉트 흐름은 상태 유실로 반환 안 됨 — 알려진 한계)
      if (redeemedCoupon && liveId) await supabase.rpc('release_live_coupon', { p_live_id: liveId })
      if (redeemedPoints > 0) await releasePoints(paymentId)
      if (redeemedCouponId) await releaseSignupCoupon(paymentId)
      setStatus('error')
      setMessage(res.message || '결제가 취소되었거나 실패했습니다.')
      return
    }

    await verify(paymentId)
  }

  const busy = status === 'paying' || status === 'verifying'

  if (status === 'done' && doneOrder) {
    return (
      <OrderFrame className="flex flex-col items-center justify-center px-8 text-center">
        <h1 className="text-[24px] font-bold text-ink mb-2">주문이 완료되었습니다</h1>
        <p className="text-ink-soft text-[14px] leading-relaxed mb-2">{doneOrder.orderName}</p>
        <p className="text-[16px] font-bold tabular-nums text-ink mb-8">{doneOrder.amount.toLocaleString('ko-KR')}원 결제 완료</p>
        {isGuest && (
          <div className="w-full max-w-xs border border-rule px-4 py-3.5 mb-6 text-left">
            <p className="text-[11.5px] text-ink-faint mb-1">비회원 주문번호 — 주문 조회에 필요하니 보관해 주세요</p>
            <p className="text-[12.5px] font-bold text-ink break-all select-all">{doneOrder.paymentId}</p>
          </div>
        )}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => (isGuest ? navigate(`/app/guest-order?no=${encodeURIComponent(doneOrder.paymentId)}`) : navigate('/app/orders'))}
            className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-4 focus:outline-none focus-visible:shadow-ring"
          >
            {isGuest ? '주문 조회하기' : '주문 내역 확인'}
          </button>
          {/* 라이브커머스와 온라인몰 메인은 서로 독립된 흐름 — 라이브 구매(liveId 있음)는 라이브커머스로,
              일반 구매는 온라인 메인으로 돌려보낸다(라이브 구매자가 온라인 메인으로 빠지지 않게) */}
          <button
            onClick={() => navigate('/app/home')}
            className="w-full rounded-control border border-rule text-ink-soft font-bold text-[15px] py-4 focus:outline-none focus-visible:shadow-ring"
          >
            {liveId ? '라이브커머스로 돌아가기' : '계속 쇼핑하기'}
          </button>
        </div>
      </OrderFrame>
    )
  }

  if (!checkedAuth) {
    return <OrderFrame className="flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</OrderFrame>
  }

  // 결제 후 리다이렉트 복귀 중에는 주문상품 목록이 비어 있으므로(빈 주문서 오인 방지) 확인/실패 화면을 먼저 처리
  if (status === 'verifying') {
    return (
      <OrderFrame className="flex flex-col items-center justify-center px-8 text-center">
        <h1 className="text-[20px] font-bold text-ink mb-2">결제를 확인하고 있어요</h1>
        <p className="text-ink-soft text-[14px]">잠시만 기다려주세요…</p>
        {verifyStuck && (
          <div className="mt-8 w-full max-w-xs">
            <p className="text-ink-faint text-[12.5px] mb-4">생각보다 오래 걸리고 있어요. 주문내역에서 결제 상태를 확인하실 수 있어요.</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/app/orders')} className="w-full rounded-control bg-ink text-paper font-bold text-[14px] py-3.5 focus:outline-none focus-visible:shadow-ring">
                주문 내역 확인
              </button>
              <button onClick={() => navigate('/app/home')} className="w-full rounded-control border border-rule text-ink-soft font-bold text-[14px] py-3.5 focus:outline-none focus-visible:shadow-ring">
                홈으로
              </button>
            </div>
          </div>
        )}
      </OrderFrame>
    )
  }
  if (status === 'error' && items.length === 0) {
    return (
      <OrderFrame className="flex flex-col items-center justify-center px-8 text-center">
        <h1 className="text-[20px] font-bold text-ink mb-2">결제가 완료되지 않았습니다</h1>
        <p className="text-ink-soft text-[13.5px] leading-relaxed mb-8">{message || '결제가 취소되었거나 실패했습니다. 다시 시도해주세요.'}</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => navigate('/app/cart')} className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-4 focus:outline-none focus-visible:shadow-ring">
            장바구니로 이동
          </button>
          <button onClick={() => navigate('/app/home')} className="w-full rounded-control border border-rule text-ink-soft font-bold text-[15px] py-4 focus:outline-none focus-visible:shadow-ring">
            홈으로
          </button>
        </div>
      </OrderFrame>
    )
  }
  if (items.length === 0) {
    return (
      <OrderFrame className="flex flex-col items-center justify-center px-8 text-center">
        <p className="text-[15px] text-ink-soft mb-6">주문할 상품이 없습니다.</p>
        <button onClick={() => navigate('/app/cart')} className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3 focus:outline-none focus-visible:shadow-ring">
          장바구니로 이동
        </button>
      </OrderFrame>
    )
  }

  if (isDesktop) {
    return (
      <>
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <DesktopOrder
        paymentReady={paymentReady}
        liveCoupon={liveCoupon}
        subtotal={subtotal}
        isVvip={isVvip}
        blockedNames={blockedNames}
        itemNotices={itemNotices}
        savedAddresses={savedAddresses}
        selectedAddressId={selectedAddressId}
        onSelectSavedAddress={selectSavedAddress}
        name={name}
        onName={editField(setName)}
        phone={phone}
        onPhone={editField(setPhone)}
        email={email}
        onEmail={setEmail}
        address={address}
        onSearchAddress={handleSearchAddress}
        addressDetail={addressDetail}
        onAddressDetail={editField(setAddressDetail)}
        saveNewAddress={saveNewAddress}
        onSaveNewAddress={setSaveNewAddress}
        isGuest={isGuest}
        deliveryMemo={deliveryMemo}
        onDeliveryMemo={setDeliveryMemo}
        items={items}
        couponPreview={couponPreview}
        myCoupons={myCoupons}
        selectedCouponId={selectedCouponId}
        onSelectCoupon={setSelectedCouponId}
        signupCouponPreview={signupCouponPreview}
        pointsBalance={pointsBalance}
        usePoints={usePoints}
        onUsePoints={setUsePoints}
        pointsPreview={pointsPreview}
        subtotalForCoupon={subtotal}
        deliveryFee={deliveryFee}
        total={total}
        message={message}
        busy={busy}
        status={status}
        onPay={handlePay}
      />
      {addressSearchOverlay}
      </>
    )
  }

  return (
    <OrderFrame className="pb-40">
      <BackHeader title="주문/결제" />
      <div ref={formTopRef} />
      {message && (
        <div className="bg-quiet border-b border-rule px-5 py-3">
          <p className="text-[12.5px] text-signal-red" role="alert">{message}</p>
        </div>
      )}

      {!paymentReady && (
        <div className="bg-quiet border-b border-rule px-5 py-3">
          <p className="text-[12.5px] text-ink-soft leading-relaxed">
            지금은 <b className="text-ink">오픈 준비 기간</b>이에요. 주문서 작성까지 미리 확인하실 수 있고, 결제는 정식 오픈 후 가능합니다.
          </p>
        </div>
      )}

      {liveCoupon && !couponSoldOut(liveCoupon) && subtotal < liveCoupon.min_purchase && (
        <div className="bg-quiet border-b border-rule px-5 py-3">
          <p className="text-[12.5px] text-ink-soft">
            <span className="font-bold text-ink">{(liveCoupon.min_purchase - subtotal).toLocaleString('ko-KR')}원</span> 더 담으면 라이브 쿠폰 {couponLabel(liveCoupon)} 적용!
          </p>
        </div>
      )}

      {isVvip && (
        <div className="bg-signal-yellow/20 border-b border-rule px-5 py-2.5">
          <p className="text-[12.5px] font-bold text-ink">VVIP 회원 할인이 적용된 가격이에요</p>
        </div>
      )}

      {(blockedNames.length > 0 || itemNotices.length > 0) && (
        <div className="bg-quiet border-b border-rule px-5 py-3 space-y-1">
          {blockedNames.map((n) => (
            <p key={n} className="text-[12.5px] text-signal-red">"{n}"은(는) 품절/판매종료되어 주문에서 제외했어요.</p>
          ))}
          {itemNotices.map((t) => (
            <p key={t} className="text-[12.5px] text-signal-red">{t}</p>
          ))}
        </div>
      )}

      {/* 배송지 */}
      <div className="bg-paper px-5 py-5 border-b border-rule space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-ink">배송지</h2>
          {!isGuest && (
            <button type="button" onClick={() => navigate('/app/addresses')} className="text-[12px] text-ink-soft focus:outline-none focus-visible:shadow-ring">
              배송지 관리
            </button>
          )}
        </div>

        {isGuest && (
          <div className="border border-rule bg-quiet px-4 py-3 text-[12.5px] text-ink-soft leading-relaxed">
            비회원으로 주문합니다. 주문 완료 화면의 <strong className="text-ink">주문번호와 연락처</strong>로 배송 조회가 가능합니다.{' '}
            <button type="button" onClick={() => navigate('/app/login', { state: { from: '/app/order' } })} className="text-ink font-bold underline underline-offset-2 focus:outline-none">
              로그인
            </button>
            하면 적립금·쿠폰 혜택을 받을 수 있어요. (지금 입력한 배송지는 로그인 후 다시 입력해야 해요)
          </div>
        )}

        {savedAddresses.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {savedAddresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectSavedAddress(a)}
                className={`shrink-0 text-left rounded-control border px-3 py-2 text-[12px] max-w-[180px] focus:outline-none focus-visible:shadow-ring ${
                  selectedAddressId === a.id ? 'border-ink' : 'border-rule'
                }`}
              >
                <p className="font-bold text-ink truncate">{a.recipient_name}{a.is_default ? ' · 기본' : ''}</p>
                <p className="text-ink-faint truncate">{a.address}</p>
              </button>
            ))}
          </div>
        )}

        <input value={name} onChange={(e) => editField(setName)(e.target.value)} placeholder="받는 분 성함" className={field} />
        <input value={phone} onChange={(e) => editField(setPhone)(e.target.value)} placeholder="연락처 (010-0000-0000)" className={field} />
        {isGuest && (
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="이메일 (결제 영수증·주문 안내 발송)"
            className={field}
          />
        )}
        <div className="flex gap-2">
          <input
            value={address}
            readOnly
            onClick={handleSearchAddress}
            placeholder="주소 검색을 눌러주세요"
            className={`${field} cursor-pointer`}
          />
          <button
            type="button"
            onClick={handleSearchAddress}
            className="shrink-0 rounded-control border border-rule text-ink font-bold text-[13px] px-4 focus:outline-none focus-visible:shadow-ring"
          >
            주소 검색
          </button>
        </div>
        {address && (
          <input
            value={addressDetail}
            onChange={(e) => editField(setAddressDetail)(e.target.value)}
            placeholder="상세 주소 (동/호수 등)"
            className={field}
          />
        )}

        {!isGuest && !selectedAddressId && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} className="w-4 h-4 accent-ink" />
            <span className="text-[13px] text-ink-soft">이 배송지 저장하기</span>
          </label>
        )}

        <input
          value={deliveryMemo}
          onChange={(e) => setDeliveryMemo(e.target.value)}
          placeholder="배송 요청사항 (예: 문 앞에 놓아주세요)"
          maxLength={100}
          className={field}
        />
      </div>

      {/* 주문 상품 */}
      <div className="bg-paper mt-2 px-5 py-5">
        <h2 className="text-[15px] font-bold text-ink mb-3">주문 상품 ({items.length})</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={`${item.product_id}:${item.option_label ?? ''}`} className="flex items-center gap-3">
              <div className="w-14 h-14 overflow-hidden bg-quiet flex-shrink-0">
                {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-ink truncate">{item.name}</p>
                {item.option_label && <p className="text-[11.5px] text-ink-faint mt-0.5">옵션: {item.option_label}</p>}
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[12px] text-ink-soft">수량 {item.quantity}개</span>
                  <span className="text-[13px] font-bold tabular-nums text-ink">{(item.price * item.quantity).toLocaleString('ko-KR')}원</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 쿠폰·적립금 */}
      {(myCoupons.length > 0 || pointsBalance > 0) && (
        <div className="bg-paper mt-2 px-5 py-5 space-y-3">
          <h2 className="text-[15px] font-bold text-ink">쿠폰·적립금</h2>
          {myCoupons.length > 0 && (
            <div>
              <label className="text-[12px] text-ink-soft block mb-1.5">쿠폰</label>
              <select
                value={selectedCouponId ?? ''}
                onChange={(e) => setSelectedCouponId(e.target.value || null)}
                className={field}
              >
                <option value="">쿠폰 선택 안 함</option>
                {myCoupons.map((c) => (
                  <option key={c.id} value={c.id} disabled={subtotal < c.minOrderAmount}>
                    {c.label}{subtotal < c.minOrderAmount ? ` (${c.minOrderAmount.toLocaleString('ko-KR')}원 이상 구매 시)` : ''}
                  </option>
                ))}
              </select>
              {/* 미달 쿠폰이 있으면 드롭다운을 펼치지 않아도 보이게 — 적립금 힌트와 동일한 방식(2026-09-15 박채널 UX 검토) */}
              {myCoupons.some((c) => subtotal < c.minOrderAmount) && (
                <p className="text-[11.5px] text-ink-faint mt-1.5">
                  {myCoupons.filter((c) => subtotal < c.minOrderAmount).map((c) => `${c.label}(${c.minOrderAmount.toLocaleString('ko-KR')}원 이상)`).join(' · ')}
                </p>
              )}
            </div>
          )}
          {pointsBalance > 0 && (
            <label className={`flex items-center gap-2 ${pointsEligible ? 'cursor-pointer' : 'opacity-50'}`}>
              <input type="checkbox" checked={usePoints && pointsEligible} disabled={!pointsEligible} onChange={(e) => setUsePoints(e.target.checked)} className="w-4 h-4 accent-ink" />
              <span className="text-[13px] text-ink-soft">
                보유 적립금 {pointsBalance.toLocaleString('ko-KR')}P 사용
                {!pointsEligible && <span className="text-[11.5px] text-ink-faint ml-1">(3만원 이상 구매 시 사용 가능)</span>}
              </span>
            </label>
          )}
        </div>
      )}

      {/* 결제 금액 */}
      <div className="bg-paper mt-2 px-5 py-5">
        <h2 className="text-[15px] font-bold text-ink mb-3">결제 금액</h2>
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-ink-soft">상품 금액</span>
            <span className="text-ink tabular-nums">{subtotal.toLocaleString('ko-KR')}원</span>
          </div>
          {couponPreview > 0 && (
            <div className="flex justify-between">
              <span className="text-signal-blue">라이브 쿠폰 할인</span>
              <span className="text-signal-blue font-bold tabular-nums">-{couponPreview.toLocaleString('ko-KR')}원</span>
            </div>
          )}
          {signupCouponPreview > 0 && (
            <div className="flex justify-between">
              <span className="text-signal-blue">쿠폰 할인</span>
              <span className="text-signal-blue font-bold tabular-nums">-{signupCouponPreview.toLocaleString('ko-KR')}원</span>
            </div>
          )}
          {pointsPreview > 0 && (
            <div className="flex justify-between">
              <span className="text-signal-blue">적립금 사용</span>
              <span className="text-signal-blue font-bold tabular-nums">-{pointsPreview.toLocaleString('ko-KR')}원</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-ink-soft">배송비</span>
            <span className={deliveryFee === 0 ? 'text-signal-blue font-bold' : 'text-ink tabular-nums'}>
              {deliveryFee === 0 ? '무료' : `${deliveryFee.toLocaleString('ko-KR')}원`}
            </span>
          </div>
          <div className="flex justify-between pt-3 border-t border-rule mt-3">
            <span className="text-[15px] font-bold text-ink">총 결제금액</span>
            <span className="text-[20px] font-bold tabular-nums text-ink">{total.toLocaleString('ko-KR')}원</span>
          </div>
        </div>
        <p className="text-[11.5px] text-ink-faint mt-3 pt-3 border-t border-rule">결제수단: 신용·체크카드</p>
      </div>

      {/* 안내 — 체크박스 대신 결제 시 동의 간주(쿠팡·네이버식). 주문 확인·정정 절차는 이 주문서 화면 자체로 충족 */}
      <div className="bg-paper mt-2 px-5 py-5">
        <p className="text-[12px] text-ink-soft leading-relaxed">
          결제하기 버튼을 누르면 주문 내용을 확인한 것으로 보며,{' '}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline">이용약관</a> 및{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">개인정보처리방침</a>에 동의한 것으로 간주됩니다.
        </p>
        {message && <p className="text-[13px] text-signal-red mt-3" role="alert">{message}</p>}
        <p className="text-[11px] text-ink-faint mt-4 pt-3 border-t border-rule leading-relaxed">
          {COMPANY_INFO.name} | 대표: {COMPANY_INFO.ceo} | 사업자등록번호: {COMPANY_INFO.bizNumber} | 통신판매업신고: {COMPANY_INFO.mailOrderNumber}
          <br />
          {COMPANY_INFO.address} | 소비자상담실: {COMPANY_INFO.csPhone} ({COMPANY_INFO.csHours})
        </p>
      </div>

      {/* 결제 버튼 (다른 페이지 하단 탭과 동일하게 뷰포트 기준 fixed + 내부 480px 카드폭으로 정렬) */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-[480px] mx-auto bg-paper border-t border-rule px-4 py-4">
          <button
            onClick={handlePay}
            disabled={busy}
            className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-4 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:shadow-ring"
            aria-disabled={busy}
          >
            {status === 'paying' ? '결제 진행 중…'
              : paymentReady ? `${total.toLocaleString('ko-KR')}원 결제하기`
              : `${total.toLocaleString('ko-KR')}원 · 결제 오픈 준비 중`}
          </button>
        </div>
      </div>
      {addressSearchOverlay}
    </OrderFrame>
  )
}
