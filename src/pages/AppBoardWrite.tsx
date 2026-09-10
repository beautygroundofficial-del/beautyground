import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import PostComposer, { loadDraft, saveDraft, clearDraft } from '../components/community/PostComposer'
import { supabase } from '../lib/supabase'
import { BOARD_CATEGORIES, createBoardPost, type BoardCategory } from '../lib/board'
import { uploadCommunityImages } from '../lib/diaries'

// 속 이야기 쓰기 — 제목 없이 본문만. (2026-09-10 → 2026-09-11 공용 글쓰기 환경(PostComposer)으로 교체)
// "뭐라고 제목을 붙이지" 하는 망설임 자체를 없앤다. 카테고리 하나만 고르고 바로 쓴다.
// 이름은 일기와 같이 가려서 보인다(ㅇ**ㅇ). 포인트는 올린 뒤에 조용히 알린다.

const MIN_LEN = 10
const MAX_LEN = 2000
const DRAFT_KEY = 'board'

interface Draft { content: string; category: BoardCategory | null }

export default function AppBoardWrite() {
  const navigate = useNavigate()
  const [myName, setMyName] = useState<string | null>(null)
  const [category, setCategory] = useState<BoardCategory | null>(null)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [ready, setReady] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/app/login', { replace: true, state: { from: '/app/board/write' } }); return }
      const meta = session.user.user_metadata as { name?: string } | undefined
      setMyName(meta?.name || session.user.email?.split('@')[0] || null)
      const d = loadDraft<Draft>(DRAFT_KEY)
      if (d.content) setContent(d.content)
      if (d.category && BOARD_CATEGORIES.some((c) => c.key === d.category)) setCategory(d.category)
      setReady(true)
    })
  }, [navigate])

  useEffect(() => { if (ready) saveDraft(DRAFT_KEY, { content, category }) }, [ready, content, category])

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
    clearDraft(DRAFT_KEY)
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
        onBack={() => navigate('/app/board')}
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
        <PostComposer
          content={content}
          onContentChange={setContent}
          files={files}
          onFilesChange={setFiles}
          maxLen={MAX_LEN}
          placeholder="여기엔 잘 쓰려고 애쓰지 않아도 돼요. 떠오르는 대로 적어주세요."
        />
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
