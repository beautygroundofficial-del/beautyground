import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import PostComposer, { loadDraft, saveDraft, clearDraft } from '../components/community/PostComposer'
import { supabase } from '../lib/supabase'
import { useIsAdmin } from '../lib/useIsAdmin'
import { BOARD_CATEGORIES, createBoardPost, getBoardPost, updateBoardPost, type BoardCategory } from '../lib/board'
import { uploadCommunityImages, uploadCommunityVideo } from '../lib/diaries'
import { useNicknameGate } from '../hooks/useNicknameGate'
import NicknameModal from '../components/community/NicknameModal'

// 속 이야기 쓰기·고쳐 쓰기 — 제목 없이 본문만. (2026-09-10 → 2026-09-11 공용 글쓰기 환경 + 영상 + 고쳐 쓰기)
// "뭐라고 제목을 붙이지" 하는 망설임 자체를 없앤다. 카테고리 하나만 고르고 바로 쓴다.
// 이름은 일기와 같이 가려서 보인다(ㅇ**ㅇ). 포인트는 올린 뒤에 조용히 알린다. 고쳐 쓰기엔 포인트가 없다.

const MIN_LEN = 10
const MAX_LEN = 2000

interface Draft { content: string; category: BoardCategory | null }

export default function AppBoardWrite() {
  const navigate = useNavigate()
  const location = useLocation()
  const [sp] = useSearchParams()
  const editId = sp.get('id')
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const { modalOpen, ensureNickname, handleDone, closeModal } = useNicknameGate()

  const [category, setCategory] = useState<BoardCategory | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categoryDetails = useRef<HTMLDetailsElement>(null)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [existingVideo, setExistingVideo] = useState<string | null>(null)
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
  const draftKey = ownerId ? `board:${ownerId}` : null
  const returnTo = location.pathname + location.search
  const editAdminLoading = !!editId && adminLoading
  const canEditOthers = !!editId && isAdmin

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    if (editAdminLoading) return
    let active = true
    let loadedOwner: string | null = null
    let observedUserId: string | null | undefined
    loadedScope.current = null
    setReady(false); setLoadError('')
    setContent(''); setCategory(null); setCategoryOpen(false)
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
        const row = await getBoardPost(editId)
        if (!active) return
        if (!row || (!row.is_mine && !canEditOthers)) { showToast('고칠 수 있는 글이 아니에요'); navigate('/app/board', { replace: true }); return }
        setCategory(row.category)
        setContent(row.content)
        setExistingImages(row.images ?? [])
        setExistingVideo(row.video_url ?? null)
      } else {
        const d = loadDraft<Draft>(`board:${loadedOwner}`)
        setContent(typeof d.content === 'string' ? d.content.slice(0, MAX_LEN) : '')
        setCategory(d.category && BOARD_CATEGORIES.some((c) => c.key === d.category) ? d.category : null)
      }
      loadedScope.current = `${loadedOwner}:${returnTo}`
      setReady(true)
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
  }, [navigate, editId, editAdminLoading, canEditOthers, returnTo, retry])

  useEffect(() => { if (ready && !editId && draftKey && loadedScope.current === `${ownerId}:${returnTo}`) setDraftSaved(saveDraft(draftKey, { content, category })) }, [ready, editId, draftKey, ownerId, returnTo, content, category])

  const askForCategory = () => {
    setCategoryOpen(true)
    showToast('어떤 이야기인지 하나만 골라주세요')
    requestAnimationFrame(() => {
      categoryDetails.current?.querySelector('summary')?.focus()
      categoryDetails.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }

  const doSubmit = async (nickname: string | null) => {
    if (!ready || !ownerId || submitting.current || mediaBusy || loadedScope.current !== `${ownerId}:${returnTo}`) return
    if (!category) { askForCategory(); return }
    if (content.trim().length < MIN_LEN) { showToast(`${MIN_LEN}자 이상 적어주세요`); return }
    submitting.current = true
    setSaving(true)
    try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user.id !== ownerId) { showToast('다시 로그인한 뒤 글을 이어서 올려주세요.'); return }
    const newUrls = files.length > 0 ? await uploadCommunityImages(files, 'board') : []
    if (newUrls.length !== files.length) {
      showToast('사진을 모두 올리지 못했어요. 글은 유지돼요. 다시 시도해 주세요.'); return
    }
    let videoUrl: string | null = existingVideo
    if (video) {
      videoUrl = await uploadCommunityVideo(video, 'board')
      if (!videoUrl) { showToast('영상 업로드에 실패했어요. 잠시 후 다시 시도해 주세요'); return }
    }
    const images = [...existingImages, ...newUrls]
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (currentSession?.user.id !== ownerId || loadedScope.current !== `${ownerId}:${returnTo}`) return

    if (editId) {
      const ok = await updateBoardPost(editId, { category, content: content.trim(), images, video_url: videoUrl })
      if (loadedScope.current !== `${ownerId}:${returnTo}`) return
      if (!ok) { showToast('고치지 못했어요. 잠시 후 다시 시도해 주세요'); return }
      navigate(`/app/board/${editId}`, { replace: true, state: { toast: '고쳐 썼어요' } })
      return
    }

    const res = await createBoardPost(category, content, images, nickname, videoUrl)
    if (loadedScope.current !== `${ownerId}:${returnTo}`) return
    if (!res || !res.post_id) { showToast(res?.message || '올리지 못했어요'); return }
    if (draftKey) clearDraft(draftKey)
    navigate(`/app/board/${res.post_id}`, {
      replace: true,
      state: { toast: res.awarded > 0 ? `${res.awarded}P를 받았어요` : '이야기를 꺼내놓았어요' },
    })
    } catch { showToast('올리지 못했어요. 작성한 내용은 유지돼요. 다시 시도해 주세요.') }
    finally { submitting.current = false; setSaving(false) }
  }

  // 새 글 작성만 애칭이 필요하다 — 고쳐 쓰기는 닉네임을 새로 남기지 않으므로 그대로 진행
  const submit = () => {
    if (!ready || submitting.current) return
    // 버튼이 일찍 켜지므로 빠진 것(종류·글자 수) 안내를 애칭 창보다 먼저 보여준다
    if (!category) { askForCategory(); return }
    if (content.trim().length < MIN_LEN) { showToast(`${MIN_LEN}자 이상 적어주세요`); return }
    if (editId) { void doSubmit(null); return }
    ensureNickname((nickname) => void doSubmit(nickname))
  }

  // 입력칸에 커서만 올려도 버튼을 켠다 — 흐린 버튼은 "왜 안 눌리지" 헷갈림. 종류·글자 수는 누를 때 안내 (2026-09-21 대표님 지시)
  const [touched, setTouched] = useState(false)
  const canSubmit = ready && !saving && !mediaBusy && (touched || content.trim().length > 0)

  return (
    <AppFrame>
      <BackHeader
        title={editId ? '고쳐 쓰기' : '털어놓기'}
        onBack={() => navigate(editId ? `/app/board/${editId}` : '/app/board')}
      />

      {loadError && <div role="alert" className="px-5 pt-4 text-[14px] text-ink">{loadError}<button type="button" onClick={() => setRetry(n => n + 1)} className="min-h-11 px-3 font-bold underline">다시 시도</button></div>}
      <fieldset disabled={!ready || saving} className="min-w-0 border-0 p-0 m-0">
      <section className="px-5 pt-5">
        <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">공개 이야기 · 누구나 글과 댓글을 읽을 수 있어요.</p>
        <details ref={categoryDetails} open={categoryOpen} onToggle={event => setCategoryOpen(event.currentTarget.open)} className="rounded-card bg-quiet px-4 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-[14px] font-semibold leading-relaxed text-ink">{category ? BOARD_CATEGORIES.find(c => c.key === category)?.label : '이야기 주제 고르기'} <span className="font-normal text-ink-soft">{category ? '· 바꾸기' : '(필수)'}</span></summary>
        <div className="flex flex-wrap gap-2 py-3">
          {BOARD_CATEGORIES.map((c) => {
            const on = category === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => { setCategory(c.key); setCategoryOpen(false) }}
                aria-pressed={on}
                className={`min-h-11 px-3.5 py-2 rounded-full border border-solid text-[14px] transition focus:outline-none focus-visible:shadow-ring ${
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
        </details>
      </section>

      <section className="px-5 pt-7 pb-28" onFocusCapture={() => setTouched(true)}>
        {/* 올리기 버튼을 본문 제목 옆에 — 키보드가 올라와도 쓰던 자리 바로 위에서 올릴 수 있게 (2026-09-21 대표님 지시) */}
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <p className="text-[13px] text-ink-soft leading-relaxed mb-1.5">천천히, 하고 싶은 만큼만</p>
            <h2 className="text-[18px] font-bold text-ink leading-snug">무슨 일이 있었나요</h2>
          </div>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className="min-h-11 shrink-0 px-4 py-2 rounded-control bg-ink text-paper text-[14px] font-semibold disabled:opacity-40 focus-visible:shadow-ring"
          >
            {saving ? '올리는 중…' : editId ? '고치기' : '올리기'}
          </button>
        </div>
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
          disabled={!ready || saving}
          placeholder="여기엔 잘 쓰려고 애쓰지 않아도 돼요. 떠오르는 대로 적어주세요."
          onNotice={showToast}
          onBusyChange={setMediaBusy}
        />
        {!editId && <p role="status" className="mt-3 text-[12px] leading-relaxed text-ink-soft">{draftSaved ? '글은 이 브라우저에 임시저장돼요. 사진·영상은 다시 선택해 주세요.' : '임시저장을 못 했어요. 화면을 나가기 전에 글을 복사해 주세요.'}</p>}
        <p className="text-[13px] text-ink-soft mt-3 leading-relaxed">
          다른 사람의 이름이나 연락처는 빼주세요. 남을 특정하거나 상처 주는 글은 운영자가 가릴 수 있어요.
        </p>
        <button type="button" disabled={!canSubmit} onClick={submit} className="mt-5 min-h-12 w-full rounded-control bg-ink px-5 py-3 text-[16px] font-bold text-paper disabled:opacity-40 focus-visible:shadow-ring">{saving ? '올리는 중…' : editId ? '수정한 이야기 저장' : '이야기 올리기'}</button>
      </section>
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
