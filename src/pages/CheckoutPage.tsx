import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import * as PortOne from '@portone/browser-sdk/v2'
import { supabase } from '../lib/supabase'

// 테스트용 고정 주문 (실서비스에선 장바구니/상품 기반으로 대체)
const TEST_ORDER = { name: '테스트 상품', amount: 1000 }

type Status = 'idle' | 'paying' | 'verifying' | 'done' | 'error'

const field =
  'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

export default function CheckoutPage() {
  const [params, setParams] = useSearchParams()
  const [name, setName] = useState('')
  const [tel, setTel] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const storeId = import.meta.env.VITE_PORTONE_STORE_ID as string | undefined
  const channelKey = import.meta.env.VITE_PORTONE_CHANNEL_KEY as string | undefined

  // 서버 결제 검증
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

  // 모바일 결제창 리다이렉트 복귀 처리
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
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePay = async () => {
    setMessage('')
    if (!name.trim() || !tel.trim() || !email.trim()) {
      setMessage('구매자 정보를 모두 입력해 주세요.')
      return
    }
    if (!agree) {
      setMessage('결제 약관에 동의해 주세요.')
      return
    }
    if (!storeId || !channelKey) {
      setMessage('결제 설정이 없습니다. 환경변수(VITE_PORTONE_STORE_ID / VITE_PORTONE_CHANNEL_KEY)를 확인해 주세요.')
      return
    }

    const paymentId = `order_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`

    // (1) 주문(대기) 생성
    setStatus('paying')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error: insErr } = await supabase.from('orders').insert({
      payment_id: paymentId,
      order_name: TEST_ORDER.name,
      amount: TEST_ORDER.amount,
      buyer_name: name.trim(),
      buyer_tel: tel.trim(),
      buyer_email: email.trim(),
      status: 'pending',
      user_id: user?.id ?? null,
    })
    if (insErr) {
      setStatus('error')
      setMessage(`주문 생성 실패: ${insErr.message}`)
      return
    }

    // (2) 포트원 결제창 호출
    const res = await PortOne.requestPayment({
      storeId,
      channelKey,
      paymentId,
      orderName: TEST_ORDER.name,
      totalAmount: TEST_ORDER.amount,
      currency: 'CURRENCY_KRW',
      payMethod: 'CARD',
      customer: {
        fullName: name.trim(),
        phoneNumber: tel.trim(),
        email: email.trim(),
      },
      redirectUrl: `${window.location.origin}/checkout`,
    })

    // (3) 실패/취소 (데스크톱은 code 로 반환)
    if (res?.code != null) {
      await supabase.from('orders').update({ status: 'failed' }).eq('payment_id', paymentId)
      setStatus('error')
      setMessage(res.message || '결제가 취소되었거나 실패했습니다.')
      return
    }

    // (4) 성공 → 서버 검증
    await verify(paymentId)
  }

  const busy = status === 'paying' || status === 'verifying'

  return (
    <main className="min-h-screen py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="max-w-[480px] mx-auto px-4 sm:px-6">
        <Link to="/" className="font-serif text-[20px] font-bold text-gold block text-center mb-8">
          뷰티그라운드
        </Link>

        {status === 'done' ? (
          <div
            className="bg-white rounded-md p-8 md:p-10 text-center border"
            style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
          >
            <div className="text-5xl mb-5" aria-hidden="true">✅</div>
            <h1 className="text-[22px] font-bold text-text mb-2">결제가 완료되었습니다</h1>
            <p className="text-[14px] text-text-sub">
              {TEST_ORDER.name} · {TEST_ORDER.amount.toLocaleString('ko-KR')}원
            </p>
            <Link
              to="/"
              className="inline-block mt-8 bg-gold text-white rounded-pill text-[14px] px-6 py-3 font-medium hover:bg-gold-light transition-colors"
            >
              홈으로
            </Link>
          </div>
        ) : (
          <div
            className="bg-white rounded-md p-6 md:p-8 border"
            style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
          >
            <h1 className="text-[20px] font-bold text-text mb-5">결제하기</h1>

            {/* 주문 요약 */}
            <div className="bg-cream rounded-md p-4 mb-5 flex items-center justify-between">
              <span className="text-[14px] text-text">{TEST_ORDER.name}</span>
              <span className="text-[16px] font-bold text-text">
                {TEST_ORDER.amount.toLocaleString('ko-KR')}원
              </span>
            </div>

            {/* 구매자 정보 */}
            <div className="space-y-3">
              <div>
                <label htmlFor="name" className="block text-[13px] font-medium text-text mb-1.5">
                  이름 <span className="text-[#FF4757]">*</span>
                </label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className={field} />
              </div>
              <div>
                <label htmlFor="tel" className="block text-[13px] font-medium text-text mb-1.5">
                  연락처 <span className="text-[#FF4757]">*</span>
                </label>
                <input id="tel" type="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="010-0000-0000" className={field} />
              </div>
              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                  이메일 <span className="text-[#FF4757]">*</span>
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@example.com" className={field} />
              </div>
            </div>

            {/* 약관 동의 */}
            <label className="flex items-start gap-2.5 mt-5 cursor-pointer">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 w-4 h-4 accent-gold" />
              <span className="text-[13px] text-text-sub">
                [필수] 주문 내용을 확인했으며 결제에 동의합니다.
              </span>
            </label>

            {message && (
              <p className="text-[13px] text-[#FF4757] mt-4" role="alert">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={handlePay}
              disabled={busy}
              className="w-full mt-6 rounded-pill bg-gold text-white hover:bg-gold-light disabled:opacity-60 disabled:cursor-not-allowed text-[15px] font-medium py-3.5 transition-colors"
            >
              {status === 'paying'
                ? '결제 진행 중…'
                : status === 'verifying'
                ? '결제 확인 중…'
                : `${TEST_ORDER.amount.toLocaleString('ko-KR')}원 결제하기`}
            </button>

            <p className="text-[11px] text-text-hint mt-3 text-center leading-relaxed">
              테스트 모드 결제입니다. 실제 청구되지 않습니다.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
