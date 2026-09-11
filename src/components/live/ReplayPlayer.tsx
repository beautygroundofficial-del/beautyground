import { useEffect, useRef, useState } from 'react'
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react'

// Cloudflare Stream 기본 iframe(raw <iframe src=".../iframe">)에 내장된 컨트롤은 모바일 사파리에서
// 재생바 자체가 안 뜨거나(2026-09-02 실제 아이폰에서 확인) 드래그가 안 먹는 문제가 있었다.
// → Cloudflare Stream Player SDK(postMessage 기반 원격제어)를 붙여서, 우리가 직접 그린 재생바로
// currentTime을 강제로 옮기는 방식으로 바꾼다. 라이브 방송(끝나지 않은 상태)엔 안 쓴다 — 되감기 개념이
// 없으므로 이 컴포넌트는 다시보기(ended) 전용.
declare global {
  interface Window {
    Stream?: (el: HTMLIFrameElement) => CfStreamPlayer
  }
}

interface CfStreamPlayer {
  currentTime: number
  duration: number
  paused: boolean
  muted: boolean
  play: () => Promise<void>
  pause: () => void
  addEventListener: (event: string, cb: () => void) => void
  removeEventListener: (event: string, cb: () => void) => void
}

let sdkPromise: Promise<void> | null = null
function loadStreamSdk(): Promise<void> {
  if (window.Stream) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://embed.cloudflarestream.com/embed/sdk.latest.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Cloudflare Stream SDK 로드 실패'))
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ReplayPlayer({ src, title = '다시보기 영상' }: { src: string; title?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const playerRef = useRef<CfStreamPlayer | null>(null)
  const draggingRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [paused, setPaused] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // iframe src에 controls=false 를 강제 — 우리가 그린 재생바만 노출되게(이중 컨트롤 방지)
  const iframeSrc = `${src}${src.includes('?') ? '&' : '?'}controls=false`

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setPaused(true)
    setCurrentTime(0)
    setDuration(0)
    loadStreamSdk()
      .then(() => {
        if (cancelled || !iframeRef.current) return
        const player = window.Stream!(iframeRef.current)
        playerRef.current = player
        const onLoadedMeta = () => setDuration(player.duration || 0)
        const onTimeUpdate = () => {
          if (!draggingRef.current) setCurrentTime(player.currentTime || 0)
        }
        const onPlay = () => setPaused(false)
        const onPause = () => setPaused(true)
        player.addEventListener('loadedmetadata', onLoadedMeta)
        player.addEventListener('timeupdate', onTimeUpdate)
        player.addEventListener('play', onPlay)
        player.addEventListener('pause', onPause)
        setReady(true)
        return () => {
          player.removeEventListener('loadedmetadata', onLoadedMeta)
          player.removeEventListener('timeupdate', onTimeUpdate)
          player.removeEventListener('play', onPlay)
          player.removeEventListener('pause', onPause)
        }
      })
      .catch((e) => console.error('[ReplayPlayer] SDK load failed', e))
    return () => {
      cancelled = true
    }
    // src(파트 전환) 바뀔 때마다 새 iframe이라 플레이어도 다시 붙인다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  const togglePlay = () => {
    const player = playerRef.current
    if (!player) return
    if (player.paused) void player.play()
    else player.pause()
  }

  const seekTo = (value: number) => {
    const player = playerRef.current
    if (!player) return
    player.currentTime = value
    setCurrentTime(value)
  }

  return (
    <div className="absolute inset-0 w-full h-full">
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="absolute inset-0 w-full h-full"
        style={{ border: 'none' }}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        title={title}
      />
      {/* 우리가 직접 그린 재생바 — Cloudflare 기본 컨트롤이 모바일 사파리에서 안 뜨거나 드래그가
          안 먹는 문제를 우회(2026-09-02). player.currentTime을 postMessage로 직접 옮긴다. */}
      <div
        className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 px-3 py-2.5 bg-gradient-to-t from-black/85 to-transparent"
        // 부모의 탭 이벤트(소리 켜기 등)로 전파되지 않도록
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={togglePlay}
          disabled={!ready}
          aria-label={paused ? '재생' : '일시정지'}
          className="shrink-0 w-8 h-8 rounded-full bg-white/15 text-white flex items-center justify-center disabled:opacity-40"
        >
          {paused ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
        </button>
        <span className="shrink-0 text-[11px] text-white/90 tabular-nums w-9 text-right">
          {fmtTime(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!ready || duration <= 0}
          onPointerDown={() => {
            draggingRef.current = true
          }}
          onChange={(e) => setCurrentTime(Number(e.target.value))}
          onPointerUp={(e) => {
            draggingRef.current = false
            seekTo(Number((e.target as HTMLInputElement).value))
          }}
          className="flex-1 min-w-0 h-1 accent-white disabled:opacity-40"
        />
        <span className="shrink-0 text-[11px] text-white/60 tabular-nums w-9">{fmtTime(duration)}</span>
      </div>
    </div>
  )
}
