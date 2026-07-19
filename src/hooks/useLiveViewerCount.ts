import { useEffect, useState } from 'react'
import { CF_STREAM_SUBDOMAIN } from '../lib/cloudflare'

// Cloudflare Stream 라이브 입력(stream_uid)의 실시간 시청자 수를 폴링한다.
// /views 엔드포인트도 /lifecycle 과 같은 공개 재생 도메인이라 토큰 없이 조회 가능.
// 방송 중이 아니거나 조회 실패 시 null (0명과 구분 — "모름"을 0으로 표시하지 않는다).
export function useLiveViewerCount(
  uid: string | null | undefined,
  enabled = true,
  intervalMs = 15000
): number | null {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (!uid || !enabled) {
      setCount(null)
      return
    }
    let active = true

    const check = async () => {
      try {
        const r = await fetch(
          `https://${CF_STREAM_SUBDOMAIN}.cloudflarestream.com/${uid}/views`
        )
        if (!r.ok) throw new Error(String(r.status))
        const j = (await r.json()) as { liveViewers?: number }
        if (!active) return
        setCount(typeof j.liveViewers === 'number' ? j.liveViewers : null)
      } catch {
        if (active) setCount(null)
      }
    }

    void check()
    const t = setInterval(check, intervalMs)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [uid, enabled, intervalMs])

  return count
}
