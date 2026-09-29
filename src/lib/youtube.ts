// 게시글 본문에 붙여넣은 유튜브 링크를 감지해 임베드 재생으로 보여주기 위한 유틸.
// shorts/watch/youtu.be 세 형태만 지원 — 그 외(플레이리스트 등)는 그냥 텍스트로 남는다.
const YOUTUBE_ID_RE = /(?:youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/

export function extractYoutubeId(text: string | null | undefined): string | null {
  if (!text) return null
  const m = text.match(YOUTUBE_ID_RE)
  return m ? m[1] : null
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
