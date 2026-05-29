import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Badge from '../components/common/Badge'
import { ALL_LIVE_STREAMS, MOCK_CHAT } from '../constants'
import type { ChatMessage } from '../types'

export default function AppLiveDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const stream = ALL_LIVE_STREAMS.find(s => s.id === Number(id))

  const [showProducts, setShowProducts] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(stream?.likes ?? 0)
  const [chatMsg, setChatMsg] = useState('')
  const [chatList, setChatList] = useState<ChatMessage[]>(MOCK_CHAT)
  const [viewers, setViewers] = useState(stream?.viewers ?? 0)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatList])

  // 실시간 시청자 수 변화 시뮬레이션
  useEffect(() => {
    if (!stream?.isLive) return
    const t = setInterval(() => {
      setViewers(prev => prev + Math.floor(Math.random() * 10 - 3))
    }, 3000)
    return () => clearInterval(t)
  }, [stream?.isLive])

  if (!stream) {
    return (
      <div className="min-h-screen bg-dark flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-[16px]">방송을 찾을 수 없습니다.</p>
          <button onClick={() => navigate('/app/live')} className="text-gold mt-3 text-[14px]">
            라이브 목록으로 →
          </button>
        </div>
      </div>
    )
  }

  const handleSendChat = () => {
    if (!chatMsg.trim()) return
    const newMsg: ChatMessage = {
      id: chatList.length + 1,
      user: '나',
      message: chatMsg.trim(),
      userColor: '#b8924a',
    }
    setChatList(prev => [...prev, newMsg])
    setChatMsg('')
  }

  const handleLike = () => {
    setLiked(!liked)
    setLikeCount(prev => liked ? prev - 1 : prev + 1)
  }

  return (
    <div className="relative min-h-screen flex flex-col" style={{ backgroundColor: stream.bgColor }}>
      {/* 라이브 영역 */}
      <div className="relative flex-1 min-h-[50vh] max-h-[55vh] overflow-hidden">
        {/* 배경 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[120px] opacity-20" aria-hidden="true">💄</span>
        </div>

        {/* 그라디언트 */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 80%)' }}
          aria-hidden="true"
        />

        {/* 상단 헤더 */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-10 pb-3 z-20">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white"
            aria-label="뒤로 가기"
          >
            <span aria-hidden="true">←</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/30 rounded-pill px-3 py-1">
              <span className="w-2 h-2 bg-[#FF4757] rounded-full animate-pulse" aria-hidden="true" />
              <span className="text-white text-[12px] font-medium">LIVE</span>
              <span className="text-white/70 text-[11px]">{Math.max(0, viewers).toLocaleString()}명</span>
            </div>
            <button className="w-9 h-9 rounded-full bg-black/30 flex items-center justify-center text-white text-lg" aria-label="공유">
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>

        {/* BA 정보 */}
        <div className="absolute bottom-16 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
              style={{ backgroundColor: stream.avatarColor }}
              aria-hidden="true"
            >
              {stream.avatarInitial}
            </div>
            <div>
              <p className="text-white text-[13px] font-semibold leading-tight">{stream.hostName}</p>
              <p className="text-white/65 text-[11px]">{stream.deptName}</p>
            </div>
          </div>
          <button className="text-[12px] font-semibold text-gold border border-gold rounded-pill px-3 py-1 bg-black/20 hover:bg-gold/20 transition-colors">
            Follow
          </button>
        </div>

        {/* 하단 상품 미니 카드 */}
        <div className="absolute bottom-2 left-4 right-4 z-20">
          <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-md px-3 py-2.5 border border-white/15">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: `${stream.avatarColor}33` }}
                aria-hidden="true"
              >
                💄
              </div>
              <div>
                <p className="text-white/85 text-[11px] leading-tight truncate max-w-[160px]">{stream.productName}</p>
                <p className="text-gold text-[13px] font-bold">{stream.price.toLocaleString('ko-KR')}원</p>
              </div>
            </div>
            <button
              onClick={() => setShowProducts(true)}
              className="bg-gold text-white text-[11px] font-semibold rounded-pill px-3 py-1.5 flex-shrink-0 hover:bg-gold-light transition-colors"
            >
              상품 보기
            </button>
          </div>
        </div>
      </div>

      {/* 채팅 + 입력 영역 */}
      <div className="flex-1 flex flex-col bg-white">
        {/* 채팅 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ maxHeight: 'calc(100vh - 55vh - 112px)' }}>
          {chatList.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2">
              {msg.isSystem ? (
                <p className="text-text-hint text-[11px] w-full text-center py-1">{msg.message}</p>
              ) : (
                <>
                  <span
                    className="text-[12px] font-bold flex-shrink-0"
                    style={{ color: msg.userColor }}
                  >
                    {msg.isHost ? '👑 ' : ''}{msg.user}
                  </span>
                  <span className="text-[13px] text-text leading-relaxed">{msg.message}</span>
                </>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* 우측 반응 버튼 */}
        <div className="absolute right-4 bottom-20 flex flex-col items-center gap-3 z-10">
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1"
            aria-label={`좋아요 ${liked ? '취소' : ''}`}
          >
            <span className="text-2xl" aria-hidden="true">{liked ? '❤️' : '🤍'}</span>
            <span className="text-[10px] text-text-sub">{likeCount.toLocaleString()}</span>
          </button>
          <button className="flex flex-col items-center gap-1" aria-label="선물">
            <span className="text-2xl" aria-hidden="true">🎁</span>
            <span className="text-[10px] text-text-sub">선물</span>
          </button>
        </div>

        {/* 채팅 입력 */}
        <div className="px-4 py-3 border-t border-cream-2 flex items-center gap-2">
          <input
            type="text"
            value={chatMsg}
            onChange={e => setChatMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendChat()}
            placeholder="채팅 메시지를 입력하세요"
            className="flex-1 bg-cream-4 rounded-pill px-4 py-2.5 text-[13px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus"
            aria-label="채팅 메시지 입력"
          />
          <button
            onClick={handleSendChat}
            className="w-10 h-10 bg-gold rounded-full flex items-center justify-center text-white text-lg flex-shrink-0 hover:bg-gold-light transition-colors"
            aria-label="메시지 보내기"
          >
            <span aria-hidden="true">↑</span>
          </button>
        </div>
      </div>

      {/* 상품 패널 (슬라이드업) */}
      {showProducts && (
        <div className="fixed inset-0 z-50" aria-modal="true" role="dialog" aria-label="상품 목록">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowProducts(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[24px] max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-cream-2 flex-shrink-0">
              <h2 className="text-[16px] font-bold text-text">방송 상품</h2>
              <button
                onClick={() => setShowProducts(false)}
                className="w-8 h-8 flex items-center justify-center text-text-hint hover:text-text"
                aria-label="닫기"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 space-y-3">
              {stream.products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 rounded-md border border-cream-2"
                >
                  <div
                    className="w-14 h-14 rounded-md flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: product.thumbColor }}
                    aria-hidden="true"
                  >
                    {product.thumbIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-text-sub">{product.brand}</p>
                    <p className="text-[13px] font-semibold text-text truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[14px] font-bold text-gold">{product.price.toLocaleString('ko-KR')}원</span>
                      {product.originalPrice && (
                        <span className="text-text-hint text-[11px] line-through">{product.originalPrice.toLocaleString('ko-KR')}원</span>
                      )}
                    </div>
                  </div>
                  <button className="bg-gold text-white text-[11px] font-semibold rounded-pill px-3 py-1.5 flex-shrink-0 hover:bg-gold-light transition-colors">
                    구매
                  </button>
                </div>
              ))}
              {stream.products.length === 0 && (
                <p className="text-center py-8 text-text-hint text-[14px]">등록된 상품이 없습니다.</p>
              )}
            </div>
            <div className="p-4 border-t border-cream-2 flex-shrink-0">
              <Badge type="dept" label={stream.deptName} deptKey={stream.deptKey} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
