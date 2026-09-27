import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import PostComposer, { loadDraft, saveDraft, clearDraft } from '../components/community/PostComposer'
import StoryCardPicker from '../components/community/StoryCardPicker'
import { supabase } from '../lib/supabase'
import { createDiary, getMyDiary, updateDiary, uploadDiaryImages, uploadCommunityVideo } from '../lib/diaries'
import { getMyPets, petEmoji, type Pet } from '../lib/pets'
import { useNicknameGate } from '../hooks/useNicknameGate'
import NicknameModal from '../components/community/NicknameModal'

// 오늘 남기기 — 하루 이야기 쓰기·고쳐 쓰기 화면. (2026-09-11)
// 대표님 지시 "걷기를 통한 하루 일기 … 이미지와 텍스트", "삭제 옆에 수정도", "MP4 영상도".
// 글·사진(4장)·영상(1개)·오늘 걸음 수. ?id= 가 있으면 고쳐 쓰기 — 포인트는 다시 주지 않는다.
// 걸음 수는 지금은 직접 적는다(선택). 앱이 나오면 자동으로 채워진다. 포인트와는 무관하다.
// 2026-09-13 대표님 지시 — "이야기는 계속 쌓여야 한다. 주제를 미리 만들어 놓거나, 자유 글은
// 키워드를 눌러서 쓰거나 그냥 수동으로 쓰게 하자." 빈 텍스트박스가 매번 백지라 글쓰기 진입장벽이
// 있었던 걸 낮추려고, 누르면 시작 문장이 채워지는 주제 칩을 텍스트박스 위에 둔다.
// 이미 쓰던 글이 있으면 덮어쓰지 않는다 — 어디까지나 "도와주는" 역할, 강제 아님.

const MIN_LEN = 5
const MAX_LEN = 1000

const TOPIC_STARTERS: { label: string; starter: string }[] = [
  { label: '오늘 산책', starter: '오늘은 여기를 걸었어요 — ' },
  { label: '우리 아이 자랑', starter: '우리 아이 자랑 좀 할게요 — ' },
  { label: '오늘 뭐 드셨어요', starter: '오늘 이런 걸 먹었어요 — ' },
  { label: '요즘 고민', starter: '요즘 이런 게 고민이에요 — ' },
  { label: '감사한 하루', starter: '오늘 이런 게 참 고마웠어요 — ' },
  { label: '동네 이야기', starter: '우리 동네에 이런 일이 있었어요 — ' },
]

interface Draft { content: string; steps: string; petIds?: string[] }

