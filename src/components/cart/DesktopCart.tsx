import { useNavigate } from 'react-router-dom'
import { IconCart, IconClose, IconMinus, IconPlus } from '../common/Icon'
import DesktopHeader from '../layout/DesktopHeader'
import DesktopFooter from '../layout/DesktopFooter'
import ProductRail from '../home/ProductRail'
import { FREE_SHIPPING_THRESHOLD } from '../../constants'
import type { CartLine } from '../../lib/cart'
import type { ShopProduct } from '../../hooks/useShopProducts'

interface Props {
  lines: CartLine[]
  selected: Set<string>
  selectableCount: number
  isUnavailable: (l: CartLine) => boolean
  lineStock: (l: CartLine) => number
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
  onUpdateQty: (line: CartLine, delta: number) => void
  onRemove: (line: CartLine) => void
  subtotal: number
  isVvip: boolean
  linePrice: (line: CartLine) => number
  deliveryFee: number
  total: number
  onOrder: () => void
  recommended: ShopProduct[]
  recLoading: boolean
}

// PC 버전 — 왼쪽에 상품 목록, 오른쪽에 스크롤해도 고정되는 주문 요약 패널(구매 흐름 최종 단계라
// 상품상세 구매패널과 같은 자리에 같은 구조로 둬 사용자가 익숙한 위치에서 결제로 이어지게 한다).
export default function DesktopCart({
  lines,
  selected,
  selectableCount,
  isUnavailable,
  lineStock,
  onToggleSelect,
  onToggleAll,
  onUpdateQty,
  onRemove,
  subtotal,
  isVvip,
  linePrice,
  deliveryFee,
  total,
  onOrder,
  recommended,
  recLoading,
}: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-paper min-h-screen">
      <DesktopHeader />

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        <h1 className="text-[22px] font-bold text-ink mb-8">장바구니</h1>

        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <IconCart className="w-12 h-12 mb-4 text-ink-faint" />
            <p className="text-[16px] font-bold text-ink mb-2">장바구니가 비어있어요</p>
            <p className="text-[13px] text-ink-soft mb-6">마음에 드는 상품을 담아보세요</p>
            <button
              onClick={() => navigate('/app/home')}
              className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3 focus:outline-none focus-visible:shadow-ring"
            >
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[1.6fr_1fr] gap-10 items-start">
            <div>
              {isVvip && (
                <div className="bg-signal-yellow/20 border-t border-x border-rule px-5 py-2.5">
                  <p className="text-[12.5px] font-bold text-ink">VVIP 회원 할인가로 표시했어요</p>
                </div>
              )}
              <div className="bg-paper px-5 py-3 flex items-center gap-3 border-y border-rule">
                <input
                  type="checkbox"
                  id="select-all-desktop"
                  checked={selectableCount > 0 && selected.size === selectableCount}
                  onChange={onToggleAll}
                  className="w-4 h-4 accent-ink"
                  aria-label="전체 선택"
                />
                <label htmlFor="select-all-desktop" className="text-[13px] text-ink cursor-pointer">
                  전체 선택 ({selected.size}/{selectableCount})
                </label>
              </div>

              <div className="pt-3 flex flex-col gap-3">
                {lines.map((line) => {
                  const price = linePrice(line)
                  const unavailable = isUnavailable(line)
                  const stock = lineStock(line)
                  return (
                    <div
                      key={line.id}
                      className={`bg-paper p-4 border ${
                        unavailable ? 'border-rule opacity-60' : selected.has(line.id) ? 'border-ink' : 'border-rule'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(line.id)}
                          onChange={() => onToggleSelect(line.id)}
                          disabled={unavailable}
                          className="w-4 h-4 accent-ink mt-1 flex-shrink-0 disabled:opacity-40"
                          aria-label={`${line.product.name} 선택`}
                        />
                        <div className="w-20 h-20 overflow-hidden bg-quiet flex-shrink-0 relative">
                          {line.product.thumbnail_url ? (
                            <img src={line.product.thumbnail_url} alt="" className="w-full h-full object-cover" />
                          ) : null}
                          {unavailable && (
                            <span className="absolute inset-0 bg-ink/70 text-paper text-[11px] font-bold flex items-center justify-center">품절</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <p className="text-[14px] font-bold text-ink leading-tight line-clamp-2">{line.product.name}</p>
                            <button
                              onClick={() => onRemove(line)}
                              className="text-ink-faint ml-2 flex-shrink-0 focus:outline-none focus-visible:shadow-ring"
                              aria-label={`${line.product.name} 삭제`}
                            >
                              <IconClose className="w-4 h-4" />
                            </button>
                          </div>
                          {line.optionLabel && (
                            <p className="text-[12px] text-ink-faint mt-0.5">옵션: {line.optionLabel}</p>
                          )}
                          {unavailable ? (
                            <p className="text-[12px] text-signal-red mt-2">현재 구매할 수 없는 상품이에요 (품절/판매중지)</p>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-2 rounded-control border border-rule">
                                  <button
                                    onClick={() => onUpdateQty(line, -1)}
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
                                    onClick={() => onUpdateQty(line, 1)}
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
            </div>

            <div className="sticky top-24 border border-rule p-6">
              <h2 className="text-[15px] font-bold text-ink mb-4">주문 요약</h2>
              <div className="space-y-2.5 text-[13px]">
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
                    {(FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString('ko-KR')}원 더 담으면 무료 배송
                  </p>
                )}
                <div className="flex justify-between pt-3 border-t border-rule mt-3">
                  <span className="text-[15px] font-bold text-ink">총 결제금액</span>
                  <span className="text-[20px] font-bold tabular-nums text-ink">{total.toLocaleString('ko-KR')}원</span>
                </div>
              </div>
              <button
                onClick={onOrder}
                disabled={selected.size === 0}
                className="w-full mt-5 rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:shadow-ring"
              >
                {selected.size > 0 ? `선택 상품 주문 (${total.toLocaleString('ko-KR')}원)` : '상품을 선택해주세요'}
              </button>
            </div>
          </div>
        )}

        {recommended.length > 0 && (
          <ProductRail
            id="cart-recommend-desktop"
            title="이 상품과 잘 어울려요"
            products={recommended}
            loading={recLoading}
            onProductClick={(id) => navigate(`/app/product/${id}`)}
          />
        )}
      </div>

      <DesktopFooter />
    </div>
  )
}
