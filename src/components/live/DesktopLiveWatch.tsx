import { useRef, useState } from 'react'
import { won } from '../../lib/format'
import type { Live, LiveCoupon, Product } from '../../lib/types'
import type { ChatMessage } from '../../hooks/useLiveChat'
import { couponLabel, couponRemaining, couponSoldOut } from '../../lib/coupons'
import { IconHeart } from '../common/Icon'
import ReplayPlayer from './ReplayPlayer'

const CHAT_EMOJIS = [
  '😍', '❤️', '👍', '🔥', '😂', '😮', '👏', '🎉',
  '💯', '🙌', '✨', '💄', '💅', '🛍️', '😊', '🥰',
  '😘', '👀', '🤩', '😭', '🙏', '💖', '🎁', '⭐',
]

interface Props {
  live: Live
  hostName: string | null
  topBadge: string
  onAir: boolean
  waitingForStream: boolean
  streamSrc: string | null
  // 자동재생은 음소거로만 허용되므로, 소리를 켜지 않은 동안만 값이 들어온다(켜면 undefined)
  onSoundOn?: () => void
  // 송출이 끊겼다 재연결된 방송은 다시보기가 여러 조각으로 나뉜다 — 2개 이상일 때만 선택 UI 노출
  replayParts?: string[]
  replayPart?: number
  onReplayPartChange?: (i: number) => void
  youtubeEmbedSrc: string | null
  liveCoupon: LiveCoupon | null
  orderedProducts: Product[]
  highlightId: string | null
  onBuy: (p: Product) => void
  hearts: { id: number; x: number }[]
  onHeart: () => void
  messages: ChatMessage[]
  chatLoading: boolean
  isLoggedIn: boolean
  chatInput: string
  setChatInput: (v: string) => void
  sendChatMessage: () => void
  mentionUser: (nickname: string) => void
  onBack: () => void
  // 구매 모달
  buyProduct: Product | null
  quantity: number
  setQuantity: (n: number) => void
  closeBuy: () => void
  goToOrder: (e: React.FormEvent<HTMLFormElement>) => void
}

