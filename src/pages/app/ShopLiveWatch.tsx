import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Live, Product } from '../../lib/types'
import { won } from '../../lib/format'
import { streamIframeSrc } from '../../lib/cloudflare'
import { useLiveChat } from '../../hooks/useLiveChat'
import { useStreamStatus } from '../../hooks/useStreamStatus'
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

  // 구매 폼 상태 — 수량만 고르고 정식 주문/결제 페이지(/app/order)로 넘긴다
  const [buyProduct, setBuyProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState<number>(1)

  // 실시간 채팅 (판매자 LiveDetail 과 동일 훅/채널 공유 → 양방향)
  const { messages, loading: chatLoading, isLoggedIn, sendMessage: sendChat } = useLiveChat(id)
  const [chatInput, setChatInput] = useState<string>('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return
    const ok = await sendChat(chatInput)
    if (ok) setChatInput('')
  }

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

  // 판매자 조작(지금판매·공지핀·방송상태)을 실시간 수신 — lives 행 UPDATE 구독
  useEffect(() => {
    if (!id) return
    const ch = supabase
      .channel(`live-sync:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'lives', filter: `id=eq.${id}` },
        (payload) => {
          setLive((prev) => (prev ? { ...prev, ...(payload.new as Partial<Live>) } : prev))
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [id])

  const openBuy = (product: Product) => {
    setBuyProduct(product)
    setQuantity(1)
  }

  const closeBuy = () => {
    setBuyProduct(null)
  }

  // 정식 주문/결제 페이지로 이동 — 라이브 출처(live_id)를 태깅해서 넘긴다
  const goToOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!buyProduct || !live) return
    // 비로그인이면 로그인 페이지로 보내고, 로그인 후 이 라이브로 복귀 (상품상세와 동일 관례)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      navigate('/app/login', { state: { from: `/app/live/${live.id}` } })
      return
    }
    const qty = quantity < 1 ? 1 : quantity
    navigate('/app/order', {
      state: {
        items: [
          {
            product_id: buyProduct.id,
            name: buyProduct.name,
            price: buyProduct.sale_price ?? buyProduct.price,
            quantity: qty,
            thumbnail: buyProduct.thumbnail_url ?? null,
          },
        ],
        liveId: live.id,
      },
    })
  }

  // 판매자가 "지금 판매"로 지정한 상품을 목록 맨 위로
  const highlightId = live?.highlight_product_id ?? null
  const orderedProducts = highlightId
    ? [...products].sort((a, b) => (a.id === highlightId ? -1 : b.id === highlightId ? 1 : 0))
    : products

  const streamSrc = streamIframeSrc(live?.stream_uid)
  // 실제 송출 연결 여부 — status='live'인데 송출이 끊겨 있으면 대기 화면을 보여주고,
  // 폴링으로 연결이 감지되면 자동으로 플레이어로 전환된다. 조회 실패(unknown)면 차단하지 않는다.
  const streamState = useStreamStatus(live?.stream_uid, live?.status === 'live')
  const waitingForStream = live?.status === 'live' && streamState === 'disconnected'
  const onAir = live?.status === 'live' && Boolean(live.stream_uid) && streamState !== 'disconnected'

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
              {waitingForStream ? (
                <div
                  className="w-full aspect-video bg-cream-3 flex flex-col items-center justify-center relative"
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
                  <div className="absolute inset-0 bg-black/40" />
                  <p className="relative text-white text-[15px] font-bold mb-1">
                    방송 준비 중입니다
                  </p>
                  <p className="relative text-white/80 text-[12px]">
                    잠시 후 자동으로 시작됩니다
                  </p>
                  <span className="absolute top-3 left-3 inline-flex items-center rounded-pill bg-black/50 text-white text-[12px] font-bold px-3 py-1">
                    준비중
                  </span>
                </div>
              ) : streamSrc ? (
                <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={streamSrc}
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 'none' }}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                    allowFullScreen
                    title="라이브 영상"
                  />
                </div>
              ) : live.stream_url ? (
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
            <p className="text-[12px] text-text-hint mb-3">
              {live.status === 'live' && !onAir ? '방송 준비 중' : statusLabel[live.status]}
            </p>
            {live.description && (
              <p className="text-[14px] text-text-sub leading-relaxed mb-5 whitespace-pre-line">
                {live.description}
              </p>
            )}

            <h2 className="text-[15px] font-bold text-text mb-3">판매 상품</h2>

            {products.length === 0 ? (
              <div className="py-10 text-center text-[14px] text-text-hint">
                등록된 판매 상품이 없습니다.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {orderedProducts.map((product) => {
                  const hasSale =
                    product.sale_price != null &&
                    product.sale_price < product.price
                  const isHighlight = product.id === highlightId
                  return (
                    <div
                      key={product.id}
                      className={`bg-white rounded-md border p-3 ${isHighlight ? 'ring-2 ring-gold' : ''}`}
                      style={{ borderColor: isHighlight ? '#b8924a' : '#e5e0d8', borderWidth: '0.5px' }}
                    >
                      {isHighlight && (
                        <p className="flex items-center gap-1.5 text-[11px] font-bold text-gold mb-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                          지금 방송에서 판매 중
                        </p>
                      )}
                      <div className="flex items-center gap-3">
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
                    </div>
                  )
                })}
              </div>
            )}

            {/* 실시간 채팅 */}
            <div
              className="bg-white rounded-md border mt-6"
              style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
            >
              <div className="px-4 py-3 border-b border-cream-2">
                <h2 className="text-[15px] font-bold text-text">실시간 채팅</h2>
                {live.pinned_message && (
                  <div className="mt-2 flex items-start gap-2 bg-gold/10 rounded-md px-3 py-2">
                    <span className="shrink-0 text-[12px]" aria-hidden="true">📌</span>
                    <p className="text-[12.5px] text-text leading-snug whitespace-pre-line">
                      {live.pinned_message}
                    </p>
                  </div>
                )}
              </div>

              <div className="px-4 py-3 max-h-[280px] overflow-y-auto flex flex-col gap-2">
                {chatLoading ? (
                  <p className="text-center py-6 text-[13px] text-text-hint">채팅 불러오는 중…</p>
                ) : messages.length === 0 ? (
                  <p className="text-center py-6 text-[13px] text-text-hint">첫 메시지를 남겨보세요</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="flex gap-2 items-start">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-gold/15 text-gold text-[11px] font-bold flex items-center justify-center uppercase">
                        {(m.nickname ?? '익')[0]}
                      </span>
                      <p className="text-[13px] text-text leading-snug">
                        <span className="text-text-hint font-medium mr-1">{m.nickname ?? '익명'}</span>
                        {m.message}
                      </p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="px-4 py-3 border-t border-cream-2">
                {!isLoggedIn && (
                  <p className="text-[11px] text-text-hint text-center mb-2">
                    로그인 후 채팅 참여 가능합니다 (읽기는 누구나 가능)
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendChatMessage() }}
                    disabled={!isLoggedIn}
                    placeholder={isLoggedIn ? '메시지를 입력하세요…' : '로그인 후 채팅 참여 가능'}
                    className="flex-1 bg-white border border-cream-2 rounded-pill px-4 py-2 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition disabled:bg-cream-3 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={sendChatMessage}
                    disabled={!isLoggedIn}
                    className="shrink-0 rounded-pill bg-gold text-white hover:bg-gold-light disabled:opacity-50 disabled:cursor-not-allowed text-[13px] font-medium px-5 py-2 transition-colors"
                  >
                    전송
                  </button>
                </div>
              </div>
            </div>
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
            <form onSubmit={goToOrder}>
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

              <div className="flex items-center justify-between mt-4 mb-1">
                <span className="text-[13px] text-text-sub">결제 금액</span>
                <span className="text-[16px] font-bold text-text">
                  {won(
                    (buyProduct.sale_price ?? buyProduct.price) *
                      (quantity < 1 ? 1 : quantity)
                  )}
                </span>
              </div>

              <button
                type="submit"
                className="w-full mt-4 rounded-pill bg-gold text-white hover:bg-gold-light text-[14px] font-medium py-3 transition-colors"
              >
                주문하러 가기
              </button>

              <p className="text-[11px] text-text-hint mt-3 text-center leading-relaxed">
                배송지 입력과 결제는 주문 페이지에서 진행됩니다.
              </p>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
