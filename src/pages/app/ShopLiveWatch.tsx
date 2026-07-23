import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Live, LiveCoupon, Product } from '../../lib/types'
import { won } from '../../lib/format'
import { streamIframeSrc } from '../../lib/cloudflare'
import { useLiveChat } from '../../hooks/useLiveChat'
import { useStreamStatus } from '../../hooks/useStreamStatus'
import { useLiveHearts } from '../../hooks/useLiveHearts'
import { IconHeartFilled } from '@tabler/icons-react'
import { couponLabel, couponRemaining, couponSoldOut } from '../../lib/coupons'

const statusLabel: Record<Live['status'], string> = {
  live: 'LIVE',
  scheduled: '예정',
  ended: '종료',
}

// 유튜브 링크(브랜드 공식 영상 등)를 임베드 플레이어 주소로 변환 — 다시보기/예시 콘텐츠용
const youtubeEmbedSrc = (url: string | null | undefined): string | null => {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/)
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null
}

// 채팅용 이모지 — 표준 유니코드 문자만 사용(저작권 문제 없음, 카카오 캐릭터 이모티콘 아님)
const CHAT_EMOJIS = [
  '😍', '❤️', '👍', '🔥', '😂', '😮', '👏', '🎉',
  '💯', '🙌', '✨', '💄', '💅', '🛍️', '😊', '🥰',
  '😘', '👀', '🤩', '😭', '🙏', '💖', '🎁', '⭐',
]

const textShadow = { textShadow: '0 1px 5px rgba(0,0,0,.55)' }

