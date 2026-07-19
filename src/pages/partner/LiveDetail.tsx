import { useEffect, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconArrowLeft, IconVideo, IconSend, IconPin, IconShoppingBag, IconEye } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { Live, Product } from '../../lib/types'
import { useLiveChat } from '../../hooks/useLiveChat'
import { streamIframeSrc } from '../../lib/cloudflare'
import { useStreamStatus } from '../../hooks/useStreamStatus'
import { useLiveViewerCount } from '../../hooks/useLiveViewerCount'

interface StreamInfo {
  uid: string
  rtmpsUrl: string | null
  streamKey: string | null
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

  // 실시간 채팅 (Supabase Realtime)
  const { messages, loading: chatLoading, isLoggedIn, sendMessage: sendChat } = useLiveChat(id)
  const [chatInput, setChatInput] = useState('')
  const [pinnedMsg, setPinnedMsg] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 상품 패널 상태 — lives 행에 저장되어 시청자 화면과 실시간 동기화됨
  const [activeProduct, setActiveProduct] = useState<string | null>(null)
  const [syncErr, setSyncErr] = useState('')

  // 하이라이트/공지핀을 lives 행에 기록 — 시청자(ShopLiveWatch)가 Realtime 으로 수신
  const syncLive = async (patch: { highlight_product_id?: string | null; pinned_message?: string | null }) => {
    if (!id) return false
    const { error } = await supabase.from('lives').update(patch).eq('id', id)
    if (error) {
      setSyncErr(`시청자 화면 반영 실패: ${error.message}`)
      return false
    }
    setSyncErr('')
    return true
  }

  const toggleHighlight = async (productId: string) => {
    const next = activeProduct === productId ? null : productId
    if (await syncLive({ highlight_product_id: next })) setActiveProduct(next)
  }

