import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Live, Product } from '../../lib/types'
import { won } from '../../lib/format'
import AppHeader from '../../components/layout/AppHeader'
import BottomNav from '../../components/layout/BottomNav'

const statusLabel: Record<Live['status'], string> = {
  live: 'LIVE',
  scheduled: '예정',
  ended: '종료',
}

export default function ShopLiveWatch() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [live, setLive] = useState<Live | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // 구매 폼 상태
  const [buyProduct, setBuyProduct] = useState<Product | null>(null)
  const [buyerName, setBuyerName] = useState<string>('')
  const [buyerPhone, setBuyerPhone] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string>('')
  const [success, setSuccess] = useState<boolean>(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }
      setLoading(true)
      const { data: liveData } = await supabase
        .from('lives')
        .select('*')
        .eq('id', id)
        .single()

      if (!active) return
      const liveRow = (liveData ?? null) as Live | null
      setLive(liveRow)

      if (liveRow && liveRow.product_ids && liveRow.product_ids.length > 0) {
        const { data: prodData } = await supabase
          .from('products')
          .select('*')
          .in('id', liveRow.product_ids)
        if (!active) return
        setProducts((prodData ?? []) as Product[])
      } else {
        setProducts([])
      }
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [id])

  const openBuy = (product: Product) => {
    setBuyProduct(product)
    setBuyerName('')
    setBuyerPhone('')
    setQuantity(1)
    setSubmitError('')
    setSuccess(false)
  }

  const closeBuy = () => {
    setBuyProduct(null)
    setSubmitError('')
    setSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!buyProduct || !live) return
    if (!buyerName.trim() || !buyerPhone.trim()) {
      setSubmitError('이름과 연락처를 입력해주세요.')
      return
    }
    const qty = quantity < 1 ? 1 : quantity
    const unit = buyProduct.sale_price ?? buyProduct.price
    const amount = unit * qty

    setSubmitting(true)
    setSubmitError('')
    const { error } = await supabase.from('orders').insert({
      partner_id: buyProduct.partner_id,
      product_id: buyProduct.id,
      live_id: live.id,
      buyer_name: buyerName.trim(),
      buyer_phone: buyerPhone.trim(),
      quantity: qty,
      amount,
      status: 'paid',
    })
    setSubmitting(false)

    if (error) {
      setSubmitError(`주문 접수에 실패했습니다: ${error.message}`)
      return
    }
    setSuccess(true)
  }

  const inputClass =
    'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

  return (
    <div className="min-h-screen bg-cream-4 pb-20">
      <AppHeader />

      <main className="px-4 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-[14px] text-text-sub mb-3 hover:text-text transition"
        >
          ← 뒤로
        </button>

        {loading ? (
          <div className="py-20 text-center text-[14px] text-text-hint">
            불러오는 중…
          </div>
        ) : !live ? (
          <div className="py-20 text-center">
            <p className="text-[14px] text-text-hint mb-3">
              라이브를 찾을 수 없습니다.
            </p>
            <Link to="/app/live" className="text-[14px] text-gold font-medium">
              라이브 목록으로
            </Link>
          </div>
        ) : (
          <>
            {/* 비디오 영역 */}
            <div className="rounded-md overflow-hidden mb-4">
              {live.stream_url ? (
                <video
                  controls
                  src={live.stream_url}
                  poster={live.thumbnail_url ?? undefined}
                  className="w-full bg-black aspect-video"
                />
              ) : (
                <div
                  className="w-full aspect-video bg-cream-3 flex items-center justify-center relative"
                  style={
                    live.thumbnail_url
                      ? {
                          backgroundImage: `url(${live.thumbnail_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : undefined
                  }
                >
                  {!live.thumbnail_url && (
                    <span className="text-[48px]">💄</span>
                  )}
                  <span className="absolute top-3 left-3 inline-flex items-center rounded-pill bg-black/50 text-white text-[12px] font-bold px-3 py-1">
                    {statusLabel[live.status]}
                  </span>
                </div>
              )}
            </div>

            <h1 className="text-[18px] font-bold text-text mb-1">
              {live.title}
            </h1>
            <p className="text-[12px] text-text-hint mb-5">
              {statusLabel[live.status]}
            </p>

            <h2 className="text-[15px] font-bold text-text mb-3">판매 상품</h2>

            {products.length === 0 ? (
              <div className="py-10 text-center text-[14px] text-text-hint">
                등록된 판매 상품이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {products.map((product) => {
                  const hasSale =
                    product.sale_price != null &&
                    product.sale_price < product.price
                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-md border p-3 flex items-center gap-3"
                      style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
                    >
                      {product.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.name}
                          className="w-16 h-16 rounded-md object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-md bg-cream-3 flex items-center justify-center text-[24px] shrink-0">
                          💄
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-text line-clamp-1">
                          {product.name}
                        </p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-[15px] font-bold text-text">
                            {won(product.sale_price ?? product.price)}
                          </span>
                          {hasSale && (
                            <span className="text-[12px] text-text-hint line-through">
                              {won(product.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openBuy(product)}
                        className="shrink-0 rounded-pill bg-gold text-white hover:bg-gold-light text-[13px] font-medium px-4 py-2 transition-colors"
                      >
                        구매하기
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-[11px] text-text-hint mt-5 leading-relaxed">
              실제 결제(PG) 연동은 추후 제공됩니다. 현재는 주문 접수까지
              진행됩니다.
            </p>
          </>
        )}
      </main>

      {/* 구매 모달 */}
      {buyProduct && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center"
          onClick={closeBuy}
        >
          <div
            className="w-full sm:max-w-[420px] bg-white rounded-t-md sm:rounded-md p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="text-center py-6">
                <div className="text-[40px] mb-3">✅</div>
                <p className="text-[16px] font-bold text-text mb-1">
                  구매가 접수되었습니다
                </p>
                <p className="text-[13px] text-text-hint mb-5">
                  주문 확인 후 안내드리겠습니다.
                </p>
                <button
                  type="button"
                  onClick={closeBuy}
                  className="w-full rounded-pill bg-gold text-white hover:bg-gold-light text-[14px] font-medium py-3 transition-colors"
                >
                  닫기
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-[16px] font-bold text-text">구매하기</h3>
                  <button
                    type="button"
                    onClick={closeBuy}
                    className="text-text-hint text-[18px] leading-none"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-[14px] font-medium text-text line-clamp-1">
                    {buyProduct.name}
                  </p>
                  <p className="text-[15px] font-bold text-gold mt-1">
                    {won(buyProduct.sale_price ?? buyProduct.price)}
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[13px] text-text-sub mb-1.5">
                      이름
                    </label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="구매자 이름"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-text-sub mb-1.5">
                      연락처
                    </label>
                    <input
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="010-0000-0000"
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] text-text-sub mb-1.5">
                      수량
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, Number(e.target.value) || 1))
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 mb-1">
                  <span className="text-[13px] text-text-sub">결제 금액</span>
                  <span className="text-[16px] font-bold text-text">
                    {won(
                      (buyProduct.sale_price ?? buyProduct.price) *
                        (quantity < 1 ? 1 : quantity)
                    )}
                  </span>
                </div>

                {submitError && (
                  <p className="text-[13px] text-[#FF4757] mt-2">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full mt-4 rounded-pill bg-gold text-white hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed text-[14px] font-medium py-3 transition-colors"
                >
                  {submitting ? '접수 중…' : '구매 접수'}
                </button>

                <p className="text-[11px] text-text-hint mt-3 text-center leading-relaxed">
                  실제 결제(PG) 연동은 추후 제공됩니다. 현재는 주문 접수까지
                  진행됩니다.
                </p>
              </form>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
