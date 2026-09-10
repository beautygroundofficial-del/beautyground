import { useEffect, useMemo, useRef } from 'react'

// 글쓰기 환경 — 하루 이야기·속 이야기가 같이 쓰는 글+사진 입력. (2026-09-11)
// 대표님 지시: "이미지와 텍스트를 적을 수 있는 환경을 만들어줘야 해."
//   · 글은 쓰는 만큼 칸이 늘어난다(스크롤 안 생김)
//   · 사진은 앨범에서 고르거나 바로 찍는다(모바일은 카메라가 뜬다) — 최대 4장, 미리보기·빼기
//   · 쓰다 만 글은 임시저장된다(loadDraft/saveDraft) — 화면을 나갔다 와도 남아 있게
// 이 컴포넌트는 입력만 맡는다. 올리기 버튼·검증·업로드는 부르는 화면이 한다.

export const MAX_IMAGES = 4

interface Props {
  content: string
  onContentChange: (v: string) => void
  files: File[]
  onFilesChange: (files: File[]) => void
  placeholder: string
  maxLen: number
  maxImages?: number
  autoFocus?: boolean
}

export default function PostComposer({
  content, onContentChange, files, onFilesChange, placeholder, maxLen, maxImages = MAX_IMAGES, autoFocus,
}: Props) {
  const albumRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  // 미리보기 URL — files 가 바뀔 때만 다시 만들고, 이전 것은 반드시 지운다(메모리)
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => { previews.forEach((u) => URL.revokeObjectURL(u)) }, [previews])

  // 쓰는 만큼 늘어나는 입력칸
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`
  }, [content])

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    if (picked.length) onFilesChange([...files, ...picked].slice(0, maxImages))
    e.target.value = ''
  }

  const remove = (idx: number) => onFilesChange(files.filter((_, i) => i !== idx))

  const full = files.length >= maxImages

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

      {previews.length > 0 && (
        <div className={`grid gap-1.5 mt-3 ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {previews.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className={`relative bg-quiet rounded-lg overflow-hidden ${previews.length === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`${i + 1}번째 사진 빼기`}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ink/80 text-paper text-[14px] leading-none focus:outline-none focus-visible:shadow-ring"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-rule">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => albumRef.current?.click()}
            disabled={full}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rule text-[12.5px] text-ink-soft disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
          >
            <span aria-hidden="true">🖼️</span> 앨범
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={full}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rule text-[12.5px] text-ink-soft disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
          >
            <span aria-hidden="true">📷</span> 촬영
          </button>
          <span className="text-[11.5px] text-ink-faint tabular-nums">{files.length}/{maxImages}</span>
        </div>
        <span className="text-[11.5px] text-ink-faint tabular-nums">{content.length}/{maxLen}</span>
      </div>

      <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={pick} />
      {/* capture — 모바일에서는 카메라가 바로 뜨고, PC 에서는 그냥 파일 선택창이 뜬다 */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    </div>
  )
}

// ── 임시저장 — 글자만(사진은 브라우저에 남길 수 없다) ───────────────────────────
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
