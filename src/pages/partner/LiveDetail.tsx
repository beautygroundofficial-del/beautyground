import { useEffect, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconArrowLeft, IconVideo, IconSend, IconPin, IconShoppingBag } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { Live, Product } from '../../lib/types'

interface ChatMsg {
  id: number
  user: string
  text: string
}

const STATUS: Record<Live['status'], { label: string; bg: string; text: string }> = {
  scheduled: { label: '예정',  bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: 'LIVE', bg: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
  ended:     { label: '완료',  bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
}

export default function LiveDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState<Live | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [updating, setUpdating] = useState(false)

  // 채팅 상태 (로컬 플레이스홀더)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [pinnedMsg, setPinnedMsg] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 상품 패널 상태
  const [activeProduct, setActiveProduct] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!id) { setLoading(false); return }
      const { data } = await supabase.from('lives').select('*').eq('id', id).single()
      if (!active) return
      const row = (data as Live | null) ?? null
      setLive(row)
      if (row?.product_ids?.length) {
        const { data: pd } = await supabase.from('products').select('*').in('id', row.product_ids)
        if (!active) return
        setProducts((pd as Product[]) ?? [])
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const changeStatus = async (next: Live['status']) => {
    if (!id || updating) return
    setUpdating(true)
    const { error } = await supabase.from('lives').update({ status: next }).eq('id', id)
    if (!error) setLive(prev => prev ? { ...prev, status: next } : prev)
    setUpdating(false)
  }

  const sendMessage = () => {
    if (!chatInput.trim()) return
    setMessages(prev => [...prev, { id: Date.now(), user: '파트너', text: chatInput.trim() }])
    setChatInput('')
  }

  const pinMessage = () => {
    if (!chatInput.trim()) return
    setPinnedMsg(chatInput.trim())
    setChatInput('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (!live) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-3">라이브를 찾을 수 없습니다</p>
        <Link to="/partner/live" className="text-[13px] text-[#b8924a] font-medium hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const badge = STATUS[live.status]

  return (
    <>
      {/* 상단 브레드크럼 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Link to="/partner/live" className="flex items-center gap-1.5 text-[13px] text-[#9a9080] hover:text-[#111] transition-colors shrink-0">
          <IconArrowLeft size={15} />
          라이브 목록
        </Link>
        <span className="text-[#ccc]">·</span>
        <p className="text-[13px] text-[#111] font-medium truncate flex-1 min-w-0">{live.title}</p>
        <span className={`shrink-0 flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full ${badge.bg} ${badge.text}`}>
          {live.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-[#993556] animate-pulse" />}
          {badge.label}
        </span>
      </div>

      {/* 3컬럼 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[calc(100vh-160px)]">

        {/* 좌측: 카메라 프리뷰 */}
        <div className="bg-[#0e0c08] rounded-[14px] p-5 flex flex-col min-h-[360px] lg:min-h-0">
          {/* 카메라 영역 */}
          <div className="flex-1 bg-[#1a1814] rounded-xl flex flex-col items-center justify-center mb-4 relative">
            <IconVideo size={40} className="text-[#333] mb-2" />
            <p className="text-[12px] text-[#555]">카메라 프리뷰</p>

            {live.status === 'live' && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              </div>
            )}
            {live.status === 'scheduled' && (
              <div className="absolute top-3 left-3 bg-[#333] text-[#888] text-[11px] font-bold px-2.5 py-1 rounded">
                대기중
              </div>
            )}
            {live.status === 'ended' && (
              <div className="absolute top-3 left-3 bg-[#222] text-[#666] text-[11px] font-bold px-2.5 py-1 rounded">
                종료됨
              </div>
            )}
          </div>

          {/* 스트림 URL */}
          {live.stream_url && (
            <a
              href={live.stream_url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-[#b8924a] hover:underline mb-3 truncate"
            >
              {live.stream_url}
            </a>
          )}

          {/* 방송 컨트롤 버튼 */}
          {live.status === 'scheduled' && (
            <button
              onClick={() => changeStatus('live')}
              disabled={updating}
              className="w-full py-3 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-bold rounded-xl text-[14px] transition-colors"
            >
              {updating ? '처리 중...' : '방송 시작'}
            </button>
          )}
          {live.status === 'live' && (
            <button
              onClick={() => changeStatus('ended')}
              disabled={updating}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold rounded-xl text-[14px] transition-colors"
            >
              {updating ? '처리 중...' : '방송 종료'}
            </button>
          )}
          {live.status === 'ended' && (
            <div className="w-full py-3 bg-[#1a1814] text-[#555] font-bold rounded-xl text-[14px] text-center">
              방송이 종료되었습니다
            </div>
          )}
        </div>

        {/* 중앙: 채팅 */}
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="px-5 py-4 border-b border-[#eee] shrink-0">
            <h3 className="text-[13px] font-bold text-[#111]">실시간 채팅</h3>
            {pinnedMsg && (
              <div className="mt-2 flex items-center gap-2 bg-[#fdf8f0] rounded-lg px-3 py-2">
                <IconPin size={12} className="text-[#b8924a] shrink-0" />
                <p className="text-[12px] text-[#555] truncate">{pinnedMsg}</p>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-[#9a9080] text-[13px]">
                채팅 메시지가 없습니다.
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#b8924a] flex items-center justify-center text-[10px] text-white shrink-0 mt-0.5">
                    P
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9a9080] font-medium">{msg.user} </span>
                    <span className="text-[13px] text-[#333]">{msg.text}</span>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-[#eee] flex gap-2 shrink-0">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="공지 메시지 입력..."
              className="flex-1 border border-[#e5e0d8] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#b8924a]"
            />
            <button
              onClick={pinMessage}
              className="w-9 h-9 flex items-center justify-center bg-[#f7f4ef] text-[#b8924a] rounded-lg hover:bg-[#eee] transition-colors"
              title="공지 고정"
            >
              <IconPin size={16} />
            </button>
            <button
              onClick={sendMessage}
              className="w-9 h-9 flex items-center justify-center bg-[#b8924a] text-white rounded-lg hover:bg-[#a07c3b] transition-colors"
            >
              <IconSend size={16} />
            </button>
          </div>
        </div>

        {/* 우측: 상품 패널 */}
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] flex flex-col overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="px-5 py-4 border-b border-[#eee] shrink-0">
            <h3 className="text-[13px] font-bold text-[#111]">상품 패널 ({products.length})</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {products.length === 0 ? (
              <div className="text-center py-8 text-[#9a9080] text-[13px]">
                등록된 상품이 없습니다
              </div>
            ) : (
              products.map(product => {
                const isActive = activeProduct === product.id
                const displayPrice = product.sale_price ?? product.price
                return (
                  <div
                    key={product.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isActive ? 'border-[#b8924a] bg-[#fdf8f0]' : 'border-[#e5e0d8]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-[#f7f4ef] rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                        {product.thumbnail_url
                          ? <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
                          : <span className="text-[18px]">🛍️</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#111] truncate">{product.name}</p>
                        <p className="text-[12px] text-[#b8924a] font-bold">{displayPrice.toLocaleString()}원</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveProduct(isActive ? null : product.id)}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#b8924a] text-white'
                          : 'border border-[#b8924a] text-[#b8924a] hover:bg-[#fdf8f0]'
                      }`}
                    >
                      <IconShoppingBag size={14} />
                      {isActive ? '판매 중 (클릭하여 종료)' : '지금 판매'}
                    </button>
                    {isActive && (
                      <p className="text-[11px] text-center text-[#9a9080] mt-2">시청자 화면에 상품이 표시됩니다</p>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* 방송 종료 결과 패널 */}
          {live.status === 'ended' && (
            <div className="p-5 border-t border-[#eee] bg-[#f7f4ef] rounded-b-[14px] shrink-0">
              <h4 className="text-[12px] font-bold text-[#333] mb-3">방송 결과</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-[11px] text-[#9a9080]">총 시청자</p>
                  <p className="text-[16px] font-bold text-[#111]">—</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center">
                  <p className="text-[11px] text-[#9a9080]">총 판매액</p>
                  <p className="text-[14px] font-bold text-[#b8924a]">—</p>
                </div>
              </div>
              <p className="text-[11px] text-[#9a9080] text-center mt-2">방송 통계는 추후 지원 예정입니다.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
