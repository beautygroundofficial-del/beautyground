import { extractYoutubeId, youtubeThumbnailUrl } from '../../lib/youtube'

/** Read-only preview; opening and playback happen on the existing story page. */
export default function StoryMediaPreview({ content, images = [], videoUrl }: { content: string; images?: string[]; videoUrl?: string | null }) {
  const youtubeId = extractYoutubeId(content)
  const link = content.match(/https?:\/\/[^\s<>]+/)?.[0]
  let hostname = ''
  try { hostname = link ? new URL(link).hostname : '' } catch { /* Malformed pasted links stay in the story detail. */ }
  const image = youtubeId ? youtubeThumbnailUrl(youtubeId) : images[0]
  const video = !!youtubeId || !!videoUrl
  if (!image && !video && !hostname) return null
  return (
    <span style={{ borderRadius: 8 }} className="mt-3 block overflow-hidden border border-rule bg-quiet/40">
      {(image || video) && <span className="relative block aspect-video max-h-[200px] overflow-hidden bg-quiet">
        {image ? <img src={image} alt={video ? '영상 미리보기' : '이야기 대표 사진'} loading="lazy" className="h-full w-full object-cover" onError={event => { event.currentTarget.style.visibility = 'hidden' }} /> : <video src={videoUrl ?? undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
        {video && <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-ink/75 px-4 py-2 text-[13px] font-semibold text-white">▶ 영상 보기</span></span>}
      </span>}
      {hostname && <span className="block px-3 py-2 text-[12px] text-ink-soft break-all">{hostname} · {video ? '영상 링크' : '관련 링크'} ↗</span>}
    </span>
  )
}
