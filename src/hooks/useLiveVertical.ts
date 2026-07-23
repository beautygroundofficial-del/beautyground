import { useEffect, useState } from 'react'
import { CF_STREAM_SUBDOMAIN } from '../lib/cloudflare'

// 실시간 송출 영상이 세로(휴대폰 세로촬영)인지 판별한다.
// HLS 매니페스트(공개, CORS *)의 RESOLUTION=WxH 태그로 실제 인코딩 해상도를 확인.
// null = 아직 모름(연결 전 등) — 이땐 기존 16:9 박스를 기본값으로 쓴다.
export function useLiveVertical(
  uid: string | null | undefined,
  enabled = true,
  intervalMs = 10000
): boolean | null {
  const [vertical, setVertical] = useState<boolean | null>(null)

  useEffect(() => {
    if (!uid || !enabled) {
      setVertical(null)
      return
    }
    let active = true

    const check = async () => {
      try {
        const r = await fetch(
          `https://${CF_STREAM_SUBDOMAIN}.cloudflarestream.com/${uid}/manifest/video.m3u8`
        )
        const text = await r.text()
        const m = text.match(/RESOLUTION=(\d+)x(\d+)/)
        if (!active || !m) return
        const w = Number(m[1])
        const h = Number(m[2])
        setVertical(h > w)
      } catch {
        // 조회 실패 시 이전 값 유지(깜빡임 방지)
      }
    }

    void check()
    const t = setInterval(check, intervalMs)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [uid, enabled, intervalMs])

  return vertical
}