  // 송출 채널 (Cloudflare Live Input) — 키는 서버에서 매번 조회, DB에 저장 안 함
  const streamState = useStreamStatus(live?.stream_uid, true, 5000)
  const viewerCount = useLiveViewerCount(live?.stream_uid, live?.status === 'live')
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null)
  const [streamErr, setStreamErr] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState('')

  const callLiveInput = async (method: 'GET' | 'POST'): Promise<StreamInfo | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token || !id) { setStreamErr('로그인이 필요합니다.'); return null }
    try {
      const res = await fetch(method === 'GET' ? `/api/live-input?liveId=${id}` : '/api/live-input', {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ liveId: id }) : undefined,
      })
      const j = await res.json().catch(() => ({})) as Partial<StreamInfo> & { reason?: string }
      // uid 없는 응답(비JSON 200 포함)도 실패로 처리 — 빈 값('-')을 조용히 표시하지 않는다
      if (!res.ok || !j.uid) { setStreamErr(j.reason ?? '송출 정보 조회에 실패했습니다.'); return null }
      setStreamErr('')
      return j as StreamInfo
    } catch {
      setStreamErr('송출 정보 조회에 실패했습니다.')
      return null
    }
  }

  // 채널이 이미 있으면 송출 주소·키 자동 로드
  useEffect(() => {
    if (!live?.stream_uid) return
    let active = true
    callLiveInput('GET').then(info => { if (active && info) setStreamInfo(info) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.stream_uid])

  const createChannel = async () => {
    if (provisioning) return
    setProvisioning(true)
    const info = await callLiveInput('POST')
    if (info) {
      setStreamInfo(info)
      setLive(prev => (prev ? { ...prev, stream_uid: info.uid } : prev))
    }
    setProvisioning(false)
  }

  const copy = async (label: string, value: string | null) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch { /* 클립보드 미지원 브라우저 — 무시 */ }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!id) { setLoading(false); return }
      const { data } = await supabase.from('lives').select('*').eq('id', id).single()
      if (!active) return
      const row = (data as Live | null) ?? null
      setLive(row)
      setActiveProduct(row?.highlight_product_id ?? null)
      setPinnedMsg(row?.pinned_message ?? '')
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

  const sendMessage = async () => {
    if (!chatInput.trim()) return
    const ok = await sendChat(chatInput)
    if (ok) setChatInput('')
  }

  const pinMessage = async () => {
    const text = chatInput.trim()
    if (!text) return
    if (await syncLive({ pinned_message: text })) {
      setPinnedMsg(text)
      setChatInput('')
    }
  }

  const unpinMessage = async () => {
    if (await syncLive({ pinned_message: null })) setPinnedMsg('')
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
  const streamSrc = streamIframeSrc(live.stream_uid)

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
        {live.status === 'scheduled' && (
          <Link
            to={`/partner/live/${live.id}/edit`}
            className="shrink-0 text-[12px] text-[#9a9080] hover:text-[#b8924a] hover:underline"
          >
            수정
          </Link>
        )}
      </div>

      {live.description && (
        <p className="text-[13px] text-[#555] leading-relaxed mb-4 whitespace-pre-line">
          {live.description}
        </p>
      )}

      {/* 3컬럼 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[calc(100vh-160px)]">

        {/* 좌측: 카메라 프리뷰 */}
        <div className="bg-[#0e0c08] rounded-[14px] p-5 flex flex-col min-h-[360px] lg:min-h-0">
          {/* 카메라 영역 */}
          <div className="flex-1 bg-[#1a1814] rounded-xl flex flex-col items-center justify-center mb-4 relative overflow-hidden">
            {streamSrc ? (
              <iframe
                src={streamSrc}
                className="absolute inset-0 w-full h-full"
                style={{ border: 'none' }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                allowFullScreen
                title="라이브 미리보기"
              />
            ) : (
              <>
                <IconVideo size={40} className="text-[#333] mb-2" />
                <p className="text-[12px] text-[#555]">카메라 프리뷰</p>
              </>
            )}

            {live.status === 'live' && (
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              </div>
            )}
            {live.status === 'live' && (
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 text-white text-[11px] font-semibold px-2.5 py-1 rounded">
                <IconEye size={13} />
                {viewerCount !== null ? viewerCount.toLocaleString() : '—'}
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

          {/* 송출 채널 정보 — 폰(Larix 등)/OBS 에 입력하는 주소·키 */}
          <div className="bg-[#1a1814] rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold text-[#aaa]">송출 채널</p>
              {live.stream_uid && (
                <span className={`flex items-center gap-1.5 text-[11px] font-bold ${
                  streamState === 'connected' ? 'text-[#4ade80]' : 'text-[#f0b45c]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    streamState === 'connected' ? 'bg-[#4ade80]' : 'bg-[#f0b45c] animate-pulse'
                  }`} />
                  {streamState === 'connected' ? '송출 연결됨' : '송출 대기 중'}
                </span>
              )}
            </div>

            {!live.stream_uid ? (
              <>
                <p className="text-[11px] text-[#777] leading-relaxed mb-3">
                  방송 영상을 내보낼 채널이 아직 없습니다. 채널을 만들면 휴대폰
                  송출 앱(Larix Broadcaster 등)이나 OBS에 넣을 주소와 키가 발급됩니다.
                </p>
                <button
                  onClick={createChannel}
                  disabled={provisioning}
                  className="w-full py-2.5 bg-[#2a2620] hover:bg-[#353028] disabled:opacity-60 text-[#d8c9a8] font-semibold rounded-lg text-[12px] transition-colors"
                >
                  {provisioning ? '채널 만드는 중...' : '송출 채널 만들기'}
                </button>
              </>
            ) : streamInfo ? (
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] text-[#666] mb-1">서버 주소 (RTMPS URL)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] text-[#c9bfa8] bg-black/30 rounded px-2 py-1.5 truncate">
                      {streamInfo.rtmpsUrl ?? '-'}
                    </code>
                    <button
                      onClick={() => copy('url', streamInfo.rtmpsUrl)}
                      className="shrink-0 text-[11px] text-[#b8924a] hover:underline"
                    >
                      {copied === 'url' ? '복사됨✓' : '복사'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-[#666] mb-1">스트림 키 (외부 유출 금지)</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-[11px] text-[#c9bfa8] bg-black/30 rounded px-2 py-1.5 truncate">
                      {showKey ? (streamInfo.streamKey ?? '-') : '••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => setShowKey(v => !v)}
                      className="shrink-0 text-[11px] text-[#888] hover:underline"
                    >
                      {showKey ? '숨김' : '보기'}
                    </button>
                    <button
                      onClick={() => copy('key', streamInfo.streamKey)}
                      className="shrink-0 text-[11px] text-[#b8924a] hover:underline"
                    >
                      {copied === 'key' ? '복사됨✓' : '복사'}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-[#666] leading-relaxed pt-1">
                  휴대폰 송출 앱(Larix Broadcaster 등)이나 OBS에 위 주소와 키를 입력하고
                  송출을 시작하면 화면에 방송이 나옵니다.
                </p>
              </div>
            ) : !streamErr ? (
              <p className="text-[11px] text-[#777]">송출 정보 불러오는 중…</p>
            ) : null}

            {streamErr && (
              <p className="text-[11px] text-[#e08484] leading-relaxed mt-2">{streamErr}</p>
            )}
          </div>

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
                <p className="text-[12px] text-[#555] truncate flex-1">{pinnedMsg}</p>
                <button
                  onClick={unpinMessage}
                  className="shrink-0 text-[#9a9080] hover:text-[#111] text-[12px] leading-none"
                  title="공지 해제"
                  aria-label="공지 해제"
                >
                  ✕
                </button>
              </div>
            )}
            {syncErr && (
              <p className="mt-2 text-[11px] text-[#c0392b] leading-relaxed">{syncErr}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {chatLoading ? (
              <div className="text-center py-8 text-[#9a9080] text-[13px]">채팅 불러오는 중...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-[#9a9080] text-[13px]">첫 메시지를 남겨보세요</div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#b8924a] flex items-center justify-center text-[10px] text-white shrink-0 mt-0.5 uppercase">
                    {(msg.nickname ?? '익')[0]}
                  </div>
                  <div>
                    <span className="text-[11px] text-[#9a9080] font-medium">{msg.nickname ?? '익명'} </span>
                    <span className="text-[13px] text-[#333]">{msg.message}</span>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-[#eee] shrink-0">
            {!isLoggedIn && (
              <p className="text-[11px] text-[#9a9080] text-center mb-2">
                로그인 후 채팅 참여 가능합니다 (읽기는 누구나 가능)
              </p>
            )}
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                disabled={!isLoggedIn}
                placeholder={isLoggedIn ? '메시지를 입력하세요...' : '로그인 후 채팅 참여 가능'}
                className="flex-1 border border-[#e5e0d8] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#b8924a] disabled:bg-[#f7f4ef] disabled:cursor-not-allowed"
              />
              <button
                onClick={pinMessage}
                disabled={!isLoggedIn}
                className="w-9 h-9 flex items-center justify-center bg-[#f7f4ef] text-[#b8924a] rounded-lg hover:bg-[#eee] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="공지 고정"
              >
                <IconPin size={16} />
              </button>
              <button
                onClick={sendMessage}
                disabled={!isLoggedIn}
                className="w-9 h-9 flex items-center justify-center bg-[#b8924a] text-white rounded-lg hover:bg-[#a07c3b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <IconSend size={16} />
              </button>
            </div>
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
                      onClick={() => toggleHighlight(product.id)}
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
