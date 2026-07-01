// Cloudflare Stream 설정 — 한 곳에서 관리
// 하위 도메인(공개 재생 도메인, 비밀 아님). 환경변수로 덮어쓸 수 있음.
export const CF_STREAM_SUBDOMAIN =
  (import.meta.env.VITE_CF_STREAM_SUBDOMAIN as string | undefined) ||
  'customer-musyiv3qecrzgpdk'

// stream_uid → Cloudflare Stream iframe 재생 주소 (없으면 null)
export function streamIframeSrc(uid: string | null | undefined): string | null {
  if (!uid) return null
  return `https://${CF_STREAM_SUBDOMAIN}.cloudflarestream.com/${uid}/iframe`
}
