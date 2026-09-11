import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import PostComposer, { loadDraft, saveDraft, clearDraft } from '../components/community/PostComposer'
import { supabase } from '../lib/supabase'
import { createDiary, getMyDiary, updateDiary, uploadDiaryImages, uploadCommunityVideo } from '../lib/diaries'
import { getMyPets, petEmoji, type Pet } from '../lib/pets'

// 오늘 남기기 — 하루 이야기 쓰기·고쳐 쓰기 화면. (2026-09-11)
// 대표님 지시 "걷기를 통한 하루 일기 … 이미지와 텍스트", "삭제 옆에 수정도", "MP4 영상도".
// 글·사진(4장)·영상(1개)·오늘 걸음 수. ?id= 가 있으면 고쳐 쓰기 — 포인트는 다시 주지 않는다.
// 걸음 수는 지금은 직접 적는다(선택). 앱이 나오면 자동으로 채워진다. 포인트와는 무관하다.

const MIN_LEN = 5
const MAX_LEN = 1000
const DRAFT_KEY = 'diary'

interface Draft { content: string; steps: string; petIds?: string[] }

export default function AppDiaryWrite() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const editId = sp.get('id')

  const [myName, setMyName] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [steps, setSteps] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [existingVideo, setExistingVideo] = useState<string | null>(null)
  // 같이 걸은 친구 — 내 펫 목록에서 고른다. 사진이 있어야 붙는다(사진 올리기 장려, 2026-09-12)
  const [pets, setPets] = useState<Pet[]>([])
  const [petIds, setPetIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [ready, setReady] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/app/login', { replace: true, state: { from: '/app/diary/write' } }); return }
      const meta = session.user.user_metadata as { name?: string } | undefined
      setMyName(meta?.name || session.user.email?.split('@')[0] || null)
      setPets(await getMyPets())

      if (editId) {
        const row = await getMyDiary(editId)
        if (!row) { showToast('고칠 수 있는 글이 아니에요'); navigate('/app/diary', { replace: true }); return }
        setContent(row.content)
        setSteps(row.steps ? String(row.steps) : '')
        setExistingImages(row.images ?? [])
        setExistingVideo(row.video_url ?? null)
        setPetIds(row.pet_ids ?? [])
      } else {
        const d = loadDraft<Draft>(DRAFT_KEY)
        if (d.content) setContent(d.content)
        if (d.steps) setSteps(d.steps)
        if (d.petIds) setPetIds(d.petIds)
      }
      setReady(true)
    })()
  }, [navigate, editId])

  // 임시저장은 새 글일 때만 — 고쳐 쓰기 도중 내용이 새 글 초안으로 남으면 헷갈린다
  useEffect(() => { if (ready && !editId) saveDraft(DRAFT_KEY, { content, steps, petIds }) }, [ready, editId, content, steps, petIds])

  const hasPhoto = files.length > 0 || existingImages.length > 0
  const togglePet = (id: string) => setPetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const stepsNum = Number(steps.replace(/[^0-9]/g, '')) || 0

  const submit = async () => {
    if (content.trim().length < MIN_LEN) { showToast(`${MIN_LEN}자 이상 적어주세요`); return }
    setSaving(true)
    const newUrls = files.length > 0 ? await uploadDiaryImages(files) : []
    if (files.length > 0 && newUrls.length === 0) {
      setSaving(false); showToast('사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요'); return
    }
    let videoUrl: string | null = existingVideo
    if (video) {
      videoUrl = await uploadCommunityVideo(video, 'diaries')
      if (!videoUrl) { setSaving(false); showToast('영상 업로드에 실패했어요. 잠시 후 다시 시도해 주세요'); return }
    }
    const images = [...existingImages, ...newUrls]
    const petsToSave = images.length > 0 ? petIds : []

    if (editId) {
      const ok = await updateDiary(editId, { content: content.trim(), images, steps: stepsNum > 0 ? stepsNum : null, video_url: videoUrl, pet_ids: petsToSave })
      setSaving(false)
      if (!ok) { showToast('고치지 못했어요. 잠시 후 다시 시도해 주세요'); return }
      navigate('/app/diary', { replace: true, state: { toast: '고쳐 썼어요' } })
      return
    }

    const res = await createDiary(content, images, myName, stepsNum > 0 ? stepsNum : null, videoUrl, petsToSave)
    setSaving(false)
    if (!res || !res.diary_id) { showToast(res?.message || '올리지 못했어요'); return }
    clearDraft(DRAFT_KEY)
    navigate('/app/diary', {
      replace: true,
      state: { toast: res.awarded > 0 ? `${res.awarded}P를 받았어요` : '오늘을 남겼어요' },
    })
  }

  const canSubmit = ready && content.trim().length >= MIN_LEN && !saving

  return (
    <AppFrame>
      <BackHeader
        title={editId ? '고쳐 쓰기' : '오늘 남기기'}
        onBack={() => navigate('/app/diary')}
        rightElement={
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="px-3.5 py-1.5 rounded-control bg-ink text-paper text-[13px] font-semibold disabled:opacity-40"
          >
            {saving ? '올리는 중…' : editId ? '고치기' : '올리기'}
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
          video={video}
          onVideoChange={setVideo}
          existingImages={existingImages}
          onRemoveExistingImage={(url) => setExistingImages((prev) => prev.filter((u) => u !== url))}
          existingVideo={existingVideo}
          onRemoveExistingVideo={() => setExistingVideo(null)}
          maxLen={MAX_LEN}
          placeholder="오늘 있었던 일, 본 것, 먹은 것… 떠오르는 대로 적어주세요."
          autoFocus={!editId}
          onNotice={showToast}
        />
      </section>

      {/* 같이 걸은 친구 — 펫이 등록돼 있을 때만. 사진이 없으면 안내만(사진 올리기 장려) */}
      <section className="px-5 pt-6">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">함께한 친구</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">오늘 같이 걸은 친구 <span className="text-[12px] font-normal text-ink-faint">(선택)</span></h2>
        {pets.length === 0 ? (
          <button type="button" onClick={() => navigate('/app/pets')}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-4 py-4 text-left focus:outline-none focus-visible:shadow-ring">
            <p className="text-[13.5px] font-semibold text-ink">🐾 반려동물을 등록해 두면 여기서 고를 수 있어요</p>
            <p className="text-[12px] text-ink-faint mt-1">마이페이지 › 내 반려동물</p>
          </button>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {pets.map((p) => {
                const on = petIds.includes(p.id)
                return (
                  <button key={p.id} type="button" onClick={() => togglePet(p.id)} aria-pressed={on} disabled={!hasPhoto}
                    className={`inline-flex items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border text-[13px] transition disabled:opacity-40 focus:outline-none focus-visible:shadow-ring ${
                      on ? 'bg-ink text-paper border-ink font-semibold' : 'bg-paper text-ink-soft border-rule'}`}>
                    <span className="w-7 h-7 rounded-full bg-quiet overflow-hidden inline-flex items-center justify-center">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <span aria-hidden="true">{petEmoji(p.kind)}</span>}
                    </span>
                    {p.name}
                  </button>
                )
              })}
            </div>
            <p className="text-[12px] text-ink-faint mt-2 leading-relaxed">
              {hasPhoto ? '고르면 카드에 "🐾 이름과 걸음 수"로 표시돼요' : '사진을 올리면 같이 걸은 친구를 고를 수 있어요'}
            </p>
          </>
        )}
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