export default function AppDiaryWrite() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const editId = sp.get('id')
  const { modalOpen, ensureNickname, handleDone, closeModal } = useNicknameGate()

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
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [draftSaved, setDraftSaved] = useState(true)
  const submitting = useRef(false)
  const loadedScope = useRef<string | null>(null)
  const [mediaBusy, setMediaBusy] = useState(false)
  const draftKey = ownerId ? `diary:${ownerId}` : null
  const returnTo = location.pathname + location.search
  const [showCardPicker, setShowCardPicker] = useState(false)
  // "카드로 남기기" 최초 1회 안내 — 박채널(마케팅) 제안 B안, 2026-09-15
  const [showCardTip, setShowCardTip] = useState(() => {
    try { return !localStorage.getItem('bg_seen_card_tip') } catch { return false }
  })
  const dismissCardTip = () => {
    setShowCardTip(false)
    try { localStorage.setItem('bg_seen_card_tip', '1') } catch { /* 저장 안 돼도 무방 */ }
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    let active = true
    let loadedOwner: string | null = null
    let observedUserId: string | null | undefined
    loadedScope.current = null
    setReady(false); setLoadError('')
    setContent(''); setSteps(''); setPetIds([])
    setFiles([]); setVideo(null); setExistingImages([]); setExistingVideo(null)
    void (async () => {
      try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (observedUserId !== undefined && observedUserId !== (session?.user.id ?? null)) {
        navigate('/app/login', { replace: true, state: { from: returnTo } }); return
      }
      if (!session) { navigate('/app/login', { replace: true, state: { from: returnTo } }); return }
      loadedOwner = session.user.id
      setOwnerId(loadedOwner)

      if (editId) {
        const row = await getMyDiary(editId)
        if (!active) return
        if (!row) { showToast('고칠 수 있는 글이 아니에요'); navigate('/app/diary', { replace: true }); return }
        setContent(row.content)
        setSteps(row.steps ? String(row.steps) : '')
        setExistingImages(row.images ?? [])
        setExistingVideo(row.video_url ?? null)
        setPetIds(row.pet_ids ?? [])
      } else {
        const d = loadDraft<Draft>(`diary:${loadedOwner}`)
        setContent(typeof d.content === 'string' ? d.content.slice(0, MAX_LEN) : '')
        setSteps(typeof d.steps === 'string' ? d.steps.replace(/[^0-9]/g, '').slice(0, 6) : '')
        setPetIds(Array.isArray(d.petIds) ? d.petIds.filter(id => typeof id === 'string') : [])
      }
      loadedScope.current = `${loadedOwner}:${returnTo}`
      setReady(true)
      // 선택 정보 조회 때문에 본문 작성을 기다리게 하지 않는다.
      void getMyPets().then(rows => { if (active) setPets(rows) }).catch(() => {})
      } catch { if (active) setLoadError('작성 화면을 불러오지 못했어요. 다시 시도해 주세요.') }
    })()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      observedUserId = session?.user.id ?? null
      if (loadedOwner && session?.user.id !== loadedOwner) {
        active = false
        loadedScope.current = null
        setReady(false); setContent(''); setFiles([]); setVideo(null)
        navigate('/app/login', { replace: true, state: { from: returnTo } })
      }
    })
    return () => { active = false; loadedScope.current = null; subscription.unsubscribe() }
  }, [navigate, editId, returnTo, retry])

  // 임시저장은 새 글일 때만 — 고쳐 쓰기 도중 내용이 새 글 초안으로 남으면 헷갈린다
  useEffect(() => { if (ready && !editId && draftKey && loadedScope.current === `${ownerId}:${returnTo}`) setDraftSaved(saveDraft(draftKey, { content, steps, petIds })) }, [ready, editId, draftKey, ownerId, returnTo, content, steps, petIds])

  const hasPhoto = files.length > 0 || existingImages.length > 0
  const togglePet = (id: string) => setPetIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const stepsNum = Number(steps.replace(/[^0-9]/g, '')) || 0

  const doSubmit = async (nickname: string | null) => {
    if (!ready || !ownerId || submitting.current || mediaBusy || loadedScope.current !== `${ownerId}:${returnTo}`) return
    if (content.trim().length < MIN_LEN) { showToast(`${MIN_LEN}자 이상 적어주세요`); return }
    submitting.current = true
    setSaving(true)
    try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user.id !== ownerId) { showToast('다시 로그인한 뒤 글을 이어서 올려주세요.'); return }
    const newUrls = files.length > 0 ? await uploadDiaryImages(files) : []
    if (newUrls.length !== files.length) {
      showToast('사진을 모두 올리지 못했어요. 글은 유지돼요. 다시 시도해 주세요.'); return
    }
    let videoUrl: string | null = existingVideo
    if (video) {
      videoUrl = await uploadCommunityVideo(video, 'diaries')
      if (!videoUrl) { showToast('영상 업로드에 실패했어요. 잠시 후 다시 시도해 주세요'); return }
    }
    const images = [...existingImages, ...newUrls]
    const petsToSave = images.length > 0 ? petIds : []
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (currentSession?.user.id !== ownerId || loadedScope.current !== `${ownerId}:${returnTo}`) return

    if (editId) {
      const ok = await updateDiary(editId, { content: content.trim(), images, steps: stepsNum > 0 ? stepsNum : null, video_url: videoUrl, pet_ids: petsToSave })
      if (loadedScope.current !== `${ownerId}:${returnTo}`) return
      if (!ok) { showToast('고치지 못했어요. 잠시 후 다시 시도해 주세요'); return }
      navigate(`/app/diary?focus=${encodeURIComponent(editId)}`, { replace: true, state: { toast: '고쳐 썼어요' } })
      return
    }

    const res = await createDiary(content, images, nickname, stepsNum > 0 ? stepsNum : null, videoUrl, petsToSave)
    if (loadedScope.current !== `${ownerId}:${returnTo}`) return
    if (!res || !res.diary_id) { showToast(res?.message || '올리지 못했어요'); return }
    if (draftKey) clearDraft(draftKey)
    navigate(`/app/diary?focus=${encodeURIComponent(res.diary_id)}`, {
      replace: true,
      state: { toast: res.awarded > 0 ? `${res.awarded}P를 받았어요` : '오늘을 남겼어요' },
    })
    } catch { showToast('올리지 못했어요. 작성한 내용은 유지돼요. 다시 시도해 주세요.') }
    finally { submitting.current = false; setSaving(false) }
  }

  // 새 글 작성만 애칭이 필요하다 — 고쳐 쓰기는 닉네임을 새로 남기지 않으므로 그대로 진행
  const submit = () => {
    if (!ready || submitting.current) return
    if (content.trim().length < MIN_LEN) { showToast(`${MIN_LEN}자 이상 적어주세요`); return }
    if (editId) { void doSubmit(null); return }
    ensureNickname((nickname) => void doSubmit(nickname))
  }

  const canSubmit = ready && content.trim().length >= MIN_LEN && !saving && !mediaBusy

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
            className="min-h-11 px-4 py-2 rounded-control bg-ink text-paper text-[14px] font-semibold disabled:opacity-40 focus-visible:shadow-ring"
          >
            {saving ? '올리는 중…' : editId ? '고치기' : '올리기'}
          </button>
        }
      />

      {loadError && <div role="alert" className="px-5 pt-4 text-[14px] text-ink">{loadError}<button type="button" onClick={() => setRetry(n => n + 1)} className="min-h-11 px-3 font-bold underline">다시 시도</button></div>}
      <fieldset disabled={!ready || saving} className="min-w-0 border-0 p-0 m-0">
      <section className="px-5 pt-5">
        <p className="text-[13px] text-ink-soft leading-relaxed mb-1.5">오늘 어떤 하루였나요</p>
        <h2 className="text-[18px] font-bold text-ink leading-snug mb-3">편한 말로 들려주세요</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">공개 이야기 · 누구나 글과 댓글을 읽을 수 있어요.</p>

        {!editId && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-3 mb-1">
            {TOPIC_STARTERS.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => { if (!content.trim()) setContent(t.starter) }}
                className="min-h-11 shrink-0 px-3 py-2 rounded-full border border-solid border-rule text-[13px] text-ink-soft whitespace-nowrap focus:outline-none focus-visible:shadow-ring"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <PostComposer
          content={content}
          onContentChange={setContent}
          files={files}
          onFilesChange={setFiles}
          video={video}
          onVideoChange={(file) => { if (loadedScope.current === `${ownerId}:${returnTo}`) setVideo(file) }}
          existingImages={existingImages}
          onRemoveExistingImage={(url) => setExistingImages((prev) => prev.filter((u) => u !== url))}
          existingVideo={existingVideo}
          onRemoveExistingVideo={() => setExistingVideo(null)}
          maxLen={MAX_LEN}
          placeholder="오늘 있었던 일, 본 것, 먹은 것… 떠오르는 대로 적어주세요."
          disabled={!ready || saving}
          onNotice={showToast}
          onBusyChange={setMediaBusy}
        />
        {!editId && <p role="status" className="mt-3 text-[12px] leading-relaxed text-ink-soft">{draftSaved ? '글은 이 브라우저에 임시저장돼요. 사진·영상은 다시 선택해 주세요.' : '임시저장을 못 했어요. 화면을 나가기 전에 글을 복사해 주세요.'}</p>}

      <details className="mt-5 rounded-card bg-quiet p-4">
        <summary className="min-h-11 cursor-pointer text-[14px] font-semibold text-ink leading-relaxed">사진 카드·산책 기록 더하기 <span className="font-normal text-ink-soft">(선택)</span></summary>
        {!showCardPicker ? (
          <div className="mt-3 relative inline-block">
            {showCardTip && (
              <div className="absolute bottom-full left-0 mb-2 w-56 rounded-lg bg-ink text-paper text-[11.5px] leading-relaxed px-3 py-2 shadow-lg">
                사진 대신 그림 한 장 골라서, 짧은 마음을 적어보세요
                <button
                  type="button"
                  onClick={() => dismissCardTip()}
                  aria-label="안내 닫기"
                  className="absolute -top-1.5 -right-1.5 w-11 h-11 rounded-full bg-paper text-ink text-[16px] leading-none flex items-center justify-center focus:outline-none focus-visible:shadow-ring"
                >×</button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setShowCardPicker(true); dismissCardTip() }}
              className="inline-flex min-h-11 flex-wrap items-center gap-1.5 px-3 py-2 rounded-full border border-solid border-rule text-[13px] text-ink-soft focus:outline-none focus-visible:shadow-ring"
            >
              <span aria-hidden="true">🗂️</span> 카드로 남기기 <span className="text-ink-faint">— 사진 없어도 괜찮아요</span>
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <StoryCardPicker
              onCancel={() => setShowCardPicker(false)}
              onGenerate={(file) => { setFiles((prev) => [...prev, file].slice(0, 4)); setShowCardPicker(false); showToast('카드를 사진 자리에 넣었어요') }}
            />
          </div>
        )}
      {/* 같이 걸은 친구 — 펫이 등록돼 있을 때만. 사진이 없으면 안내만(사진 올리기 장려) */}
      <section className="pt-6">
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
                    className={`inline-flex min-h-11 items-center gap-1.5 pl-1 pr-3 py-1 rounded-full border border-solid text-[14px] transition disabled:opacity-40 focus:outline-none focus-visible:shadow-ring ${
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

      <section className="pt-6 pb-3">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">걸은 만큼</p>
        <h2 className="text-[15px] font-bold text-ink leading-tight mb-3">오늘 걸음 수 <span className="text-[12px] font-normal text-ink-faint">(선택)</span></h2>
        <div className="flex items-center gap-2 rounded-card border border-rule bg-paper px-4 py-3">
          <span aria-hidden="true" className="text-[18px]">🚶</span>
          <input
            inputMode="numeric"
            aria-label="오늘 걸음 수"
            pattern="[0-9]*"
            value={steps}
            onChange={(e) => setSteps(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="예: 6200"
            className="flex-1 min-w-0 text-[16px] text-ink placeholder:text-ink-soft focus:outline-none tabular-nums"
          />
          <span className="text-[13px] text-ink-soft">보</span>
        </div>
        <p className="text-[12px] text-ink-faint mt-2 leading-relaxed">
          걸음 수는 직접 적어요. 비워 두어도 이야기를 올릴 수 있어요.
        </p>
      </section>
      </details>
      </section>
      <div className="px-5 pt-5 pb-28"><button type="button" disabled={!canSubmit} onClick={submit} className="min-h-12 w-full rounded-control bg-ink px-5 py-3 text-[16px] font-bold text-paper disabled:opacity-40 focus-visible:shadow-ring">{saving ? '올리는 중…' : editId ? '수정한 이야기 저장' : '이야기 올리기'}</button></div>
      </fieldset>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100%-2.5rem)] px-4 py-2.5 rounded-card bg-ink text-paper text-[14px] shadow-lg">
          {toast}
        </div>
      )}

      <NicknameModal open={modalOpen} onDone={handleDone} onClose={closeModal} />
    </AppFrame>
  )
}
