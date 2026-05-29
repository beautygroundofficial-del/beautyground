import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import { MOCK_CART, DEPT_COLOR } from '../constants'

const PAYMENT_METHODS = [
  { id: 'card', label: '신용/체크카드', icon: '💳' },
  { id: 'kakao', label: '카카오페이', icon: '💛' },
  { id: 'naver', label: '네이버페이', icon: '🟢' },
  { id: 'transfer', label: '계좌이체', icon: '🏦' },
]

export default function AppOrder() {
  const navigate = useNavigate()
  const [payment, setPayment] = useState('card')
  const [agreed, setAgreed] = useState(false)
  const [ordered, setOrdered] = useState(false)
  const [address] = useState('서울특별시 강남구 테헤란로 123 (역삼동)')

  const subtotal = MOCK_CART.reduce((s, i) => s + i.price * i.quantity, 0)
  const deliveryFee = subtotal >= 50000 ? 0 : 3000
  const total = subtotal + deliveryFee

  if (ordered) {
    return (
      <div className="min-h-screen bg-cream-4 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center text-4xl mb-5" aria-hidden="true">
          ✅
        </div>
        <h1 className="font-serif text-[24px] font-bold text-text mb-2">주문이 완료되었습니다</h1>
        <p className="text-text-sub text-[14px] leading-relaxed mb-2">
          주문번호: BGW-2025-{Math.floor(Math.random() * 90000 + 10000)}
        </p>
        <p className="text-[13px] text-text-hint mb-8">
          오후 2시 이전 주문으로 당일 배송됩니다.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate('/app/mypage')}
            className="w-full bg-gold text-white font-semibold text-[15px] py-4 rounded-pill hover:bg-gold-light transition-colors"
          >
            주문 내역 확인
          </button>
          <button
            onClick={() => navigate('/app/home')}
            className="w-full bg-cream-3 text-text-sub font-semibold text-[15px] py-4 rounded-pill hover:bg-cream-2 transition-colors"
          >
            계속 쇼핑하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-4 pb-40">
      <BackHeader title="주문/결제" />

      {/* 배송지 */}
      <div className="bg-white px-5 py-5 border-b border-cream-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-text">배송지</h2>
          <button className="text-[12px] text-gold hover:underline">변경</button>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden="true">📍</span>
          <div>
            <p className="text-[14px] font-semibold text-text">김뷰티 (기본 배송지)</p>
            <p className="text-[13px] text-text-sub mt-0.5 leading-relaxed">{address}</p>
            <p className="text-[12px] text-text-hint mt-1">010-0000-0000</p>
          </div>
        </div>
      </div>

      {/* 주문 상품 */}
      <div className="bg-white mt-2 px-5 py-5">
        <h2 className="text-[15px] font-bold text-text mb-3">주문 상품</h2>
        <div className="space-y-3">
          {MOCK_CART.map((item) => {
            const deptStyle = DEPT_COLOR[item.deptKey]
            return (
              <div key={item.id} className="flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-md flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: item.thumbColor }}
                  aria-hidden="true"
                >
                  {item.thumbIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-pill inline-block mb-0.5"
                    style={{ backgroundColor: deptStyle.bg, color: deptStyle.text }}
                  >
                    {item.deptName}
                  </span>
                  <p className="text-[13px] font-medium text-text truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[12px] text-text-sub">수량 {item.quantity}개</span>
                    <span className="text-[13px] font-bold text-text">{(item.price * item.quantity).toLocaleString('ko-KR')}원</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 결제 수단 */}
      <div className="bg-white mt-2 px-5 py-5">
        <h2 className="text-[15px] font-bold text-text mb-3">결제 수단</h2>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setPayment(id)}
              className={`flex items-center gap-2.5 p-3 rounded-md border text-left transition-colors focus:outline-none focus:shadow-focus ${
                payment === id
                  ? 'border-gold bg-gold/5'
                  : 'border-cream-2 hover:border-gold/30'
              }`}
              aria-pressed={payment === id}
            >
              <span className="text-xl" aria-hidden="true">{icon}</span>
              <span className="text-[13px] font-medium text-text">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 포인트/쿠폰 */}
      <div className="bg-white mt-2 px-5 py-5">
        <h2 className="text-[15px] font-bold text-text mb-3">할인 혜택</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-text">포인트 사용</span>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-text-sub">보유 12,500P</span>
              <button className="text-[12px] text-gold border border-gold rounded-pill px-3 py-1 hover:bg-gold/10 transition-colors">
                전액 사용
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-text">쿠폰 적용</span>
            <button className="text-[12px] text-gold border border-gold rounded-pill px-3 py-1 hover:bg-gold/10 transition-colors">
              쿠폰 선택
            </button>
          </div>
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
            onChange={e => setAgreed(e.target.checked)}
            className="w-4 h-4 accent-gold mt-0.5"
            aria-required="true"
          />
          <span className="text-[13px] text-text-sub leading-relaxed">
            주문 내용을 확인하였으며,{' '}
            <span className="text-gold">이용약관</span> 및{' '}
            <span className="text-gold">개인정보처리방침</span>에 동의합니다.
          </span>
        </label>
      </div>

      {/* 결제 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-2 px-4 py-4 z-40">
        <button
          onClick={() => setOrdered(true)}
          disabled={!agreed}
          className="w-full bg-gold text-white font-bold text-[15px] py-4 rounded-pill hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-disabled={!agreed}
        >
          {total.toLocaleString('ko-KR')}원 결제하기
        </button>
      </div>
    </div>
  )
}
