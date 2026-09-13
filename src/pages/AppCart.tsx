import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import AppFooter from '../components/layout/AppFooter'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopCart from '../components/cart/DesktopCart'
import ProductRail from '../components/home/ProductRail'
import { useViewMode } from '../lib/viewMode'
import { getCart, updateCartQuantity, removeFromCart, type CartLine } from '../lib/cart'
import { useCartRecommendations } from '../hooks/useCartRecommendations'
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../constants'
import { IconCart, IconClose, IconMinus, IconPlus } from '../components/common/Icon'
import { supabase } from '../lib/supabase'
import { vvipPrice } from '../lib/vvip'

export default function AppCart() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const [loading, setLoading] = useState(true)
  const [lines, setLines] = useState<CartLine[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // VVIP 할인 미리보기(찜/장바구니엔 실제 결제금액은 아니고 안내용 — 최종 금액은 AppOrder.tsx가 재산출)
  const [isVvip, setIsVvip] = useState(false)
  const [deptStoreByPartner, setDeptStoreByPartner] = useState<Map<string, boolean>>(new Map())

  useEffect(() => {
    let active = true
    ;(async () => {
      // 로그인 여부와 무관하게 장바구니를 불러온다(게스트는 브라우저 저장분).
      const [cart, { data: vvipData, error: vvipErr }] = await Promise.all([
        getCart(),
        supabase.rpc('is_vvip'),
      ])
      if (!active) return
      const vvip = !vvipErr && vvipData === true
      setIsVvip(vvip)
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
      if (vvip) {
        const partnerIds = [...new Set(adjusted.map((l) => l.product.partner_id).filter((v): v is string => !!v))]
        if (partnerIds.length > 0) {
          const { data: partners } = await supabase.from('partners').select('id, is_dept_store_brand').in('id', partnerIds)
          if (active) {
            setDeptStoreByPartner(new Map(((partners ?? []) as { id: string; is_dept_store_brand: boolean }[]).map((p) => [p.id, p.is_dept_store_brand])))
          }
        }
      }
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

  // VVIP면 브랜드별(백화점 입점 20%/온라인 전용 30%) 할인가 미리보기 — 최종 결제금액은 AppOrder.tsx에서 재산출
  const linePrice = (l: CartLine) => {
    const base = l.product.sale_price ?? l.product.price
    if (!isVvip) return base
    const isDeptStore = l.product.partner_id ? (deptStoreByPartner.get(l.product.partner_id) ?? true) : true
    return vvipPrice(base, isDeptStore)
  }

  const selectedLines = lines.filter((l) => selected.has(l.id))
  const subtotal = selectedLines.reduce((s, l) => s + linePrice(l) * l.quantity, 0)
  const deliveryFee = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const total = subtotal + deliveryFee

  // 담긴 상품과 같은 카테고리에서 추천 — 장바구니 담긴 상품은 추천에서 제외
  const cartCategories = lines.map((l) => l.product.category).filter((c): c is string => !!c)
  const cartProductIds = lines.map((l) => l.product.id)
  const { products: recommended, loading: recLoading } = useCartRecommendations(cartCategories, cartProductIds)

  const goOrder = async () => {
    // 비회원 구매 허용(2026-09-01) — 상품 상세 "바로구매"는 이미 비회원을 주문서로 보내는데
    // 장바구니 경로만 로그인을 강제하고 있어 "비회원 구매 불가"로 보였다(KG이니시스 심사 지적).
    // 주문서(AppOrder)가 비회원 입력(이름·연락처·이메일·배송지)을 모두 받으므로 그대로 넘긴다.
    navigate('/app/order', {
      state: {
        items: selectedLines.map((l) => ({
          product_id: l.product.id,
          name: l.product.name,
          price: l.product.sale_price ?? l.product.price,
          quantity: l.quantity,
          thumbnail: l.product.thumbnail_url,
          cart_item_id: l.id,
          option_label: l.optionLabel,
        })),
      },
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        {isDesktop ? (
          <div className="max-w-[1280px] mx-auto px-6 py-24 flex items-center justify-center">
            <p className="text-ink-faint text-[14px]">불러오는 중...</p>
          </div>
        ) : (
          <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center">
            <p className="text-ink-faint text-[14px]">불러오는 중...</p>
          </div>
        )}
      </div>
    )
  }

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopCart
          lines={lines}
          selected={selected}
          selectableCount={selectableLines.length}
          isUnavailable={isUnavailable}
          lineStock={lineStock}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          subtotal={subtotal}
          isVvip={isVvip}
          linePrice={linePrice}
          deliveryFee={deliveryFee}
          total={total}
          onOrder={goOrder}
          recommended={recommended}
          recLoading={recLoading}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    {/* pb: 상품 있을 땐 고정 주문바+하단네비(pb-40), 비었을 땐 하단네비만(pb-14) — 빈 화면 큰 공백 방지 */}
    <div className={`max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule ${lines.length > 0 ? 'pb-40' : 'pb-14'}`}>
      <BackHeader title="장바구니" />

      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <IconCart className="w-12 h-12 mb-4 text-ink-faint" />
          <p className="text-[16px] font-bold text-ink mb-2">장바구니가 허전해요</p>
          <p className="text-[13px] text-ink-soft mb-6">최근 둘러본 상품이 아직 기다리고 있어요</p>
          <button
            onClick={() => navigate('/app/home')}
            className="rounded-pill bg-ink text-paper font-bold text-[14px] px-8 py-3 focus:outline-none focus-visible:shadow-ring"
          >
            쇼핑 계속하기
          </button>
        </div>
      ) : (
        <>
          {isVvip && (
            <div className="bg-signal-yellow/20 border-b border-rule px-5 py-2.5">
              <p className="text-[12.5px] font-bold text-ink">VVIP 회원 할인가로 표시했어요</p>
            </div>
          )}
          <div className="bg-paper px-5 py-3 flex items-center gap-3 border-b border-rule">
            <input
              type="checkbox"
              id="select-all"
              checked={selectableLines.length > 0 && selected.size === selectableLines.length}
              onChange={toggleAll}
              className="w-4 h-4 accent-accent"
              aria-label="전체 선택"
            />
            <label htmlFor="select-all" className="text-[13px] text-ink cursor-pointer">
              전체 선택 ({selected.size}/{selectableLines.length})
            </label>
          </div>

          <div className="px-4 pt-3 flex flex-col gap-3">
            {lines.map((line) => {
              const price = linePrice(line)
              const unavailable = isUnavailable(line)
              const stock = lineStock(line)
              return (
                <div
                  key={line.id}
                  className={`bg-paper p-4 rounded-card shadow-card border ${
                    unavailable ? 'border-rule opacity-60' : selected.has(line.id) ? 'border-accent' : 'border-rule'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(line.id)}
                      onChange={() => toggleSelect(line.id)}
                      disabled={unavailable}
                      className="w-4 h-4 accent-accent mt-1 flex-shrink-0 disabled:opacity-40"
                      aria-label={`${line.product.name} 선택`}
                    />
                    <div className="w-16 h-16 rounded-md overflow-hidden bg-quiet flex-shrink-0 relative">
                      {line.product.thumbnail_url ? (
                        <img src={line.product.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : null}
                      {unavailable && (
                        <span className="absolute inset-0 bg-ink/70 text-paper text-[11px] font-bold flex items-center justify-center">품절</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className="text-[13px] font-bold text-ink leading-tight line-clamp-2">{line.product.name}</p>
                        <button
                          onClick={() => removeItem(line)}
                          className="text-ink-faint ml-2 flex-shrink-0 focus:outline-none focus-visible:shadow-ring"
                          aria-label={`${line.product.name} 삭제`}
                        >
                          <IconClose className="w-4 h-4" />
                        </button>
                      </div>
                      {line.optionLabel && (
                        <p className="text-[11.5px] text-ink-faint mt-0.5">옵션: {line.optionLabel}</p>
                      )}
                      {unavailable ? (
                        <p className="text-[12px] text-signal-red mt-2">현재 구매할 수 없는 상품이에요 (품절/판매중지)</p>
                      ) : (
                        <>
                          {stock <= 5 && (
                            <p className="text-[11px] text-signal-red mt-1">재고 {stock}개 남음</p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2 rounded-pill border border-rule">
                              <button
                                onClick={() => updateQty(line, -1)}
                                className="w-7 h-7 flex items-center justify-center text-ink-soft disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
                                aria-label="수량 감소"
                                disabled={line.quantity <= 1}
                              >
                                <IconMinus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-[13px] font-bold tabular-nums text-ink w-4 text-center" aria-live="polite">
                                {line.quantity}
                              </span>
                              <button
                                onClick={() => updateQty(line, 1)}
                                className="w-7 h-7 flex items-center justify-center text-ink-soft disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
                                aria-label="수량 증가"
                                disabled={line.quantity >= stock}
                              >
                                <IconPlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[15px] font-bold tabular-nums text-ink">
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

          <div className="mx-4 mt-3 bg-paper p-4 rounded-card shadow-card border border-rule">
            <h2 className="text-[14px] font-bold text-ink mb-3">주문 요약</h2>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-soft">상품 금액</span>
                <span className="text-ink tabular-nums">{subtotal.toLocaleString('ko-KR')}원</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">배송비</span>
                <span className={deliveryFee === 0 ? 'text-signal-blue font-bold' : 'text-ink tabular-nums'}>
                  {deliveryFee === 0 ? '무료' : `${deliveryFee.toLocaleString('ko-KR')}원`}
                </span>
              </div>
              {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
                <p className="text-[11px] text-ink-faint">
                  무료배송까지 {(FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString('ko-KR')}원 남았어요
                </p>
              )}
              <div className="flex justify-between pt-2 border-t border-rule mt-2">
                <span className="text-[15px] font-bold text-ink">총 결제금액</span>
                <span className="text-[18px] font-bold tabular-nums text-ink">{total.toLocaleString('ko-KR')}원</span>
              </div>
            </div>

            {/* 다른 상품을 더 담으러 가는 동선 — 매장 직원 피드백(2026-08-13) */}
            <div className="px-4 mt-4">
              <button
                onClick={() => navigate('/app/home')}
                className="w-full py-3 rounded-card border border-rule text-[14px] font-bold text-ink focus:outline-none focus-visible:shadow-ring"
              >
                ← 계속 쇼핑하기
              </button>
            </div>
          </div>
          {recommended.length > 0 && (
            <ProductRail
              id="cart-recommend"
              title="이 상품과 잘 어울려요"
              products={recommended}
              loading={recLoading}
              onProductClick={(id) => navigate(`/app/product/${id}`)}
            />
          )}
        </>
      )}

      {lines.length > 0 && (
        // 하단 네비(z-50, bottom-0) 위에 쌓이도록 위치 — bottom-0 이면 네비에 가려 클릭 불가
        <div
          className="fixed left-0 right-0 z-40"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-[480px] mx-auto bg-paper border-t border-rule px-4 py-3">
            <button
              onClick={goOrder}
              disabled={selected.size === 0}
              className="w-full rounded-card bg-ink text-paper font-bold text-[15px] py-4 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:shadow-ring"
            >
              {selected.size > 0 ? `선택 상품 주문 (${total.toLocaleString('ko-KR')}원)` : '상품을 선택해주세요'}
            </button>
          </div>
        </div>
      )}

      <AppFooter />
      <BottomNav />
    </div>
    </div>
  )
}
