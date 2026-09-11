import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Live } from '../../lib/types'
import { formatDateTime } from '../../lib/format'
import { useStreamStatus } from '../../hooks/useStreamStatus'

// 로그인 없이 "링크 하나로 방송 송출" — 진행자가 카톡 등으로 받은 링크를 열면 바로
// 방송을 시작할 수 있다. 인증은 URL의 토큰(lives.host_token) 하나 — supabase/lives_host_token.sql.
//
// ⚠️ 송출 방식이 2가지인 이유 (2026-08-28):
// Cloudflare Stream의 자동 녹화(recording: automatic)는 RTMP/SRT 에서만 동작하고
// WHIP/WebRTC 송출은 녹화가 지원되지 않는다. 실제로 8/27 방송(2시간 48분, WebRTC)이
// 통째로 녹화되지 않아 다시보기·숏폼 소재가 남지 않았다.
// → 기본은 RTMPS(녹화됨, 앱 설치 필요), 급할 때만 브라우저 간편송출(녹화 안 됨).
type StreamInfo = {
  uid: string
  webRtcUrl: string | null
  rtmpsUrl: string | null
  streamKey: string | null
}

async function waitIceGatheringComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return
  await new Promise<void>((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', check)
    // WHIP 협상이 카메라 권한 지연 등으로 오래 걸리지 않도록 안전장치(3초 초과시 그냥 진행)
    setTimeout(resolve, 3000)
  })
}

