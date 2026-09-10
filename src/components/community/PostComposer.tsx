import { useEffect, useMemo, useRef, useState } from 'react'
import { probeVideo, shouldCompress, compressVideo, canCompressVideo } from '../../lib/video'

// 글쓰기 환경 — 하루 이야기·속 이야기가 같이 쓰는 글+사진+영상 입력. (2026-09-11)
// 대표님 지시: "이미지와 텍스트를 적을 수 있는 환경", "MP4 영상도 올릴 수 있으면"
//   · 글은 쓰는 만큼 칸이 늘어난다(스크롤 안 생김)
//   · 사진은 앨범에서 고르거나 바로 찍는다(모바일은 카메라가 뜬다) — 최대 4장, 미리보기·빼기
//   · 영상은 글당 1개 — 60초 안. 크거나 해상도가 높으면 올리기 전에 브라우저에서 줄인다(lib/video.ts).
//     원본은 100MB 까지 받고, 줄인 뒤에도 50MB 를 넘으면 안내만 하고 안 받는다
//   · 고쳐 쓰기: 이미 올린 사진·영상(existing*)을 보여주고 뺄 수 있다
//   · 쓰다 만 글은 임시저장된다(loadDraft/saveDraft) — 화면을 나갔다 와도 남아 있게
// 이 컴포넌트는 입력만 맡는다. 올리기 버튼·검증·업로드는 부르는 화면이 한다.

export const MAX_IMAGES = 4
export const MAX_VIDEO_MB = 50          // 줄인 뒤 최종 크기 상한
export const MAX_VIDEO_SOURCE_MB = 100  // 고르는 원본 상한(줄이기 전)
export const MAX_VIDEO_SEC = 60
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

interface Props {
  content: string
  onContentChange: (v: string) => void
  files: File[]
  onFilesChange: (files: File[]) => void
  video: File | null
  onVideoChange: (file: File | null) => void
  placeholder: string
  maxLen: number
  maxImages?: number
  autoFocus?: boolean
  onNotice?: (msg: string) => void
  // 고쳐 쓰기 — 이미 올라가 있는 것
  existingImages?: string[]
  onRemoveExistingImage?: (url: string) => void
  existingVideo?: string | null
  onRemoveExistingVideo?: () => void
}

