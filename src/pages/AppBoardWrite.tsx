import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { BOARD_CATEGORIES, createBoardPost, type BoardCategory } from '../lib/board'
import { uploadCommunityImages } from '../lib/diaries'

// 속 이야기 쓰기 — 제목 없이 본문만. (2026-09-10)
// "뭐라고 제목을 붙이지" 하는 망설임 자체를 없앤다. 카테고리 하나만 고르고 바로 쓴다.
// 이름은 일기와 같이 가려서 보인다(ㅇ**ㅇ). 포인트는 올린 뒤에 조용히 알린다.

const MAX_IMAGES = 4
const MIN_LEN = 10
const MAX_LEN = 2000

export default function AppBoardWrite() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [myName, setMyName] = useState<string | null>(null)
  const [category, setCategory] = useState<BoardCategory | null>(null)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/app/login', { replace: true }); return }
      const meta = session.user.user_metadata as { name?: string } | undefined
      setMyName(meta?.name || session.user.email?.split('@')[0] || null)
    })
  }, [navigate])

  useEffect(() => () => { previews.forEach((u) => URL.revokeObjectURL(u)) }, [previews])

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (!picked.length) return
    const next = [...files, ...picked].slice(0, MAX_IMAGES)
    previews.forEach((u) => URL.revokeObjectURL(u))
    setFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx)
    previews.forEach((u) => URL.revokeObjectURL(u))
    setFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  const submit = async () => {
    if (!category) { showToast('어떤 이야기인지 하나만 골라주세요'); return }
    if (content.trim().length < MIN_LEN) { showToast(`${MIN_LEN}자 이상 적어주세요`); return }
    setSaving(true)
    const urls = files.length > 0 ? await uploadCommunityImages(files, 'board') : []
    if (files.length > 0 && urls.length === 0) {
      setSaving(false); showToast('사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요'); return
    }
    const res = await createBoardPost(category, content, urls, myName)
    setSaving(false)
    if (!res || !res.post_id) { showToast(res?.message || '올리지 못했어요'); return }
    navigate(`/app/board/${res.post_id}`, {
      replace: true,
      state: { toast: res.awarded > 0 ? `${res.awarded}P를 받았어요` : '이야기를 꺼내놓았어요' },
    })
  }

  const canSubmit = !!category && content.trim().length >= MIN_LEN && !saving

  return (
    <AppFrame>
      <BackHeader
        title="털어놓기"
        rightElement={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="px-3.5 py-1.5 rounded-control bg-ink text-paper text-[13px] font-semibold disabled:opacity-40"
          >
            {saving ? '올리는 중…' : '올리기'}
          </button>
        }
      />

      <section className="px-5 pt-5">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">어떤 이야기인가요</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">하나만 골라주세요</h2>
        <div className="flex flex-wrap gap-2">
          {BOARD_CATEGORIES.map((c) => {
            const on = category === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                aria-pressed={on}
                className={`px-3.5 py-2 rounded-full border text-[13px] transition focus:outline-none focus-visible:shadow-ring ${
                  on ? 'bg-ink text-paper border-ink font-semibold' : 'bg-paper text-ink-soft border-rule'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
        {category && (
          <p className="text-[12px] text-ink-faint mt-2">
            {BOARD_CATEGORIES.find((c) => c.key === category)?.hint}
          </p>
        )}
      </section>

      <section className="px-5 pt-7 pb-28">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">천천히, 하고 싶은 만큼만</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">무슨 일이 있었나요</h2>
        <div className="rounded-card border border-rule bg-paper p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_LEN))}
            rows={9}
            placeholder="여기엔 잘 쓰려고 애쓰지 않아도 돼요. 떠오르는 대로 적어주세요."
            className="w-full resize-none text-[14.5px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none"
          />

          {previews.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto">
              {previews.map((src, i) => (
                <div key={`${src}-${i}`} className="relative shrink-0">
                  <img src={src} alt="" className="w-20 h-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-paper text-[11px] leading-none"
                    aria-label="사진 빼기"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-rule">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={files.length >= MAX_IMAGES}
              className="text-[13px] text-ink-soft disabled:opacity-40"
            >
              사진 {files.length}/{MAX_IMAGES}
            </button>
            <span className="text-[11px] text-ink-faint tabular-nums">{content.length}/{MAX_LEN}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
        </div>
        <p className="text-[12px] text-ink-faint mt-3 leading-relaxed">
          이름은 가려서 보여요(예: 은*경). 남을 특정하거나 상처 주는 글은 운영자가 가릴 수 있어요.
        </p>
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {toast}
        </div>
      )}
    </AppFrame>
  )
}