// PC 버전 라이브 시청 — 모바일은 영상 위에 채팅/구매를 겹쳐 쌓는 오버레이 UI지만,
// PC는 화면 폭이 넓어 겹칠 이유가 없다: [영상] : [상품+채팅 사이드바] 2단 고정.
// 사이드바만 내부 스크롤, 영상은 16:9 고정. 색은 「생방송 슬레이트」 규칙(ink/paper, 빨강=지금)을 따른다.
export default function DesktopLiveWatch({
  live,
  hostName,
  topBadge,
  onAir,
  waitingForStream,
  streamSrc,
  onSoundOn,
  replayParts,
  replayPart = 0,
  onReplayPartChange,
  youtubeEmbedSrc,
  liveCoupon,
  orderedProducts,
  highlightId,
  onBuy,
  hearts,
  onHeart,
  messages,
  chatLoading,
  isLoggedIn,
  chatInput,
  setChatInput,
  sendChatMessage,
  mentionUser,
  onBack,
  buyProduct,
  quantity,
  setQuantity,
  closeBuy,
  goToOrder,
}: Props) {
  const chatInputRef = useRef<HTMLInputElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)

  // 공유 — 모바일 시청화면에만 있고 PC에는 없었다(2026-09-02 추가).
  // 시청자가 방송 링크를 지인에게 퍼뜨릴 수 있어야 유입이 늘어난다. 모바일과 같은 4종을 제공.
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const shareUrl = () => window.location.href
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl())
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1600)
    } catch {
      /* 클립보드 차단 환경 — 조용히 무시 */
    }
    setShareOpen(false)
  }
  const shareToFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}`,
      '_blank',
      'noopener,width=600,height=500'
    )
    setShareOpen(false)
  }
  const shareToX = () => {
    window.open(
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl())}&text=${encodeURIComponent(live.title)}`,
      '_blank',
      'noopener,width=600,height=500'
    )
    setShareOpen(false)
  }
  const insertEmoji = (emoji: string) => {
    setChatInput(chatInput + emoji)
    chatInputRef.current?.focus()
  }

  return (
    <div className="bg-quiet min-h-screen">
      <div className="bg-paper border-b border-rule sticky top-0 z-50">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={onBack} className="text-[13px] font-bold text-ink-soft hover:text-ink">← 뒤로</button>
          <div className="flex-1 min-w-0 mx-6 text-center">
            <p className="text-[14px] font-bold text-ink truncate">{live.title}</p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {/* 공유 — 카카오톡은 링크 복사로 대체(모바일과 동일 방식) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShareOpen((v) => !v)}
                className="text-[12.5px] font-bold text-ink-soft hover:text-ink border border-rule rounded-control px-3 py-1.5"
              >
                공유
              </button>
              {shareCopied && (
                <span className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-control bg-ink text-paper text-[11px] px-2 py-1">
                  링크를 복사했습니다
                </span>
              )}
              {shareOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 bg-paper border border-rule rounded-control p-2 flex items-center gap-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => void copyShareLink()}
                      className="text-[12px] font-bold text-ink px-2.5 py-1.5 rounded-control"
                      style={{ backgroundColor: '#FEE500' }}
                    >
                      카카오톡
                    </button>
                    <button
                      type="button"
                      onClick={shareToFacebook}
                      className="text-[12px] font-bold text-white bg-[#1877F2] px-2.5 py-1.5 rounded-control"
                    >
                      페이스북
                    </button>
                    <button
                      type="button"
                      onClick={shareToX}
                      className="text-[12px] font-bold text-white bg-black px-2.5 py-1.5 rounded-control"
                    >
                      X
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyShareLink()}
                      className="text-[12px] font-bold text-ink bg-quiet px-2.5 py-1.5 rounded-control"
                    >
                      링크 복사
                    </button>
                  </div>
                </>
              )}
            </div>
            <span className="flex items-center gap-1.5 rounded-control bg-ink text-paper text-[11px] font-bold px-2.5 py-1 tracking-[0.04em]">
              {onAir && <span className="w-1.5 h-1.5 rounded-full bg-signal-red onair-dot" />}
              {topBadge}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-6 py-8 grid grid-cols-[1.4fr_1fr] gap-8 items-start">
        {/* 영상 */}
        <div className="min-w-0">
          {/* 라이브는 진행자가 휴대폰으로 세로 촬영한다(실측 720x1280 = 9:16).
              가로 16:9 틀에 넣으면 양옆에 검은 여백만 크게 생기므로 세로 비율로 맞추고,
              PC에서 너무 길어지지 않게 높이를 제한한 뒤 가운데 정렬한다. */}
          <div className="relative mx-auto aspect-[9/16] h-[calc(100vh-220px)] max-h-[720px] bg-[#14120e] border border-rule overflow-hidden">
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
                <p className="relative text-paper text-[16px] font-bold mb-1">방송 준비 중입니다</p>
                <p className="relative text-paper/80 text-[13px]">잠시 후 자동으로 시작됩니다</p>
              </div>
            ) : streamSrc && replayParts && replayParts.length > 0 ? (
              // 다시보기 — 되감기/빨리감기가 필요하므로 커스텀 재생바가 있는 플레이어 사용
              <>
                <ReplayPlayer src={streamSrc} title="다시보기 영상" />
                {replayParts.length > 1 && (
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                    {replayParts.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onReplayPartChange?.(i)}
                        className={`rounded-full text-[12.5px] font-semibold px-3.5 py-1.5 backdrop-blur-sm ${
                          i === replayPart ? 'bg-paper text-ink' : 'bg-black/60 text-paper'
                        }`}
                      >
                        {i + 1}부
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : streamSrc ? (
              // 실시간 방송 — 되감기 개념이 없으므로 Cloudflare 기본 iframe 그대로
              <>
                <iframe
                  src={streamSrc}
                  className="absolute inset-0 w-full h-full"
                  style={{ border: 'none' }}
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                  title="라이브 영상"
                />
                {onSoundOn && (
                  <button
                    type="button"
                    onClick={onSoundOn}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/70 text-paper text-[13px] font-semibold px-4 py-2 backdrop-blur-sm"
                  >
                    🔇 클릭해서 소리 켜기
                  </button>
                )}
              </>
            ) : youtubeEmbedSrc ? (
              <iframe
                src={youtubeEmbedSrc}
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
                {!live.thumbnail_url && (
                  <img src="/images/bg-logo-icon.png" alt="" className="w-16 h-16 object-contain opacity-90" />
                )}
              </div>
            )}

            {onAir && (
              <div className="absolute z-20 pointer-events-none" style={{ right: 20, bottom: 20 }}>
                {hearts.map((h) => (
                  <div key={h.id} className="absolute bottom-0 right-0" style={{ marginRight: h.x }}>
                    <IconHeart filled className="w-6 h-6 text-[#ff4d6d] animate-float-heart" />
                  </div>
                ))}
              </div>
            )}

            {live.pinned_message && (
              <div className="absolute left-4 bottom-4 max-w-[70%] flex items-start gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-2 z-10">
                <span className="shrink-0 text-[12px]" aria-hidden="true">📌</span>
                <p className="text-[13px] text-paper leading-snug whitespace-pre-line">{live.pinned_message}</p>
              </div>
            )}
          </div>

          {liveCoupon && !couponSoldOut(liveCoupon) && (
            <div className="mt-4 bg-paper border border-rule px-4 py-3">
              <p className="text-[13px] font-bold text-signal-red">
                🎉 라이브 한정 쿠폰 · {couponLabel(liveCoupon)}
                {couponRemaining(liveCoupon) !== null && ` · 선착순 ${couponRemaining(liveCoupon)}건`}
              </p>
            </div>
          )}

          {hostName && (
            <p className="mt-4 text-[13px] text-ink-soft">{hostName} 진행</p>
          )}
        </div>

        {/* 사이드바: 상품 + 채팅 */}
        <div className="sticky top-24 flex flex-col gap-5">
          {orderedProducts.length > 0 && (
            <div className="bg-paper border border-rule">
              <div className="px-4 py-3 border-b border-rule flex items-center justify-between">
                <h2 className="text-[14px] font-bold text-ink">판매 상품</h2>
                <span className="text-[12px] text-ink-faint tabular-nums">{orderedProducts.length}개</span>
              </div>
              <div className="max-h-[320px] overflow-y-auto divide-y divide-rule">
                {orderedProducts.map((product) => {
                  const sell = product.sale_price ?? product.price
                  const hasSale = product.sale_price != null && product.sale_price < product.price
                  const rate = hasSale ? Math.round((1 - (product.sale_price as number) / product.price) * 100) : 0
                  const isSelling = product.id === highlightId
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onBuy(product)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-quiet transition-colors focus:outline-none focus-visible:shadow-ring"
                    >
                      {product.thumbnail_url ? (
                        <img src={product.thumbnail_url} alt={product.name} className="w-14 h-14 object-cover shrink-0 border border-rule" />
                      ) : (
                        <img src="/images/bg-logo-mark.png" alt="" className="w-14 h-14 object-cover shrink-0 border border-rule" />
                      )}
                      <div className="min-w-0 flex-1">
                        {isSelling && (
                          <p className="flex items-center gap-1.5 text-[10.5px] font-bold text-signal-red mb-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-signal-red onair-dot" />
                            지금 판매중
                          </p>
                        )}
                        <p className="text-[13px] font-medium text-ink truncate">{product.name}</p>
                        <p className="mt-0.5 flex items-baseline gap-1.5">
                          {hasSale && <span className="text-[13px] font-bold text-signal-red tabular-nums">{rate}%</span>}
                          <span className="text-[14px] font-bold text-ink tabular-nums">{won(sell)}</span>
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-paper border border-rule flex flex-col">
            <div className="px-4 py-3 border-b border-rule">
              <h2 className="text-[14px] font-bold text-ink">채팅</h2>
            </div>
            <div className="h-[280px] overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {chatLoading ? (
                <p className="text-[12px] text-ink-faint text-center mt-8">불러오는 중…</p>
              ) : messages.length === 0 ? (
                <p className="text-[12px] text-ink-faint text-center mt-8">아직 채팅이 없습니다.</p>
              ) : (
                messages.map((m) => (
                  <p key={m.id} className="text-[13px] text-ink leading-snug">
                    <button
                      type="button"
                      onClick={() => mentionUser(m.nickname ?? '익명')}
                      className="font-bold text-ink-soft mr-1 hover:text-ink"
                    >
                      {m.nickname ?? '익명'}
                    </button>
                    {m.message}
                  </p>
                ))
              )}
            </div>

            <div className="relative border-t border-rule p-3 flex items-center gap-2">
              {emojiOpen && (
                <div className="absolute bottom-14 left-3 right-3 bg-paper border border-rule p-2 grid grid-cols-8 gap-0.5 z-10">
                  {CHAT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-[16px] py-1 hover:bg-quiet"
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
                className="shrink-0 w-9 h-9 rounded-control border border-rule flex items-center justify-center text-[15px] disabled:opacity-40"
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
                className="flex-1 min-w-0 h-9 border border-rule px-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring"
              />
              <button
                type="button"
                onClick={sendChatMessage}
                disabled={!isLoggedIn}
                aria-label="전송"
                className="shrink-0 w-9 h-9 rounded-control bg-ink text-paper flex items-center justify-center text-[14px] disabled:opacity-40"
              >
                ➤
              </button>
            </div>
            {!chatLoading && !isLoggedIn && (
              <p className="text-[11px] text-ink-faint text-center pb-3">로그인 후 채팅 참여 가능 (읽기는 누구나 가능)</p>
            )}
          </div>

          {onAir && (
            <button
              type="button"
              onClick={onHeart}
              className="flex items-center justify-center gap-2 border border-rule py-3 text-[13px] font-bold text-ink hover:border-ink transition-colors"
            >
              <IconHeart className="w-4 h-4 text-[#ff4d6d]" />
              좋아요 보내기
            </button>
          )}
        </div>
      </div>

      {/* 구매 모달 */}
      {buyProduct && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center" onClick={closeBuy}>
          <div className="w-full max-w-[420px] bg-paper border border-rule p-6" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={goToOrder}>
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-[16px] font-bold text-ink">구매하기</h3>
                <button type="button" onClick={closeBuy} className="text-ink-faint text-[18px] leading-none" aria-label="닫기">✕</button>
              </div>

              <div className="mb-4">
                <p className="text-[14px] font-medium text-ink line-clamp-1">{buyProduct.name}</p>
                <p className="text-[15px] font-bold text-ink mt-1 tabular-nums">
                  {won(buyProduct.sale_price ?? buyProduct.price)}
                </p>
              </div>

              <div>
                <label className="block text-[13px] text-ink-soft mb-1.5">수량</label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full border border-rule px-4 py-3 text-[14px] text-ink focus:outline-none focus-visible:shadow-ring"
                />
              </div>

              <div className="flex items-center justify-between mt-4 mb-1">
                <span className="text-[13px] text-ink-soft">결제 금액</span>
                <span className="text-[16px] font-bold text-ink tabular-nums">
                  {won((buyProduct.sale_price ?? buyProduct.price) * (quantity < 1 ? 1 : quantity))}
                </span>
              </div>

              <button
                type="submit"
                className="w-full mt-4 rounded-control bg-ink text-paper text-[14px] font-bold py-3.5"
              >
                주문하러 가기
              </button>

              <p className="text-[11px] text-ink-faint mt-3 text-center leading-relaxed">
                배송지 입력과 결제는 주문 페이지에서 진행됩니다.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