export default function PostComposer({
  content, onContentChange, files, onFilesChange, video, onVideoChange,
  placeholder, maxLen, maxImages = MAX_IMAGES, autoFocus, onNotice,
  existingImages = [], onRemoveExistingImage, existingVideo = null, onRemoveExistingVideo,
}: Props) {
  const albumRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [checkingVideo, setCheckingVideo] = useState(false)
  const [compressPct, setCompressPct] = useState<number | null>(null)

  // 미리보기 URL — files 가 바뀔 때만 다시 만들고, 이전 것은 반드시 지운다(메모리)
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => { previews.forEach((u) => URL.revokeObjectURL(u)) }, [previews])
  const videoPreview = useMemo(() => (video ? URL.createObjectURL(video) : null), [video])
  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview) }, [videoPreview])

  // 쓰는 만큼 늘어나는 입력칸
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`
  }, [content])

  const imageSlots = maxImages - existingImages.length
  const full = files.length >= imageSlots
  const hasVideo = !!video || !!existingVideo

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    if (picked.length) onFilesChange([...files, ...picked].slice(0, Math.max(imageSlots, 0)))
    e.target.value = ''
  }

  const pickVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!VIDEO_TYPES.includes(f.type) && !/\.(mp4|webm|mov)$/i.test(f.name)) {
      onNotice?.('MP4·WebM·MOV 영상만 올릴 수 있어요'); return
    }
    if (f.size > MAX_VIDEO_SOURCE_MB * 1024 * 1024) {
      onNotice?.(`영상은 ${MAX_VIDEO_SOURCE_MB}MB 안으로 골라주세요`); return
    }
    // 길이·해상도 확인 — 브라우저가 메타데이터만 읽는다(전체를 올리지 않음)
    setCheckingVideo(true)
    const meta = await probeVideo(f)
    setCheckingVideo(false)
    if (!meta) { onNotice?.('영상을 읽지 못했어요. 다른 파일로 시도해 주세요'); return }
    if (meta.duration > MAX_VIDEO_SEC) { onNotice?.(`영상은 ${MAX_VIDEO_SEC}초 안으로 올려주세요`); return }

    // 크거나 해상도가 높으면 올리기 전에 줄인다 — 재생 시간만큼 걸리므로 진행률을 보여준다
    let out = f
    if (shouldCompress(f, meta) && canCompressVideo()) {
      setCompressPct(0)
      out = await compressVideo(f, (r) => setCompressPct(Math.round(r * 100)))
      setCompressPct(null)
    }
    if (out.size > MAX_VIDEO_MB * 1024 * 1024) {
      onNotice?.(`줄여도 ${MAX_VIDEO_MB}MB를 넘어요. 더 짧게 잘라서 올려주세요`); return
    }
    onVideoChange(out)
  }

  const remove = (idx: number) => onFilesChange(files.filter((_, i) => i !== idx))

  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rule text-[12.5px] text-ink-soft disabled:opacity-40 focus:outline-none focus-visible:shadow-ring'
  const totalImages = existingImages.length + previews.length

  return (
    <div className="rounded-card border border-rule bg-paper p-4">
      <textarea
        ref={textRef}
        value={content}
        onChange={(e) => onContentChange(e.target.value.slice(0, maxLen))}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={6}
        className="w-full resize-none text-[15px] leading-[1.8] text-ink placeholder:text-ink-faint focus:outline-none"
      />

      {totalImages > 0 && (
        <div className={`grid gap-1.5 mt-3 ${totalImages === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {existingImages.map((src) => (
            <div key={src} className={`relative bg-quiet rounded-lg overflow-hidden ${totalImages === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
              {onRemoveExistingImage && (
                <button type="button" onClick={() => onRemoveExistingImage(src)} aria-label="올려둔 사진 빼기"
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ink/80 text-paper text-[14px] leading-none focus:outline-none focus-visible:shadow-ring">×</button>
              )}
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={`${src}-${i}`} className={`relative bg-quiet rounded-lg overflow-hidden ${totalImages === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => remove(i)} aria-label={`${i + 1}번째 사진 빼기`}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ink/80 text-paper text-[14px] leading-none focus:outline-none focus-visible:shadow-ring">×</button>
            </div>
          ))}
        </div>
      )}

      {(videoPreview || existingVideo) && (
        <div className="relative mt-3 rounded-lg overflow-hidden bg-ink">
          <video src={videoPreview ?? existingVideo ?? undefined} controls playsInline preload="metadata" className="w-full max-h-[320px]" />
          <button
            type="button"
            onClick={() => (video ? onVideoChange(null) : onRemoveExistingVideo?.())}
            aria-label="영상 빼기"
            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ink/80 text-paper text-[14px] leading-none focus:outline-none focus-visible:shadow-ring"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-rule flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => albumRef.current?.click()} disabled={full} className={btn}>
            <span aria-hidden="true">🖼️</span> 앨범
          </button>
          <button type="button" onClick={() => cameraRef.current?.click()} disabled={full} className={btn}>
            <span aria-hidden="true">📷</span> 촬영
          </button>
          <button type="button" onClick={() => videoRef.current?.click()} disabled={hasVideo || checkingVideo || compressPct !== null} className={btn}>
            <span aria-hidden="true">🎬</span>
            {compressPct !== null ? `가볍게 줄이는 중 ${compressPct}%` : checkingVideo ? '확인 중…' : '영상'}
          </button>
          <span className="text-[11.5px] text-ink-faint tabular-nums">사진 {totalImages}/{maxImages}{hasVideo ? ' · 영상 1' : ''}</span>
        </div>
        <span className="text-[11.5px] text-ink-faint tabular-nums">{content.length}/{maxLen}</span>
      </div>
      <p className="text-[11px] text-ink-faint mt-2">영상은 1개, {MAX_VIDEO_SEC}초 안으로 짧게 — 큰 영상은 올리기 전에 자동으로 가볍게 줄여요</p>

      <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={pick} />
      {/* capture — 모바일에서는 카메라가 바로 뜨고, PC 에서는 그냥 파일 선택창이 뜬다 */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => void pickVideo(e)} />
    </div>
  )
}

// ── 임시저장 — 글자만(사진·영상은 브라우저에 남길 수 없다) ───────────────────
export function loadDraft<T extends object>(key: string): Partial<T> {
  try {
    const raw = localStorage.getItem(`bg_draft_${key}`)
    return raw ? (JSON.parse(raw) as Partial<T>) : {}
  } catch { return {} }
}

export function saveDraft(key: string, value: object) {
  try { localStorage.setItem(`bg_draft_${key}`, JSON.stringify(value)) } catch { /* 저장 못 해도 글쓰기는 된다 */ }
}

export function clearDraft(key: string) {
  try { localStorage.removeItem(`bg_draft_${key}`) } catch { /* 위와 같음 */ }
}
