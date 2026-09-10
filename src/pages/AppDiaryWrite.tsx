import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import PostComposer, { loadDraft, saveDraft, clearDraft } from '../components/community/PostComposer'
import { supabase } from '../lib/supabase'
import { createDiary, uploadDiaryImages } from '../lib/diaries'

// 오늘 남기기 — 하루 이야기 쓰기 화면. (2026-09-11)
// 전엔 이야기 목록 위의 작은 입력칸이었다. 대표님 지시 "걷기를 통한 하루 일기 … 이미지와 텍스트를
// 적을 수 있는 환경"에 맞춰 화면 하나를 통째로 준다 — 글·사진·오늘 걸음 수.
// 걸음 수는 지금은 직접 적는다(선택). 앱이 나오면 자동으로 채워진다. 포인트와는 무관하다.

const MIN_LEN = 5
const MAX_LEN = 1000
const DRAFT_KEY = 'diary'

interface Draft { content: string; steps: string }

export default function AppDiaryWrite() {
  const navigate = useNavigate()
  const [myName, setMyName] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [steps, setSteps] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [ready, setReady] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/app/login', { replace: true, state: { from: '/app/diary/write' } }); return }
      const meta = session.user.user_metadata as { name?: string } | undefined
      setMyName(meta?.name || session.user.email?.split('@')[0] || null)
      const d = loadDraft<Draft>(DRAFT_KEY)
      if (d.content) setContent(d.content)
      if (d.steps) setSteps(d.steps)
      setReady(true)
    })
  }, [navigate])

  useEffect(() => { if (ready) saveDraft(DRAFT_KEY, { content, steps }) }, [ready, content, steps])

  const stepsNum = Number(steps.replace(/[^0-9]/g, '')) || 0

  const submit = async () => {
    if (content.trim().length < MIN_LEN) { showToast(`${MIN_LEN}자 이상 적어주세요`); return }
    setSaving(true)
    const urls = files.length > 0 ? await uploadDiaryImages(files) : []
    if (files.length > 0 && urls.length === 0) {
      setSaving(false); showToast('사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요'); return
    }
    const res = await createDiary(content, urls, myName, stepsNum > 0 ? stepsNum : null)
    setSaving(false)
    if (!res || !res.diary_id) { showToast(res?.message || '올리지 못했어요'); return }
    clearDraft(DRAFT_KEY)
    navigate('/app/diary', {
      replace: true,
      state: { toast: res.awarded > 0 ? `${res.awarded}P를 받았어요` : '오늘을 남겼어요' },
    })
  }

  const canSubmit = content.trim().length >= MIN_LEN && !saving

  return (
    <AppFrame>
      <BackHeader
        title="오늘 남기기"
        onBack={() => navigate('/app/diary')}
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
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">오늘 어떤 하루였나요</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">사소한 하루도 누군가에겐 위로가 됩니다</h2>
        <PostComposer
          content={content}
          onContentChange={setContent}
          files={files}
          onFilesChange={setFiles}
          maxLen={MAX_LEN}
          placeholder="오늘 있었던 일, 본 것, 먹은 것… 떠오르는 대로 적어주세요."
          autoFocus
        />
      </section>

      <section className="px-5 pt-6 pb-28">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">걸은 만큼</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">오늘 걸음 수 <span className="text-[12px] font-normal text-ink-faint">(선택)</span></h2>
        <div className="flex items-center gap-2 rounded-card border border-rule bg-paper px-4 py-3">
          <span aria-hidden="true" className="text-[18px]">🚶</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            value={steps}
            onChange={(e) => setSteps(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="예: 6200"
            className="flex-1 min-w-0 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none tabular-nums"
          />
          <span className="text-[13px] text-ink-soft">보</span>
        </div>
        <p className="text-[12px] text-ink-faint mt-2 leading-relaxed">
          지금은 직접 적어요. 앱이 나오면 휴대폰이 잰 걸음이 저절로 들어와요.
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
