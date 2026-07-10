import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import { supabase } from '../lib/supabase'
import { getCart, updateCartQuantity, removeFromCart, type CartLine } from '../lib/cart'
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../constants'

export default function AppCart() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [lines, setLines] = useState<CartLine[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { setLoggedIn(false); setLoading(false); return }
      const cart = await getCart()
      if (!active) return
      // 담아둔 사이 재고가 줄어 수량이 초과된 라인은 재고에 맞춰 자동 조정
      const adjusted = cart.map((l) => {
        const stock = typeof l.product.stock === 'number' ? l.product.stock : 99
        if (l.product.status === 'on_sale' && stock > 0 && l.quantity > stock) {
          void updateCartQuantity(l.id, stock)
          return { ...l, quantity: stock }
        }
        return l
      })
      setLines(adjusted)
      // 품절/판매중지 상품은 기본 선택에서 제외
      setSelected(new Set(adjusted.filter((l) => l.product.status === 'on_sale' && (typeof l.product.stock !== 'number' || l.product.stock > 0)).map((l) => l.id)))
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  // 판매 가능 여부/최대 수량 — 품절·판매중지·재고 기준
  const lineStock = (l: CartLine) => (typeof l.product.stock === 'number' ? l.product.stock : 99)
  const isUnavailable = (l: CartLine) => l.product.status !== 'on_sale' || lineStock(l) <= 0

  const updateQty = async (line: CartLine, delta: number) => {
    const next = Math.min(lineStock(line), Math.max(1, line.quantity + delta))
    if (next === line.quantity) return
    setLines((prev) => prev.map((l) => (l.id === line.id ? { ...l, quantity: next } : l)))
    await updateCartQuantity(line.id, next)
  }

  const removeItem = async (line: CartLine) => {
    setLines((prev) => prev.filter((l) => l.id !== line.id))
    setSelected((prev) => { const next = new Set(prev); next.delete(line.id); return next })
    await removeFromCart(line.id)
  }

  const toggleSelect = (id: string) => {
    const line = lines.find((l) => l.id === id)
    if (line && isUnavailable(line)) return // 품절 상품은 선택 불가
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectableLines = lines.filter((l) => !isUnavailable(l))

  const toggleAll = () => {
    if (selected.size === selectableLines.length) setSelected(new Set())
    else setSelected(new Set(selectableLines.map((l) => l.id)))
  }

  const selectedLines = lines.filter((l) => selected.has(l.id))
  const subtotal = selectedLines.reduce((s, l) => s + (l.product.sale_price ?? l.product.price) * l.quantity, 0)
  const deliveryFee = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const total = subtotal + deliveryFee

  const goOrder = () => {
    navigate('/app/order', {
      state: {
        items: selectedLines.map((l) => ({
          product_id: l.product.id,
          name: l.product.name,
          price: l.product.sale_price ?? l.product.price,
          quantity: l.quantity,
          thumbnail: l.product.thumbnail_url,
          cart_item_id: l.id,
        })),
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-text-hint text-[14px]">불러오는 중...</p>
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-cream-4">
        <BackHeader title="장바구니" />
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <span className="text-5xl mb-4" aria-hidden="true">🛒</span>
          <p className="text-[16px] font-bold text-text mb-2">로그인이 필요해요</p>
          <p className="text-[13px] text-text-sub mb-6">로그인하면 장바구니를 이용할 수 있어요</p>
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/cart' } })}
            className="bg-gold text-white font-semibold text-[14px] px-8 py-3 rounded-pill hover:bg-gold-light transition-colors"
          >
            로그인하기
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-4 pb-40">
      <BackHeader title="장바구니" />

      {lines.length === 0 ? (
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
          <div className="bg-white px-5 py-3 flex items-center gap-3 border-b border-cream-2">
            <input
              type="checkbox"
              id="select-all"
              checked={selectableLines.length > 0 && selected.size === selectableLines.length}
              onChange={toggleAll}
              className="w-4 h-4 accent-gold"
              aria-label="전체 선택"
            />
            <label htmlFor="select-all" className="text-[13px] text-text cursor-pointer">
              전체 선택 ({selected.size}/{selectableLines.length})
            </label>
          </div>

          <div className="px-4 pt-3 flex flex-col gap-3">
            {lines.map((line) => {
              const price = line.product.sale_price ?? line.product.price
              const unavailable = isUnavailable(line)
              const stock = lineStock(line)
              return (
                <div
                  key={line.id}
                  className={`bg-white rounded-md p-4 border transition-colors ${
                    unavailable ? 'border-cream-2 opacity-60' : selected.has(line.id) ? 'border-gold/40' : 'border-cream-2'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(line.id)}
                      onChange={() => toggleSelect(line.id)}
                      disabled={unavailable}
                      className="w-4 h-4 accent-gold mt-1 flex-shrink-0 disabled:opacity-40"
                      aria-label={`${line.product.name} 선택`}
                    />
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-cream flex-shrink-0 relative">
                      {line.product.thumbnail_url ? (
                        <img src={line.product.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : null}
                      {unavailable && (
                        <span className="absolute inset-0 bg-black/45 text-white text-[11px] font-bold flex items-center justify-center">품절</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className="text-[13px] font-semibold text-text leading-tight line-clamp-2">{line.product.name}</p>
                        <button
                          onClick={() => removeItem(line)}
                          className="text-text-hint hover:text-text ml-2 flex-shrink-0"
                          aria-label={`${line.product.name} 삭제`}
                        >
                          <span aria-hidden="true">✕</span>
                        </button>
                      </div>
                      {unavailable ? (
                        <p className="text-[12px] text-[#B4472A] mt-2">현재 구매할 수 없는 상품이에요 (품절/판매중지)</p>
                      ) : (
                        <>
                          {stock <= 5 && (
                            <p className="text-[11px] text-[#B4472A] mt-1">재고 {stock}개 남음</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 border border-cream-2 rounded-pill">
                              <button
                                onClick={() => updateQty(line, -1)}
                                className="w-7 h-7 flex items-center justify-center text-text-sub hover:text-text disabled:opacity-40"
                                aria-label="수량 감소"
                                disabled={line.quantity <= 1}
                              >
                                <span aria-hidden="true">−</span>
                              </button>
                              <span className="text-[13px] font-medium text-text w-4 text-center" aria-live="polite">
                                {line.quantity}
                              </span>
                              <button
                                onClick={() => updateQty(line, 1)}
                                className="w-7 h-7 flex items-center justify-center text-text-sub hover:text-text disabled:opacity-40"
                                aria-label="수량 증가"
                                disabled={line.quantity >= stock}
                              >
                                <span aria-hidden="true">+</span>
                              </button>
                            </div>
                            <span className="text-[15px] font-bold text-text">
                              {(price * line.quantity).toLocaleString('ko-KR')}원
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

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
              {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
                <p className="text-[11px] text-text-hint">
                  {(FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString('ko-KR')}원 더 담으면 무료 배송
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

      {lines.length > 0 && (
        // 하단 네비(z-50, bottom-0) 위에 쌓이도록 위치 — bottom-0 이면 네비에 가려 클릭 불가
        <div
          className="fixed left-0 right-0 bg-white border-t border-cream-2 px-4 py-3 z-40"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={goOrder}
            disabled={selected.size === 0}
            className="w-full bg-[#232f52] text-white font-bold text-[15px] py-4 rounded-pill hover:bg-[#2e3d6a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selected.size > 0 ? `선택 상품 주문 (${total.toLocaleString('ko-KR')}원)` : '상품을 선택해주세요'}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