export default function ShopLiveWatch() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [live, setLive] = useState<Live | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [liveCoupon, setLiveCoupon] = useState<LiveCoupon | null>(null)
  const [productSheetOpen, setProductSheetOpen] = useState(false)

  // 구매 폼 상태 — 수량만 고르고 정식 주문/결제 페이지(/app/order)로 넘긴다
  const [buyProduct, setBuyProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState<number>(1)

  // 실시간 채팅 (판매자 LiveDetail 과 동일 훅/채널 공유 → 양방향)
  const { messages, loading: chatLoading, isLoggedIn, sendMessage: sendChat } = useLiveChat(id)
  const [chatInput, setChatInput] = useState<string>('')

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return
    const ok = await sendChat(chatInput)
    if (ok) setChatInput('')
  }

  // 좋아요 하트 — 탭할 때마다 화면에 하트가 떠오르고, 다른 시청자 화면에도 실시간으로 같이 뜬다
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  const heartSeq = useRef(0)
  const spawnHeart = useCallback(() => {
    const heartId = heartSeq.current++
    const x = Math.round(Math.random() * 60 - 30) // -30~30px 랜덤 흔들림
    setHearts((prev) => [...prev, { id: heartId, x }])
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== heartId))
    }, 1800)
  }, [])
  const { sendHeart } = useLiveHearts(id, spawnHeart)
  const tapHeart = () => {
    spawnHeart()
    sendHeart()
  }

  // 채팅 — 이모지 삽입 + 닉네임 탭해서 멘션(@닉네임)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const insertEmoji = (emoji: string) => {
    setChatInput((prev) => prev + emoji)
    chatInputRef.current?.focus()
  }
  const mentionUser = (nickname: string) => {
    setChatInput(`@${nickname} `)
    setEmojiOpen(false)
    chatInputRef.current?.focus()
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

  // 라이브 한정 쿠폰 — 있으면 배너로 노출(실제 적용/차감은 주문 페이지에서)
  useEffect(() => {
    if (!id) return
    let active = true
    supabase
      .from('live_coupons')
      .select('*')
      .eq('live_id', id)
      .eq('active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setLiveCoupon(data as LiveCoupon | null)
      })
    return () => { active = false }
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
    setProductSheetOpen(false)
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
  const primaryProduct = orderedProducts[0] ?? null

  const streamSrc = streamIframeSrc(live?.stream_uid)
  // 실제 송출 연결 여부 — status='live'인데 송출이 끊겨 있으면 대기 화면을 보여주고,
  // 폴링으로 연결이 감지되면 자동으로 플레이어로 전환된다. 조회 실패(unknown)면 차단하지 않는다.
  const streamState = useStreamStatus(live?.stream_uid, live?.status === 'live')
  const waitingForStream = live?.status === 'live' && streamState === 'disconnected'
  const onAir = live?.status === 'live' && Boolean(live.stream_uid) && streamState !== 'disconnected'
  const topBadge = onAir ? 'LIVE' : live && live.status === 'live' ? '준비중' : live ? statusLabel[live.status] : ''

  const inputClass =
    'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

  const recentMessages = messages.slice(-4)

  return (
    <div className="fixed inset-0 z-0 bg-black flex justify-center">
      <div className="relative w-full h-full max-w-[480px] overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center text-white/70 text-[14px]">불러오는 중…</div>
        ) : !live ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-white/80 text-[14px] px-6 text-center">
            <p>라이브를 찾을 수 없습니다.</p>
            <Link to="/app/live" className="text-gold-light font-medium">라이브 목록으로</Link>
          </div>
        ) : (
          <>
            {/* 비디오 배경 (화면 전체) */}
            <div className="absolute inset-0 bg-[#14120e]">
              {waitingForStream ? (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={
                    live.thumbnail_url
                      ? { backgroundImage: `url(${live.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : undefined
                  }
                >
                  <div className="absolute inset-0 bg-black/45" />
                  <p className="relative text-white text-[15px] font-bold mb-1">방송 준비 중입니다</p>
                  <p className="relative text-white/80 text-[12px]">잠시 후 자동으로 시작됩니다</p>
                </div>
              ) : streamSrc ? (
                <iframe
                  src={streamSrc}
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 'none' }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  title="라이브 영상"
                />
              ) : youtubeEmbedSrc(live.stream_url) ? (
                <iframe
                  src={youtubeEmbedSrc(live.stream_url) as string}
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="다시보기 영상"
                />
              ) : live.stream_url ? (
                <video
                  controls
                  src={live.stream_url}
                  poster={live.thumbnail_url ?? undefined}
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                />
              ) : (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={
                    live.thumbnail_url
                      ? { backgroundImage: `url(${live.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : undefined
                  }
                >
                  {!live.thumbnail_url && <span className="text-[64px]">💄</span>}
                </div>
              )}
            </div>

            {/* 상단 스크림 + 헤더 */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-20" />
            <div
              className="absolute inset-x-0 z-30 flex items-center gap-2 px-4"
              style={{ top: 'max(14px, env(safe-area-inset-top))' }}
            >
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="뒤로"
                className="shrink-0 w-8 h-8 rounded-full bg-black/35 text-white flex items-center justify-center text-[17px]"
              >
                ‹
              </button>
              <p className="flex-1 min-w-0 text-white text-[13px] font-medium truncate" style={textShadow}>
                {live.title}
              </p>
              <span className="shrink-0 flex items-center gap-1.5 rounded-pill bg-black/40 text-white text-[11px] font-bold px-2.5 py-1">
                {onAir && <span className="w-1.5 h-1.5 rounded-full bg-[#ff5470] animate-pulse" />}
                {topBadge}
              </span>
            </div>

            {/* 떠오르는 좋아요 하트 */}
            {onAir && (
              <div className="absolute z-25 pointer-events-none" style={{ right: 30, bottom: 200 }}>
                {hearts.map((h) => (
                  <IconHeartFilled
                    key={h.id}
                    size={28}
                    className="absolute bottom-0 right-0 text-[#ff4d6d] animate-float-heart"
                    style={{ marginRight: h.x }}
                  />
                ))}
              </div>
            )}

            {/* 우측 아이콘 레일 */}
            <div className="absolute right-3 z-30 flex flex-col items-center gap-5" style={{ bottom: 152 }}>
              {onAir && (
                <button type="button" onClick={tapHeart} aria-label="좋아요" className="flex flex-col items-center active:scale-90 transition-transform">
                  <span className="w-11 h-11 rounded-full bg-black/38 backdrop-blur-sm flex items-center justify-center">
                    <IconHeartFilled size={21} className="text-[#ff4d6d]" />
                  </span>
                </button>
              )}
              {products.length > 0 && (
                <button type="button" onClick={() => setProductSheetOpen(true)} aria-label="판매 상품 보기" className="relative flex flex-col items-center">
                  <span className="w-11 h-11 rounded-full bg-black/38 backdrop-blur-sm flex items-center justify-center text-[18px]">
                    🛍️
                  </span>
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gold text-[9px] font-extrabold text-[#1a1508] flex items-center justify-center">
                    {products.length}
                  </span>
                </button>
              )}
            </div>

            {/* 하단 스크림 */}
            <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/70 via-black/35 to-transparent pointer-events-none z-20" />

            {/* 하단 스택: 쿠폰 배너 → 지금판매 칩 → 채팅 피드 → 입력줄 */}
            <div
              className="absolute inset-x-0 bottom-0 z-30 px-3 flex flex-col gap-2"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
            >
              {liveCoupon && !couponSoldOut(liveCoupon) && (
                <div className="mr-14 bg-black/45 backdrop-blur-sm border border-gold/40 rounded-lg px-3 py-2">
                  <p className="text-[11.5px] font-bold text-gold-light">
                    🎉 라이브 한정 쿠폰 · {couponLabel(liveCoupon)}
                    {couponRemaining(liveCoupon) !== null && ` · 선착순 ${couponRemaining(liveCoupon)}건`}
                  </p>
                </div>
              )}

              {primaryProduct && (
                <button
                  type="button"
                  onClick={() => openBuy(primaryProduct)}
                  className="mr-14 flex items-center gap-2.5 bg-black/55 backdrop-blur-sm border border-gold/30 rounded-2xl px-2.5 py-2 text-left"
                >
                  {primaryProduct.thumbnail_url ? (
                    <img src={primaryProduct.thumbnail_url} alt={primaryProduct.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center text-[16px] shrink-0">💄</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-[9.5px] font-extrabold text-gold-light mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-light" />
                      {primaryProduct.id === highlightId ? '지금 판매중' : '판매 상품'}
                    </p>
                    <p className="text-[12px] text-white font-semibold truncate" style={textShadow}>{primaryProduct.name}</p>
                  </div>
                  <p className="shrink-0 text-[12px] font-extrabold text-white" style={textShadow}>
                    {won(primaryProduct.sale_price ?? primaryProduct.price)}
                  </p>
                </button>
              )}

              {live.pinned_message && (
                <div className="mr-14 flex items-start gap-1.5 bg-black/45 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <span className="shrink-0 text-[11px]" aria-hidden="true">📌</span>
                  <p className="text-[11.5px] text-white leading-snug whitespace-pre-line" style={textShadow}>{live.pinned_message}</p>
                </div>
              )}

              <div className="mr-14 flex flex-col gap-1.5">
                {recentMessages.map((m) => (
                  <p key={m.id} className="text-[12.5px] text-white leading-snug" style={textShadow}>
                    <button
                      type="button"
                      onClick={() => mentionUser(m.nickname ?? '익명')}
                      className="font-bold text-gold-light mr-1"
                    >
                      {m.nickname ?? '익명'}
                    </button>
                    {m.message}
                  </p>
                ))}
              </div>

              <div className="relative flex items-center gap-2">
                {emojiOpen && (
                  <div className="absolute bottom-11 left-0 right-14 bg-[#1c1912]/95 backdrop-blur rounded-xl p-2 grid grid-cols-8 gap-0.5 border border-white/10">
                    {CHAT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertEmoji(emoji)}
                        className="text-[17px] py-1 rounded hover:bg-white/10"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                  disabled={!isLoggedIn}
                  aria-label="이모지"
                  className="shrink-0 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-[16px] disabled:opacity-40"
                >
                  🙂
                </button>
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onFocus={() => setEmojiOpen(false)}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendChatMessage() }}
                  disabled={!isLoggedIn}
                  placeholder={isLoggedIn ? '메시지를 입력하세요…' : '로그인 후 채팅 참여 가능'}
                  className="flex-1 min-w-0 h-9 rounded-pill bg-white/15 px-3.5 text-[12.5px] text-white placeholder:text-white/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={sendChatMessage}
                  disabled={!isLoggedIn}
                  aria-label="전송"
                  className="shrink-0 w-9 h-9 rounded-full bg-gold flex items-center justify-center text-[#1a1508] text-[14px] disabled:opacity-40"
                >
                  ➤
                </button>
              </div>
              {chatLoading ? null : !isLoggedIn && (
                <p className="text-[10.5px] text-white/60 text-center">로그인 후 채팅 참여 가능 (읽기는 누구나 가능)</p>
              )}
            </div>

            {/* 전체 판매 상품 시트 */}
            {productSheetOpen && (
              <div className="absolute inset-0 z-40 bg-black/50 flex items-end" onClick={() => setProductSheetOpen(false)}>
                <div
                  className="w-full max-h-[75%] bg-white rounded-t-2xl overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="sticky top-0 bg-white flex items-center justify-between px-4 py-3 border-b border-cream-2">
                    <h2 className="text-[15px] font-bold text-text">판매 상품</h2>
                    <button type="button" onClick={() => setProductSheetOpen(false)} aria-label="닫기" className="text-text-hint text-[18px] leading-none">✕</button>
                  </div>

                  {live.description && (
                    <p className="px-4 pt-3 text-[13px] text-text-sub leading-relaxed whitespace-pre-line">{live.description}</p>
                  )}

                  <div className="p-4 flex flex-col gap-3">
                    {orderedProducts.map((product) => {
                      const hasSale = product.sale_price != null && product.sale_price < product.price
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
                              <img src={product.thumbnail_url} alt={product.name} className="w-16 h-16 rounded-md object-cover shrink-0" />
                            ) : (
                              <div className="w-16 h-16 rounded-md bg-cream-3 flex items-center justify-center text-[24px] shrink-0">💄</div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] font-medium text-text line-clamp-1">{product.name}</p>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-[15px] font-bold text-text">{won(product.sale_price ?? product.price)}</span>
                                {hasSale && <span className="text-[12px] text-text-hint line-through">{won(product.price)}</span>}
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
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
    </div>
  )
}
