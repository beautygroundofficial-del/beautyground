import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import * as PortOne from '@portone/browser-sdk/v2'
import BackHeader from '../components/layout/BackHeader'
import { supabase } from '../lib/supabase'
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../constants'
import { getAddresses, addAddress, type Address } from '../lib/addresses'

interface OrderItem {
  product_id: string
  name: string
  price: number
  quantity: number
  thumbnail?: string | null
  cart_item_id?: string
}

type Status = 'idle' | 'paying' | 'verifying' | 'done' | 'error'

const field =
  'w-full bg-white border border-cream-2 rounded-md px-3.5 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

export default function AppOrder() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()

  const items: OrderItem[] = (location.state as { items?: OrderItem[] } | null)?.items ?? []
  const [checkedAuth, setCheckedAuth] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [saveNewAddress, setSaveNewAddress] = useState(true)
  const [deliveryMemo, setDeliveryMemo] = useState('')
  const [agreed, setAgreed] = useState(false)

  // 배송지 입력칸 수정 시: 저장된 배송지를 그대로 쓰는 게 아니게 되므로 선택상태 해제(다시 "저장" 체크박스 노출)
  const editField = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setSelectedAddressId(null)
  }
  const selectSavedAddress = (a: Address) => {
    setName(a.recipient_name)
    setPhone(a.phone)
    setAddress(a.address)
    setSelectedAddressId(a.id)
  }
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')
  const [doneOrder, setDoneOrder] = useState<{ orderName: string; amount: number } | null>(null)

  const storeId = import.meta.env.VITE_PORTONE_STORE_ID as string | undefined
  const channelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY as string | undefined

  // 로그인 확인 + 이름/연락처 기본값(가입정보) 채우기
  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) {
        navigate('/app/login', { state: { from: '/app/order' }, replace: true })
        return
      }
      const meta = session.user.user_metadata as { name?: string; phone?: string } | undefined
      const addrs = await getAddresses()
      if (!active) return
      setSavedAddresses(addrs)
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

  const verify = async (paymentId: string) => {
    setStatus('verifying')
    setMessage('')
    try {
      const res = await fetch('/api/payment-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      })
      const json = await res.json()
      if (json?.ok) {
        // 장바구니에서 온 항목이면 결제 완료된 것만 장바구니에서 제거
        const cartItemIds = items.map((i) => i.cart_item_id).filter((v): v is string => !!v)
        if (cartItemIds.length > 0) {
          await supabase.from('cart_items').delete().in('id', cartItemIds)
        }
        // 성공 요약: DB에서 실제 저장된 주문행으로 재구성(리다이렉트 복귀 시 items state 유실 대비)
        const { data } = await supabase
          .from('orders')
          .select('order_name, amount')
          .eq('payment_id', paymentId)
        const rows = (data ?? []) as { order_name: string | null; amount: number }[]
        const amount = rows.reduce((s, r) => s + r.amount, 0)
        const orderName = rows[0]?.order_name ?? '주문 상품'
        setDoneOrder({ orderName, amount })
        setStatus('done')
      } else {
        setStatus('error')
        setMessage(json?.reason || '결제 검증에 실패했습니다.')
      }
    } catch {
      setStatus('error')
      setMessage('결제 검증 요청에 실패했습니다.')
    }
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const deliveryFee = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const total = subtotal + deliveryFee

  const handlePay = async () => {
    setMessage('')
    if (items.length === 0) { setMessage('주문할 상품이 없습니다.'); return }
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setMessage('배송지 정보를 모두 입력해 주세요.')
      return
    }
    if (!agreed) { setMessage('이용약관 및 개인정보처리방침에 동의해 주세요.'); return }
    if (!storeId || !channelKey) {
      setMessage('결제 설정이 없습니다. 관리자에게 문의해 주세요. (PortOne 환경변수 미설정)')
      return
    }

    // 새로 입력한(=저장된 배송지 아닌) 주소면 다음에 쓰게 저장
    if (!selectedAddressId && saveNewAddress) {
      await addAddress({ recipientName: name.trim(), phone: phone.trim(), address: address.trim(), makeDefault: savedAddresses.length === 0 })
    }

    setStatus('paying')
    const { data: { user } } = await supabase.auth.getUser()

    // 상품별 partner_id 조회 (파트너 주문관리 연결용)
    const productIds = items.map((i) => i.product_id)
    const { data: products } = await supabase.from('products').select('id, partner_id').in('id', productIds)
    const partnerOf = new Map(((products ?? []) as { id: string; partner_id: string | null }[]).map((p) => [p.id, p.partner_id]))

    const paymentId = `order_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
    const orderName = items.length > 1 ? `${items[0].name} 외 ${items.length - 1}건` : items[0].name

    const memo = deliveryMemo.trim() || null
    const rows = items.map((i) => ({
      payment_id: paymentId,
      order_name: orderName,
      product_id: i.product_id,
      partner_id: partnerOf.get(i.product_id) ?? null,
      quantity: i.quantity,
      amount: i.price * i.quantity,
      buyer_name: name.trim(),
      buyer_phone: phone.trim(),
      buyer_email: user?.email ?? null,
      status: 'pending',
      user_id: user?.id ?? null,
      delivery_memo: memo,
    }))
    // 배송비도 한 행으로 반영(상품 없는 배송비 행) — 합계 검증(payment-complete)과 일치시키기 위함
    if (deliveryFee > 0) {
      rows.push({
        payment_id: paymentId,
        order_name: '배송비',
        product_id: null as unknown as string,
        partner_id: null,
        quantity: 1,
        amount: deliveryFee,
        buyer_name: name.trim(),
        buyer_phone: phone.trim(),
        buyer_email: user?.email ?? null,
        status: 'pending',
        user_id: user?.id ?? null,
        delivery_memo: memo,
      })
    }

    let { error: insErr } = await supabase.from('orders').insert(rows)
    if (insErr && /delivery_memo/i.test(insErr.message)) {
      // orders_customer_flow.sql 미실행 환경 폴백 — 요청사항 없이라도 주문은 진행
      const fallbackRows = rows.map(({ delivery_memo: _m, ...rest }) => rest)
      ;({ error: insErr } = await supabase.from('orders').insert(fallbackRows))
    }
    if (insErr) {
      setStatus('error')
      setMessage(`주문 생성 실패: ${insErr.message}`)
      return
    }

    const res = await PortOne.requestPayment({
      storeId,
      channelKey,
      paymentId,
      orderName,
      totalAmount: total,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      customer: { fullName: name.trim(), phoneNumber: phone.trim(), email: user?.email ?? undefined },
      redirectUrl: `${window.location.origin}/app/order`,
    })

    if (res?.code != null) {
      await supabase.from('orders').update({ status: 'failed' }).eq('payment_id', paymentId)
      setStatus('error')
      setMessage(res.message || '결제가 취소되었거나 실패했습니다.')
      return
    }

    await verify(paymentId)
  }

  const busy = status === 'paying' || status === 'verifying'

  if (status === 'done' && doneOrder) {
    return (
      <div className="min-h-screen bg-cream-4 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center text-4xl mb-5" aria-hidden="true">✅</div>
        <h1 className="font-serif text-[24px] font-bold text-text mb-2">주문이 완료되었습니다</h1>
        <p className="text-text-sub text-[14px] leading-relaxed mb-2">{doneOrder.orderName}</p>
        <p className="text-[16px] font-bold text-gold mb-8">{doneOrder.amount.toLocaleString('ko-KR')}원 결제 완료</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => navigate('/app/orders')} className="w-full bg-gold text-white font-semibold text-[15px] py-4 rounded-pill hover:bg-gold-light transition-colors">
            주문 내역 확인
          </button>
          <button onClick={() => navigate('/app/home')} className="w-full bg-cream-3 text-text-sub font-semibold text-[15px] py-4 rounded-pill hover:bg-cream-2 transition-colors">
            계속 쇼핑하기
          </button>
        </div>
      </div>
    )
  }

  if (!checkedAuth) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-text-hint text-[14px]">불러오는 중...</div>
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream-4 flex flex-col items-center justify-center px-8 text-center">
        <p className="text-[15px] text-text-sub mb-6">주문할 상품이 없습니다.</p>
        <button onClick={() => navigate('/app/cart')} className="bg-gold text-white font-semibold text-[14px] px-8 py-3 rounded-pill hover:bg-gold-light transition-colors">
          장바구니로 이동
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-4 pb-40">
      <BackHeader title="주문/결제" />

      {/* 배송지 */}
      <div className="bg-white px-5 py-5 border-b border-cream-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-text">배송지</h2>
          <button type="button" onClick={() => navigate('/app/addresses')} className="text-[12px] text-gold hover:underline">
            배송지 관리
          </button>
        </div>

        {savedAddresses.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {savedAddresses.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectSavedAddress(a)}
                className={`shrink-0 text-left rounded-md border px-3 py-2 text-[12px] max-w-[180px] transition-colors ${
                  selectedAddressId === a.id ? 'border-gold bg-gold/5' : 'border-cream-2'
                }`}
              >
                <p className="font-semibold text-text truncate">{a.recipient_name}{a.is_default ? ' · 기본' : ''}</p>
                <p className="text-text-hint truncate">{a.address}</p>
              </button>
            ))}
          </div>
        )}

        <input value={name} onChange={(e) => editField(setName)(e.target.value)} placeholder="받는 분 성함" className={field} />
        <input value={phone} onChange={(e) => editField(setPhone)(e.target.value)} placeholder="연락처 (010-0000-0000)" className={field} />
        <input value={address} onChange={(e) => editField(setAddress)(e.target.value)} placeholder="배송 주소" className={field} />

        {!selectedAddressId && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} className="w-4 h-4 accent-gold" />
            <span className="text-[13px] text-text-sub">이 배송지 저장하기</span>
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
      <div className="bg-white mt-2 px-5 py-5">
        <h2 className="text-[15px] font-bold text-text mb-3">주문 상품 ({items.length})</h2>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.product_id} className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-md overflow-hidden bg-cream flex-shrink-0">
                {item.thumbnail && <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-text truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[12px] text-text-sub">수량 {item.quantity}개</span>
                  <span className="text-[13px] font-bold text-text">{(item.price * item.quantity).toLocaleString('ko-KR')}원</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 결제 금액 */}
      <div className="bg-white mt-2 px-5 py-5">
        <h2 className="text-[15px] font-bold text-text mb-3">결제 금액</h2>
        <div className="space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-text-sub">상품 금액</span>
            <span className="text-text">{subtotal.toLocaleString('ko-KR')}원</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-sub">배송비</span>
            <span className={deliveryFee === 0 ? 'text-[#1D9E75] font-medium' : 'text-text'}>
              {deliveryFee === 0 ? '무료' : `${deliveryFee.toLocaleString('ko-KR')}원`}
            </span>
          </div>
          <div className="flex justify-between pt-3 border-t border-cream-2 mt-3">
            <span className="text-[15px] font-bold text-text">총 결제금액</span>
            <span className="text-[20px] font-bold text-gold">{total.toLocaleString('ko-KR')}원</span>
          </div>
        </div>
      </div>

      {/* 동의 */}
      <div className="bg-white mt-2 px-5 py-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4 accent-gold mt-0.5"
            aria-required="true"
          />
          <span className="text-[13px] text-text-sub leading-relaxed">
            주문 내용을 확인하였으며, 이용약관 및 개인정보처리방침에 동의합니다.
          </span>
        </label>
        {message && <p className="text-[13px] text-[#FF4757] mt-3" role="alert">{message}</p>}
        <p className="text-[11px] text-text-hint mt-3">테스트 모드 결제입니다. 실제 청구되지 않습니다.</p>
      </div>

      {/* 결제 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-2 px-4 py-4 z-40">
        <button
          onClick={handlePay}
          disabled={!agreed || busy}
          className="w-full bg-[#232f52] text-white font-bold text-[15px] py-4 rounded-pill hover:bg-[#2e3d6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-disabled={!agreed || busy}
        >
          {status === 'paying' ? '결제 진행 중…' : status === 'verifying' ? '결제 확인 중…' : `${total.toLocaleString('ko-KR')}원 결제하기`}
        </button>
      </div>
    </div>
  )
}
