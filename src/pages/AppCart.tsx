import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import { MOCK_CART, DEPT_COLOR } from '../constants'
import type { CartItem } from '../types'

export default function AppCart() {
  const navigate = useNavigate()
  const [items, setItems] = useState<CartItem[]>(MOCK_CART)
  const [selected, setSelected] = useState<Set<number>>(new Set(MOCK_CART.map(i => i.id)))

  const updateQty = (id: number, delta: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ))
  }

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id))
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set())
    else setSelected(new Set(items.map(i => i.id)))
  }

  const selectedItems = items.filter(i => selected.has(i.id))
  const subtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const deliveryFee = subtotal >= 50000 ? 0 : 3000
  const total = subtotal + deliveryFee

  return (
    <div className="min-h-screen bg-cream-4 pb-40">
      <BackHeader title="장바구니" />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <span className="text-5xl mb-4" aria-hidden="true">🛒</span>
          <p className="text-[16px] font-bold text-text mb-2">장바구니가 비어있어요</p>
          <p className="text-[13px] text-text-sub mb-6">마음에 드는 상품을 담아보세요</p>
          <button
            onClick={() => navigate('/app/home')}
            className="bg-gold text-white font-semibold text-[14px] px-8 py-3 rounded-pill hover:bg-gold-light transition-colors"
          >
            쇼핑 계속하기
          </button>
        </div>
      ) : (
        <>
          {/* 전체 선택 */}
          <div className="bg-white px-5 py-3 flex items-center gap-3 border-b border-cream-2">
            <input
              type="checkbox"
              id="select-all"
              checked={selected.size === items.length}
              onChange={toggleAll}
              className="w-4 h-4 accent-gold"
              aria-label="전체 선택"
            />
            <label htmlFor="select-all" className="text-[13px] text-text cursor-pointer">
              전체 선택 ({selected.size}/{items.length})
            </label>
          </div>

          {/* 상품 목록 */}
          <div className="px-4 pt-3 flex flex-col gap-3">
            {items.map((item) => {
              const deptStyle = DEPT_COLOR[item.deptKey]
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-md p-4 border transition-colors ${
                    selected.has(item.id) ? 'border-gold/40' : 'border-cream-2'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      className="w-4 h-4 accent-gold mt-1 flex-shrink-0"
                      aria-label={`${item.name} 선택`}
                    />
                    <div
                      className="w-16 h-16 rounded-md flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: item.thumbColor }}
                      aria-hidden="true"
                    >
                      {item.thumbIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-pill inline-block mb-1"
                            style={{ backgroundColor: deptStyle.bg, color: deptStyle.text }}
                          >
                            {item.deptName}
                          </span>
                          <p className="text-[11px] text-text-sub">{item.brand}</p>
                          <p className="text-[13px] font-semibold text-text leading-tight">{item.name}</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-text-hint hover:text-text ml-2 flex-shrink-0"
                          aria-label={`${item.name} 삭제`}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 border border-cream-2 rounded-pill">
                          <button
                            onClick={() => updateQty(item.id, -1)}
                            className="w-7 h-7 flex items-center justify-center text-text-sub hover:text-text"
                            aria-label="수량 감소"
                            disabled={item.quantity <= 1}
                          >
                            <span aria-hidden="true">−</span>
                          </button>
                          <span className="text-[13px] font-medium text-text w-4 text-center" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-7 h-7 flex items-center justify-center text-text-sub hover:text-text"
                            aria-label="수량 증가"
                          >
                            <span aria-hidden="true">+</span>
                          </button>
                        </div>
                        <span className="text-[15px] font-bold text-text">
                          {(item.price * item.quantity).toLocaleString('ko-KR')}원
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 주문 요약 */}
          <div className="mx-4 mt-3 bg-white rounded-md p-4 border border-cream-2">
            <h2 className="text-[14px] font-bold text-text mb-3">주문 요약</h2>
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
              {subtotal > 0 && subtotal < 50000 && (
                <p className="text-[11px] text-text-hint">
                  {(50000 - subtotal).toLocaleString('ko-KR')}원 더 담으면 무료 배송
                </p>
              )}
              <div className="flex justify-between pt-2 border-t border-cream-2 mt-2">
                <span className="text-[15px] font-bold text-text">총 결제금액</span>
                <span className="text-[18px] font-bold text-gold">{total.toLocaleString('ko-KR')}원</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 하단 결제 바 */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-2 px-4 py-3 z-40">
          <button
            onClick={() => navigate('/app/order')}
            disabled={selected.size === 0}
            className="w-full bg-gold text-white font-bold text-[15px] py-4 rounded-pill hover:bg-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selected.size > 0
              ? `선택 상품 주문 (${total.toLocaleString('ko-KR')}원)`
              : '상품을 선택해주세요'
            }
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
