import { useEffect, useState } from 'react'
import { CF_STREAM_SUBDOMAIN } from '../lib/cloudflare'

export type StreamState = 'connected' | 'disconnected' | 'unknown'

// Cloudflare Stream 라이브 입력(stream_uid)의 실제 송출 연결 상태를 폴링한다.
// lifecycle 엔드포인트는 공개(CORS *)라 토큰 없이 브라우저에서 직접 조회 가능.
// - connected    : 송출이 실제로 들어오고 있음 (또는 VOD 영상이라 항상 재생 가능)
// - disconnected : 채널은 있으나 송출이 끊겨 있음
// - unknown      : uid 없음 / 조회 실패 (차단 판단에 쓰지 말 것)
export function useStreamStatus(
  uid: string | null | undefined,
  enabled = true,
  intervalMs = 10000
): StreamState {
  const [state, setState] = useState<StreamState>('unknown')

  useEffect(() => {
    if (!uid || !enabled) {
      setState('unknown')
      return
    }
    let active = true

    const check = async () => {
      try {
        const r = await fetch(
          `https://${CF_STREAM_SUBDOMAIN}.cloudflarestream.com/${uid}/lifecycle`
        )
        const j = (await r.json()) as { isInput?: boolean; live?: boolean }
        if (!active) return
        // isInput=false 면 업로드된 일반 영상(VOD) — 항상 재생 가능으로 취급
        setState(j.live || j.isInput === false ? 'connected' : 'disconnected')
      } catch {
        if (active) setState('unknown')
      }
    }

    void check()
    const t = setInterval(check, intervalMs)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [uid, enabled, intervalMs])

  return state
}
