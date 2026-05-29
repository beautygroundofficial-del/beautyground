import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import ProductCard from '../components/product/ProductCard'
import Badge from '../components/common/Badge'
import { ALL_PRODUCTS, DEPT_COLOR } from '../constants'

const DETAIL_TABS = ['상품정보', '성분', '배송/반품']

export default function AppProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quantity, setQuantity] = useState(1)
  const [activeTab, setActiveTab] = useState(0)
  const [wished, setWished] = useState(false)

  const product = ALL_PRODUCTS.find(p => p.id === Number(id))
  const related = ALL_PRODUCTS.filter(p => p.id !== product?.id && p.deptKey === product?.deptKey).slice(0, 4)

  if (!product) {
    return (
      <div className="min-h-screen bg-cream-4 flex items-center justify-center">
        <p className="text-text-hint">상품을 찾을 수 없습니다.</p>
      </div>
    )
  }

  const deptStyle = DEPT_COLOR[product.deptKey]
  const discountRate = product.originalPrice
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0

  return (
    <div className="min-h-screen bg-white pb-32">
      <BackHeader
        rightElement={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWished(!wished)}
              aria-label={wished ? '찜 해제' : '찜하기'}
            >
              <span className="text-xl" aria-hidden="true">{wished ? '❤️' : '🤍'}</span>
            </button>
            <button
              onClick={() => navigate('/app/cart')}
              aria-label="장바구니"
            >
              <span className="text-xl" aria-hidden="true">🛒</span>
            </button>
          </div>
        }
      />

      {/* 상품 이미지 */}
      <div
        className="h-[280px] flex items-center justify-center"
        style={{ backgroundColor: product.thumbColor }}
        aria-hidden="true"
      >
        <span className="text-[100px] opacity-60">{product.thumbIcon}</span>
      </div>

      {/* 상품 정보 */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge type="dept" label={product.deptName} deptKey={product.deptKey} />
          {discountRate > 0 && (
            <span className="text-[11px] font-bold text-[#FF4757] bg-[#FF4757]/10 px-2 py-0.5 rounded-pill">
              {discountRate}% 할인
            </span>
          )}
        </div>
        <p className="text-[13px] text-text-sub">{product.brand}</p>
        <h1 className="text-[18px] font-bold text-text mt-1 leading-tight">{product.name}</h1>

        <div className="flex items-end gap-2 mt-3">
          <span className="text-[24px] font-bold text-text">
            {product.price.toLocaleString('ko-KR')}원
          </span>
          {product.originalPrice && (
            <span className="text-text-hint text-[15px] line-through pb-0.5">
              {product.originalPrice.toLocaleString('ko-KR')}원
            </span>
          )}
        </div>

        {/* 혜택 요약 */}
        <div className="mt-4 space-y-2">
          {[
            { icon: '💎', label: '멤버십 포인트', value: `${Math.floor(product.price * 0.01).toLocaleString('ko-KR')}P 적립` },
            { icon: '🚀', label: '배송', value: '당일 배송 가능 (오후 2시 이전 주문)' },
            { icon: '🏪', label: '판매처', value: product.deptName, color: deptStyle.text },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="flex items-start gap-3 text-[13px]">
              <span className="flex-shrink-0 w-5 text-center" aria-hidden="true">{icon}</span>
              <span className="text-text-sub w-24 flex-shrink-0">{label}</span>
              <span className="text-text" style={color ? { color } : undefined}>{value}</span>
            </div>
          ))}
        </div>

        {/* 수량 선택 */}
        <div className="mt-5 flex items-center justify-between py-4 border-t border-b border-cream-2">
          <span className="text-[14px] font-medium text-text">수량</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-full border border-cream-2 flex items-center justify-center text-text hover:bg-cream-2 transition-colors"
              aria-label="수량 감소"
              disabled={quantity <= 1}
            >
              <span aria-hidden="true">−</span>
            </button>
            <span className="text-[16px] font-bold text-text w-6 text-center" aria-live="polite">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-9 h-9 rounded-full border border-cream-2 flex items-center justify-center text-text hover:bg-cream-2 transition-colors"
              aria-label="수량 증가"
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className="text-[14px] text-text-sub">총 금액</span>
          <span className="text-[20px] font-bold text-gold">
            {(product.price * quantity).toLocaleString('ko-KR')}원
          </span>
        </div>
      </div>

      {/* 상세 탭 */}
      <div className="border-t border-cream-2">
        <div className="flex border-b border-cream-2">
          {DETAIL_TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`flex-1 py-3 text-[13px] font-medium relative ${activeTab === i ? 'text-text' : 'text-text-hint'}`}
              aria-pressed={activeTab === i}
            >
              {tab}
              {activeTab === i && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        <div className="px-4 py-5 text-[13px] text-text-sub leading-relaxed">
          {activeTab === 0 && (
            <p>
              {product.brand}의 {product.name}은 피부 깊숙이 영양을 공급하며, 탄력 있고 촉촉한 피부를 만들어줍니다.
              공식 BA의 전문적인 피부 상담을 통해 나에게 맞는 사용법을 안내받으세요.
            </p>
          )}
          {activeTab === 1 && (
            <p>
              정제수, 부틸렌글라이콜, 글리세린, 나이아신아마이드, 판테놀, 향료<br />
              (주요 성분 기준, 전성분은 제품 포장 참조)
            </p>
          )}
          {activeTab === 2 && (
            <div className="space-y-2">
              <p>• 배송: CJ대한통운, 주문 후 1~2 영업일 출고</p>
              <p>• 당일 배송: 오후 2시 이전 주문 시 당일 발송</p>
              <p>• 무료 배송: 50,000원 이상 구매 시</p>
              <p>• 반품: 수령 후 7일 이내 가능 (개봉 상품 반품 불가)</p>
            </div>
          )}
        </div>
      </div>

      {/* 관련 상품 */}
      {related.length > 0 && (
        <div className="px-4 py-4 border-t border-cream-2">
          <h2 className="text-[15px] font-bold text-text mb-3">같은 백화점관 상품</h2>
          <div className="grid grid-cols-2 gap-3">
            {related.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/app/product/${p.id}`)}
                className="text-left focus:outline-none focus:shadow-focus rounded-md"
                aria-label={`${p.brand} ${p.name}`}
              >
                <ProductCard {...p} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 하단 구매 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-2 px-4 py-3 flex gap-3 z-40">
        <button
          onClick={() => navigate('/app/cart')}
          className="flex-1 bg-cream-3 text-text-sub font-semibold text-[14px] py-3.5 rounded-pill hover:bg-cream-2 transition-colors"
        >
          장바구니
        </button>
        <button
          onClick={() => navigate('/app/order')}
          className="flex-1 bg-gold text-white font-semibold text-[14px] py-3.5 rounded-pill hover:bg-gold-light transition-colors"
        >
          바로 구매
        </button>
      </div>

      <BottomNav />
    </div>
  )
}