export default function HostGoLive() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [live, setLive] = useState<Live | null>(null)

  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastErr, setBroadcastErr] = useState('')
  const [camReady, setCamReady] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [switchingCam, setSwitchingCam] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [simpleMode, setSimpleMode] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const markedRef = useRef(false)
  const [ending, setEnding] = useState(false)
  const [endMsg, setEndMsg] = useState<string | null>(null)

  // 방송 종료 — 상태를 ended 로 내리고 서버가 Cloudflare 녹화본을 찾아 다시보기로 연결한다.
  const endBroadcast = async () => {
    if (!token || ending) return
    setEnding(true)
    setEndMsg(null)
    try {
      const r = await fetch('/api/live-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken: token, markEnded: true }),
      })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; playbackUrl?: string | null; reason?: string }
      if (!r.ok || !j.ok) {
        setBroadcastErr(j.reason ?? '종료 처리에 실패했습니다.')
        return
      }
      setLive((prev) => (prev ? { ...prev, status: 'ended' } : prev))
      setEndMsg(j.playbackUrl ? '방송을 종료하고 다시보기를 저장했습니다.' : '방송을 종료했습니다. (녹화본은 잠시 후 연결됩니다)')
    } catch {
      setBroadcastErr('종료 처리 중 오류가 발생했습니다.')
    } finally {
      setEnding(false)
    }
  }

  const streamState = useStreamStatus(live?.stream_uid, live?.status !== 'ended', 5000)

  // RTMPS는 외부 앱(Larix·OBS)에서 송출하므로 우리 화면에 "방송 시작" 시점이 없다.
  // 송출이 실제로 들어온 게 감지되면 그때 상태를 live로 올려 시청 화면에 노출시킨다.
  useEffect(() => {
    if (streamState !== 'connected' || markedRef.current || !token) return
    markedRef.current = true
    if (live?.status === 'live') return
    void fetch('/api/live-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostToken: token, markLive: true }),
    })
      .then(() => setLive((prev) => (prev ? { ...prev, status: 'live' } : prev)))
      .catch(() => { markedRef.current = false })
  }, [streamState, token, live?.status])

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1500)
    } catch {
      setBroadcastErr('복사에 실패했습니다. 길게 눌러 직접 복사해 주세요.')
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!token) { setError('잘못된 링크입니다.'); setLoading(false); return }
      const { data, error: rpcErr } = await supabase.rpc('get_live_by_host_token', { p_token: token })
      if (!active) return
      if (rpcErr || !data) {
        setError(rpcErr?.message ?? '유효하지 않은 링크입니다.')
        setLoading(false)
        return
      }
      const lr = data as Live
      setLive(lr)
      if (lr.stream_uid) {
        const res = await fetch(`/api/live-input?hostToken=${encodeURIComponent(token)}`)
        const j = (await res.json().catch(() => ({}))) as Partial<StreamInfo> & { reason?: string }
        if (active && res.ok && j.uid) setStreamInfo(j as StreamInfo)
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [token])

  const createChannel = async () => {
    if (!token || provisioning) return
    setProvisioning(true)
    setBroadcastErr('')
    const res = await fetch('/api/live-input', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostToken: token }),
    })
    const j = (await res.json().catch(() => ({}))) as Partial<StreamInfo> & { reason?: string }
    setProvisioning(false)
    if (!res.ok || !j.uid) {
      setBroadcastErr(j.reason ?? '송출 채널 생성에 실패했습니다.')
      return
    }
    setStreamInfo(j as StreamInfo)
  }

  const openCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setBroadcastErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCamReady(true)
      return stream
    } catch {
      setBroadcastErr('카메라·마이크 권한을 허용해야 방송을 시작할 수 있습니다.')
      return null
    }
  }

  // 셀카(전면)/일반(후면) 카메라 전환. 방송 중이면 새 카메라의 영상·음성 트랙으로
  // RTCRtpSender.replaceTrack — 재협상 없이 시청자 쪽 끊김 없이 바로 바뀐다.
  const switchCamera = async () => {
    if (switchingCam) return
    setSwitchingCam(true)
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    const newStream = await openCamera(nextMode)
    if (newStream && pcRef.current) {
      const newVideoTrack = newStream.getVideoTracks()[0]
      const newAudioTrack = newStream.getAudioTracks()[0]
      const videoSender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video')
      const audioSender = pcRef.current.getSenders().find((s) => s.track?.kind === 'audio')
      if (newVideoTrack && videoSender) await videoSender.replaceTrack(newVideoTrack)
      if (newAudioTrack && audioSender) await audioSender.replaceTrack(newAudioTrack)
    }
    if (newStream) setFacingMode(nextMode)
    setSwitchingCam(false)
  }

  const startBroadcast = async () => {
    if (!token || !streamInfo?.webRtcUrl || !streamRef.current) return
    setBroadcastErr('')
    try {
      const pc = new RTCPeerConnection()
      pcRef.current = pc
      streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!))

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await waitIceGatheringComplete(pc)

      const res = await fetch(streamInfo.webRtcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription?.sdp ?? '',
      })
      if (!res.ok) throw new Error('송출 서버 연결에 실패했습니다.')
      const answerSdp = await res.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      // 실제 송출이 열렸으니 시청 화면에 노출되도록 상태 전환
      await fetch('/api/live-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostToken: token, markLive: true }),
      }).catch(() => {})
      setLive((prev) => (prev ? { ...prev, status: 'live' } : prev))

      setBroadcasting(true)
    } catch {
      setBroadcastErr('방송 시작에 실패했습니다. 다시 시도해 주세요.')
      pcRef.current?.close()
      pcRef.current = null
    }
  }

  const stopBroadcast = () => {
    pcRef.current?.close()
    pcRef.current = null
    setBroadcasting(false)
  }

  useEffect(() => {
    return () => {
      pcRef.current?.close()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f4]">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (error || !live) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f4] px-6">
        <div className="max-w-sm w-full bg-white rounded-[14px] border border-[#e5e0d8] p-8 text-center">
          <p className="text-[16px] font-semibold text-[#111] mb-2">링크를 열 수 없습니다</p>
          <p className="text-[13px] text-[#9a9080]">{error || '방송을 찾을 수 없습니다.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#faf8f4] px-4 py-8">
      <div className="max-w-sm mx-auto">
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-5 mb-4">
          <p className="text-[15px] font-bold text-[#111] mb-1">{live.title}</p>
          <p className="text-[12px] text-[#9a9080]">
            {live.scheduled_at ? formatDateTime(live.scheduled_at) : '시간 미정'}
          </p>
          <span
            className={`inline-block mt-2 text-[11px] font-bold px-2.5 py-1 rounded-full ${
              streamState === 'connected'
                ? 'bg-[#E8F6EC] text-[#1E7B3C]'
                : 'bg-[#F3F1EC] text-[#9a9080]'
            }`}
          >
            {streamState === 'connected' ? '● 방송 중' : '방송 대기'}
          </span>

          {/* RTMPS(앱 송출)는 우리 화면에 "종료" 시점이 없어서, 끝나도 계속 방송중으로 남고
              녹화본도 연결되지 않았다. 진행자가 이 버튼을 누르면 종료 처리 + 녹화본 자동 연결을 한다. */}
          {live.status === 'live' && !broadcasting && (
            <button
              type="button"
              onClick={endBroadcast}
              disabled={ending}
              className="w-full mt-3 text-[13px] font-semibold text-[#111] bg-[#F3F1EC] rounded-full py-2.5 disabled:opacity-60"
            >
              {ending ? '종료 처리 중…' : '방송 종료하고 다시보기 저장'}
            </button>
          )}
          {endMsg && <p className="text-[12px] text-[#1E7B3C] mt-2">{endMsg}</p>}
        </div>

        {!streamInfo ? (
          <button
            type="button"
            onClick={createChannel}
            disabled={provisioning}
            className="w-full text-[14px] font-semibold text-white bg-ink rounded-full py-3 disabled:opacity-60"
          >
            {provisioning ? '채널 준비 중…' : '방송 준비 시작'}
          </button>
        ) : (
          <>
            {/* ① RTMPS 송출 — 자동 녹화되는 방식(권장) */}
            <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-5 mb-4">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <p className="text-[14px] font-bold text-[#111]">송출 주소</p>
                <span className="text-[10px] font-bold text-white bg-[#1E7B3C] px-2 py-0.5 rounded-full">
                  권장 · 자동 저장됨
                </span>
              </div>
              <p className="text-[12px] text-[#5a5547] mb-4 leading-relaxed">
                이 주소로 송출하면 방송이 <b>자동으로 저장</b>되어 다시보기·홍보영상으로 쓸 수 있습니다.
              </p>

              <div className="bg-[#faf8f4] rounded-[10px] p-3.5 mb-4">
                <p className="text-[12px] font-bold text-[#111] mb-2">준비 (최초 1회만)</p>
                <p className="text-[11px] text-[#9a9080] mb-2">
                  RTMP 송출 앱이면 어느 것이든 동작합니다. <b>Prism Live Studio</b> 또는 <b>Larix Broadcaster</b>(둘 다 무료) 중 편한 걸로 설치하세요.
                </p>
                <ol className="text-[12px] text-[#5a5547] leading-[1.7] list-decimal pl-4 space-y-0.5">
                  <li>
                    <b>Prism Live Studio</b>: 방송 화면 하단 <b>RTMP(사용자 지정)</b> 또는 <b>더보기 → RTMP</b> 선택 →
                    아래 <b>서버 주소</b>와 <b>스트림 키</b>를 각각 붙여넣기
                  </li>
                  <li>
                    <b>Larix Broadcaster</b>: 오른쪽 아래 <b>톱니바퀴</b> → <b>Connections</b> → <b>New connection</b> →
                    아래 <b>전체 주소</b>를 복사해 <b>URL</b> 칸에 붙여넣기
                  </li>
                  <li>저장하고 메인 화면으로 나와 방송 시작 버튼을 누르면 송출 시작</li>
                </ol>
              </div>

              {streamInfo.rtmpsUrl && streamInfo.streamKey ? (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11.5px] font-bold text-[#111]">전체 주소 (휴대폰 앱용)</p>
                      <button
                        type="button"
                        onClick={() =>
                          void copy(
                            `${streamInfo.rtmpsUrl!.replace(/\/$/, '')}/${streamInfo.streamKey}`,
                            'full'
                          )
                        }
                        className="text-[11.5px] font-bold text-white bg-[#111] rounded-full px-3 py-1"
                      >
                        {copied === 'full' ? '복사됨' : '복사'}
                      </button>
                    </div>
                    <p className="text-[11px] text-[#5a5547] bg-[#f6f4f0] rounded-[8px] px-3 py-2.5 break-all leading-relaxed">
                      {`${streamInfo.rtmpsUrl.replace(/\/$/, '')}/${
                        showKey ? streamInfo.streamKey : '•'.repeat(16)
                      }`}
                    </p>
                  </div>

                  <details className="border-t border-[#f0ede8] pt-3">
                    <summary className="text-[11.5px] font-bold text-[#9a9080] cursor-pointer">
                      PC(OBS)로 방송할 때 — 서버·키 따로 보기
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11.5px] font-bold text-[#111]">서버 주소</p>
                          <button
                            type="button"
                            onClick={() => void copy(streamInfo.rtmpsUrl!, 'url')}
                            className="text-[11.5px] font-bold text-white bg-[#111] rounded-full px-3 py-1"
                          >
                            {copied === 'url' ? '복사됨' : '복사'}
                          </button>
                        </div>
                        <p className="text-[11px] text-[#5a5547] bg-[#f6f4f0] rounded-[8px] px-3 py-2.5 break-all">
                          {streamInfo.rtmpsUrl}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[11.5px] font-bold text-[#111]">스트림 키</p>
                          <button
                            type="button"
                            onClick={() => void copy(streamInfo.streamKey!, 'key')}
                            className="text-[11.5px] font-bold text-white bg-[#111] rounded-full px-3 py-1"
                          >
                            {copied === 'key' ? '복사됨' : '복사'}
                          </button>
                        </div>
                        <p className="text-[11px] text-[#5a5547] bg-[#f6f4f0] rounded-[8px] px-3 py-2.5 break-all">
                          {showKey ? streamInfo.streamKey : '•'.repeat(24)}
                        </p>
                      </div>
                    </div>
                  </details>

                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="text-[11.5px] font-bold text-[#9a9080] underline"
                  >
                    {showKey ? '키 가리기' : '키 보기'}
                  </button>

                  <p className="text-[11.5px] text-[#9a9080] leading-relaxed border-t border-[#f0ede8] pt-3">
                    ⚠️ 이 주소는 <b>방송 권한 그 자체</b>입니다. 외부에 공유하지 마세요.
                    <br />송출이 시작되면 위 상태가 <b>● 방송 중</b>으로 바뀌고 시청자에게 자동으로 열립니다.
                  </p>
                </div>
              ) : (
                <p className="text-[12px] text-[#FF4757]">
                  송출 주소를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.
                </p>
              )}
            </div>

            {/* ② 브라우저 간편 송출 — 녹화가 남지 않는 방식 */}
            {!simpleMode ? (
              <button
                type="button"
                onClick={() => setSimpleMode(true)}
                className="w-full text-[12.5px] font-semibold text-[#9a9080] bg-white border border-[#e5e0d8] rounded-full py-3"
              >
                앱 없이 이 화면에서 바로 방송하기 (영상 저장 안 됨)
              </button>
            ) : (
              <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-4">
                <div className="bg-[#FFF4E5] rounded-[10px] px-3 py-2.5 mb-4">
                  <p className="text-[11.5px] text-[#8a5a00] leading-relaxed">
                    이 방식은 <b>방송 영상이 저장되지 않습니다.</b> 다시보기·홍보영상이 필요하면 위의 송출 주소를 사용해 주세요.
                  </p>
                </div>

                <div className="relative w-full aspect-[9/16] max-h-[420px] bg-black rounded-[10px] overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                  />
                  {!camReady && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-[13px] text-white/70">카메라 미리보기</p>
                    </div>
                  )}
                  {camReady && (
                    <button
                      type="button"
                      onClick={switchCamera}
                      disabled={switchingCam}
                      className="absolute top-2 right-2 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-black/50 text-white disabled:opacity-60"
                    >
                      {switchingCam ? '전환 중…' : facingMode === 'user' ? '후면 카메라' : '셀카(전면) 카메라'}
                    </button>
                  )}
                </div>

                {!camReady ? (
                  <button
                    type="button"
                    onClick={() => openCamera()}
                    className="w-full text-[14px] font-semibold text-white bg-[#111] rounded-full py-3"
                  >
                    카메라 켜기
                  </button>
                ) : !broadcasting ? (
                  <button
                    type="button"
                    onClick={startBroadcast}
                    className="w-full text-[14px] font-semibold text-white bg-[#e94057] rounded-full py-3"
                  >
                    방송 시작
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopBroadcast}
                    className="w-full text-[14px] font-semibold text-[#111] bg-[#F3F1EC] rounded-full py-3"
                  >
                    방송 종료
                  </button>
                )}
              </div>
            )}

            {broadcastErr && <p className="text-[12px] text-[#FF4757] mt-3">{broadcastErr}</p>}
          </>
        )}

        <p className="text-[11px] text-[#9a9080] text-center mt-5 leading-relaxed">
          송출 주소 방식은 이 화면을 닫아도 방송이 유지됩니다.
          <br />간편 송출은 화면을 벗어나거나 새로고침하면 끊깁니다.
        </p>
      </div>
    </div>
  )
}
