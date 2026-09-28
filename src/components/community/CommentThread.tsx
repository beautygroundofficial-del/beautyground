import { useCallback, useEffect, useRef, useState } from 'react'
import { promptAndReport } from '../../lib/reports'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useNicknameGate } from '../../hooks/useNicknameGate'
import NicknameModal from './NicknameModal'

export interface CommentRow {
  id: string
  nickname: string | null
  content: string
  created_at: string
  is_mine: boolean
  parent_comment_id?: string | null
  user_id?: string | null
  like_count?: number
  liked_by_me?: boolean
}
export interface CommentApi {
  list: (targetId: string, limit?: number, offset?: number) => Promise<CommentRow[] | null>
  create: (targetId: string, content: string, nickname: string | null, parentId?: string | null) => Promise<{ comment_id: string | null; awarded: number; message: string }>
  remove: (commentId: string) => Promise<boolean>
  toggleLike?: (commentId: string) => Promise<{ liked: boolean; like_count: number } | null>
}
interface Props {
  targetId: string
  api: CommentApi
  open: boolean
  count: number
  loggedIn: boolean
  myName?: string | null
  onCountChange: (next: number) => void
  onAward?: (points: number) => void
  onNotice?: (msg: string) => void
  focusCommentId?: string | null
  namespace?: 'diary' | 'board' | 'answer'
  allowReplies?: boolean
  profileLinks?: boolean
  returnTo?: string
  spacious?: boolean
}
interface Drafts {
  main: string
  replies: Record<string, string>
  replyTarget: string | null
}
const PAGE_SIZE = 50
const emptyDrafts = (): Drafts => ({ main: '', replies: {}, replyTarget: null })

function readDrafts(key: string): Drafts | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (!saved || typeof saved.updatedAt !== 'number' || Date.now() - saved.updatedAt > 86_400_000) return null
    const replies: Record<string, string> = {}
    if (saved.replies && typeof saved.replies === 'object') {
      for (const [id, text] of Object.entries(saved.replies)) {
        if (typeof text === 'string') replies[id] = text.slice(0, 500)
      }
    }
    return { main: typeof saved.main === 'string' ? saved.main.slice(0, 500) : '', replies,
      replyTarget: typeof saved.replyTarget === 'string' ? saved.replyTarget : null }
  } catch { return null }
}
function saveDrafts(key: string, drafts: Drafts) {
  try {
    if (!drafts.main && !Object.values(drafts.replies).some(Boolean)) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify({ ...drafts, updatedAt: Date.now() }))
  } catch { /* 현재 입력은 저장 실패와 관계없이 유지한다. */ }
}
function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}
function timeAgo(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`
  return `${Math.floor(minutes / 1440)}일 전`
}

// 같은 자리에 다른 글이 들어와도 이전 글의 요청·초안을 넘기지 않는다.
export default function CommentThread(props: Props) {
  return <CommentPanel key={`${props.namespace ?? 'answer'}:${props.targetId}:${props.loggedIn}`} {...props} />
}

function CommentPanel({
  targetId, api, open, count, loggedIn, onCountChange, onAward, onNotice,
  focusCommentId, namespace = 'answer', allowReplies = false, profileLinks = false, returnTo, spacious = false,
}: Props) {
  const navigate = useNavigate()
  const { modalOpen, nicknameReady, ensureNickname, handleDone, closeModal } = useNicknameGate()
  const [list, setList] = useState<CommentRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts)
  const [draftReady, setDraftReady] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [likeBusyIds, setLikeBusyIds] = useState<Set<string>>(new Set())
  const lastCreatedId = useRef<string | null>(null)
  const mounted = useRef(true)
  const requestVersion = useRef(0)
  const mutationBusy = useRef(false)
  const listRef = useRef<CommentRow[] | null>(null)
  const draftsRef = useRef<Drafts>(emptyDrafts())
  const storageKey = useRef<string | null>(null)
  const countRef = useRef(count)
  countRef.current = count

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; requestVersion.current += 1 }
  }, [])

  // 로그인·프로필 방문 뒤 복구하되 계정별로 구분하고 같은 탭에서 하루만 보관한다.
  useEffect(() => {
    let active = true
    let generation = 0
    const restore = (owner: string | null) => {
      if (!active) return
      const guestKey = `bg:comment-draft:guest:${namespace}:${targetId}`
      const key = `bg:comment-draft:${owner ?? 'guest'}:${namespace}:${targetId}`
      if (storageKey.current === key) return
      const ownDraft = readDrafts(key)
      const guestDraft = owner ? readDrafts(guestKey) : null
      const next = ownDraft ?? guestDraft ?? emptyDrafts()
      storageKey.current = key
      draftsRef.current = next
      setDrafts(next)
      setDraftReady(true)
      if (owner && guestDraft) {
        try {
          sessionStorage.setItem(key, JSON.stringify({ ...next, updatedAt: Date.now() }))
          sessionStorage.removeItem(guestKey)
        } catch { /* 현재 화면의 초안은 유지한다. */ }
      }
    }
    const auth = supabase.auth.onAuthStateChange((_event, session) => {
      generation += 1
      restore(session?.user.id ?? null)
    })
    const initialGeneration = generation
    void supabase.auth.getSession().then(({ data }) => {
      if (generation === initialGeneration) restore(data.session?.user.id ?? null)
    }).catch(() => {
      if (active) { setDraftReady(true); setMessage('임시 저장을 사용할 수 없어요. 작성 중에는 이 화면을 유지해 주세요.') }
    })
    return () => { active = false; auth.data.subscription.unsubscribe() }
  }, [namespace, targetId])

  const persistDrafts = (next: Drafts) => {
    draftsRef.current = next
    setDrafts(next)
    if (!storageKey.current) return
    saveDrafts(storageKey.current, next)
  }

  const load = useCallback(async (append = false, findId?: string | null, all = false) => {
    const version = ++requestVersion.current
    setLoading(true)
    setLoadError(false)
    let rows = append ? [...(listRef.current ?? [])] : []
    let more = false
    const draftParent = draftsRef.current.replyTarget
    try {
      do {
        const page = await api.list(targetId, PAGE_SIZE, rows.length)
        if (!mounted.current || requestVersion.current !== version) return null
        if (page === null) throw new Error('comments unavailable')
        const known = new Set(rows.map((row) => row.id))
        const added = page.filter((row) => !known.has(row.id))
        rows = [...rows, ...added]
        more = page.length === PAGE_SIZE
        if (more && added.length === 0) throw new Error('comments pagination did not advance')
      } while (more && (all || (!!findId && !rows.some((row) => row.id === findId))
        || (!!draftParent && !rows.some((row) => row.id === draftParent))))
      listRef.current = rows
      setList(rows)
      setHasMore(more)
      return rows
    } catch {
      if (mounted.current && requestVersion.current === version) setLoadError(true)
      return null
    } finally {
      if (mounted.current && requestVersion.current === version) setLoading(false)
    }
  }, [api, targetId])

  useEffect(() => {
    lastCreatedId.current = null
    setHighlightId(null)
  }, [focusCommentId])

  useEffect(() => {
    if (open && draftReady) void load(false, lastCreatedId.current ?? focusCommentId)
    return () => { requestVersion.current += 1 }
  }, [open, load, focusCommentId, loggedIn, draftReady])

  const selectedId = highlightId ?? focusCommentId
  useEffect(() => {
    if (!open || !selectedId || !list?.some((row) => row.id === selectedId)) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(`comment-${namespace}-${targetId}-${selectedId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, list, namespace, targetId, selectedId])

  const notice = (text: string) => { setMessage(text); onNotice?.(text) }
  const returnPath = (commentId?: string | null) => {
    const url = new URL(returnTo ?? `/app/home?answer=${encodeURIComponent(targetId)}`, window.location.origin)
    const focus = commentId ?? selectedId
    if (focus) url.searchParams.set('comment', focus)
    return url.pathname + url.search + url.hash
  }
  const login = (commentId?: string | null) => navigate('/app/login', { state: { from: returnPath(commentId) } })
  const visitProfile = (comment: CommentRow) => {
    const from = returnPath(comment.id)
    // 휴대폰·브라우저 뒤로 가기도 같은 댓글로 복귀하도록 현재 이력에 위치를 남긴다.
    navigate(from, { replace: true })
    navigate(`/app/people/${comment.user_id}`, { state: { from } })
  }
  const updateCount = (next: number) => { countRef.current = next; onCountChange(next) }

  const submit = (parentId: string | null = null) => {
    if (!loggedIn) { login(parentId); return }
    if (mutationBusy.current || !draftReady || !nicknameReady) return
    const text = (parentId ? draftsRef.current.replies[parentId] ?? '' : draftsRef.current.main).trim()
    if (!text) return
    const submittedScope = storageKey.current
    mutationBusy.current = true
    setPending(parentId ?? 'main')
    setMessage('')
    ensureNickname((nickname) => {
      void (async () => {
        try {
          const result = await api.create(targetId, text, nickname, parentId)
          if (!result.comment_id) {
            if (mounted.current) notice(result.message || '남기지 못했어요. 작성한 내용은 그대로예요.')
            return
          }
          const stillHere = mounted.current && storageKey.current === submittedScope
          const currentDraft = stillHere ? draftsRef.current : submittedScope ? readDrafts(submittedScope) : null
          // 전송 중 다른 화면으로 이동했어도 성공한 초안만 지운다. 새로 고친 내용은 보존한다.
          if (currentDraft && (parentId ? currentDraft.replies[parentId] ?? '' : currentDraft.main).trim() === text) {
            const next = { ...currentDraft, replies: { ...currentDraft.replies } }
            if (parentId) {
              delete next.replies[parentId]
              if (next.replyTarget === parentId) next.replyTarget = null
            } else next.main = ''
            if (stillHere) persistDrafts(next)
            else if (submittedScope) saveDrafts(submittedScope, next)
          }
          if (!stillHere) return
          updateCount(countRef.current + 1)
          lastCreatedId.current = result.comment_id
          setHighlightId(result.comment_id)
          if (result.awarded > 0) onAward?.(result.awarded)
          const refreshed = await load(false, result.comment_id)
          if (mounted.current && refreshed === null) notice('댓글은 등록됐어요. 목록을 다시 불러와 주세요.')
        } catch {
          if (mounted.current) notice('전송 결과를 확인하지 못했어요. 새로고침으로 등록 여부를 확인한 뒤 다시 보내 주세요. 작성한 내용은 남겨 두었어요.')
        } finally {
          mutationBusy.current = false
          if (mounted.current) setPending(null)
        }
      })()
    })
  }

  const remove = async (comment: CommentRow) => {
    if (!comment.is_mine || mutationBusy.current) return
    if (!window.confirm(allowReplies && !comment.parent_comment_id
      ? '이 댓글과 여기에 달린 답글도 함께 지워져요. 삭제할까요?' : '이 댓글을 지울까요?')) return
    mutationBusy.current = true
    setPending(`delete:${comment.id}`)
    setMessage('')
    try {
      const ok = await api.remove(comment.id)
      if (!mounted.current) return
      if (!ok) { notice('삭제하지 못했어요. 이미 삭제됐거나 권한이 달라졌을 수 있어요.'); return }
      const removed = new Set([comment.id, ...(listRef.current ?? []).filter((row) => row.parent_comment_id === comment.id).map((row) => row.id)])
      const remaining = (listRef.current ?? []).filter((row) => !removed.has(row.id))
      listRef.current = remaining
      setList(remaining)
      const next = { ...draftsRef.current, replies: { ...draftsRef.current.replies } }
      removed.forEach((id) => delete next.replies[id])
      if (next.replyTarget && removed.has(next.replyTarget)) next.replyTarget = null
      persistDrafts(next)
      // 부모 삭제 시 서버에서 함께 지워지는, 아직 보이지 않던 답글도 개수에 반영한다.
      const refreshed = await load(false, null, true)
      if (!mounted.current) return
      updateCount(refreshed ? refreshed.length : Math.max(0, countRef.current - removed.size))
      if (!refreshed) notice('댓글은 삭제됐어요. 목록을 다시 불러와 주세요.')
    } catch {
      if (mounted.current) notice('삭제 결과를 확인하지 못했어요. 목록을 다시 불러와 주세요.')
    } finally {
      mutationBusy.current = false
      if (mounted.current) setPending(null)
    }
  }

  const toggleLike = async (comment: CommentRow) => {
    if (!api.toggleLike) return
    if (!loggedIn) { login(comment.id); return }
    if (likeBusyIds.has(comment.id)) return
    setLikeBusyIds((prev) => new Set(prev).add(comment.id))
    try {
      const result = await api.toggleLike(comment.id)
      if (!result || !mounted.current) return
      const apply = (rows: CommentRow[] | null) =>
        rows?.map((row) => row.id === comment.id ? { ...row, liked_by_me: result.liked, like_count: result.like_count } : row) ?? null
      listRef.current = apply(listRef.current)
      setList((prev) => apply(prev))
    } catch {
      if (mounted.current) notice('좋아요를 처리하지 못했어요.')
    } finally {
      if (mounted.current) setLikeBusyIds((prev) => { const next = new Set(prev); next.delete(comment.id); return next })
    }
  }

  if (!open) return null
  const busy = pending !== null
  const visible = list ?? []
  const topLevel = visible.filter((row) => !row.parent_comment_id || !visible.some((parent) => parent.id === row.parent_comment_id))
  const renderComment = (comment: CommentRow, reply = false) => {
    const replyDraft = drafts.replies[comment.id] ?? ''
    const name = comment.is_mine ? '나' : maskName(comment.nickname)
    const canVisit = profileLinks && !!comment.user_id && !!comment.nickname?.trim() && !comment.is_mine
    return <div key={comment.id} id={`comment-${namespace}-${targetId}-${comment.id}`}
      className={`scroll-mt-20 ${reply ? 'ml-3 pl-4 border-l-2 border-rule' : ''} ${selectedId === comment.id ? 'rounded-xl bg-paper p-3 ring-1 ring-rule' : ''}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3">
        <div className="min-h-11 text-[12.5px] text-ink-soft flex flex-wrap items-center gap-1.5">
          <span aria-hidden="true" className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-[13px] font-bold text-ink">{name[0]}</span>
          {canVisit ? <button type="button" disabled={busy} onClick={() => visitProfile(comment)}
            aria-label={`${name}님의 이야기 보기`} className="min-h-11 min-w-11 text-left font-bold focus-visible:shadow-ring">{name}</button> : <span>{name}</span>}
          {spacious && <span>· {timeAgo(comment.created_at)}</span>}
        </div>
        <div className="ml-auto shrink-0 flex items-center gap-1">
          {api.toggleLike && <button type="button" disabled={busy || likeBusyIds.has(comment.id)} onClick={() => void toggleLike(comment)}
            aria-pressed={!!comment.liked_by_me} aria-label={comment.liked_by_me ? '좋아요 취소' : '좋아요'}
            className={`min-h-11 min-w-11 rounded-control px-2 text-[13px] hover:bg-quiet focus-visible:shadow-ring disabled:opacity-40 ${comment.liked_by_me ? 'text-ink font-bold' : 'text-ink-soft'}`}>
            {comment.liked_by_me ? '♥' : '♡'}{comment.like_count ? ` ${comment.like_count}` : ''}
          </button>}
          {allowReplies && !comment.parent_comment_id && <button type="button" disabled={busy || !draftReady}
            onClick={() => {
              if (!loggedIn) { login(comment.id); return }
              persistDrafts({ ...draftsRef.current, replyTarget: drafts.replyTarget === comment.id ? null : comment.id })
            }} aria-expanded={drafts.replyTarget === comment.id} className="min-h-11 min-w-11 rounded-control px-2 text-[13px] text-ink-soft hover:bg-quiet focus-visible:shadow-ring disabled:opacity-40">답글</button>}
          {!comment.is_mine && <button type="button" disabled={busy} onClick={() => {
              if (!loggedIn) { login(comment.id); return }
              const kind = namespace === 'board' ? 'board_comment' : namespace === 'answer' ? 'answer_comment' : 'diary_comment'
              void promptAndReport(kind, comment.id).then((msg) => { if (msg) notice(msg) })
            }} aria-label="이 댓글 신고" className="min-h-11 min-w-11 rounded-control px-2 text-[13px] text-ink-faint hover:bg-quiet focus-visible:shadow-ring disabled:opacity-40">신고</button>}
          {comment.is_mine && <button type="button" disabled={busy} onClick={() => void remove(comment)}
            className="min-h-11 min-w-11 rounded-control px-2 text-[13px] text-ink-soft hover:bg-quiet focus-visible:shadow-ring disabled:opacity-40">{pending === `delete:${comment.id}` ? '삭제 중…' : '삭제'}</button>}
        </div>
      </div>
      <p className="text-[15px] text-ink leading-[1.8] whitespace-pre-wrap break-words">{comment.content}</p>
      {allowReplies && !comment.parent_comment_id && drafts.replyTarget === comment.id && <div className="mt-2 rounded-md bg-quiet p-3">
        <div className="flex items-center justify-between mb-1 text-[13px] text-ink-soft">
          <span>{name}님의 댓글에 답글</span>
          <button type="button" disabled={busy} className="min-h-11 min-w-11" onClick={() => persistDrafts({ ...draftsRef.current, replyTarget: null })}>접기</button>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <textarea value={replyDraft} disabled={busy || !draftReady}
            onChange={(event) => persistDrafts({ ...draftsRef.current, replies: { ...draftsRef.current.replies, [comment.id]: event.target.value } })}
            aria-label={`${name}님의 댓글에 답글`} rows={2} maxLength={500} placeholder="답글을 남겨주세요"
            className="min-h-20 w-full resize-y rounded-md border border-rule bg-paper px-3 py-3 text-[16px] leading-relaxed text-ink placeholder:text-ink-soft focus:outline-none focus:border-ink focus-visible:shadow-ring" />
          <button type="button" onClick={() => submit(comment.id)} disabled={busy || !replyDraft.trim() || !draftReady || !nicknameReady}
            className="shrink-0 min-h-11 px-4 py-2 rounded-full bg-ink text-paper text-[14px] font-bold focus-visible:shadow-ring disabled:opacity-40">{pending === comment.id ? '보내는 중…' : '남기기'}</button>
        </div>
      </div>}
    </div>
  }

  return <div className="mt-4 rounded-2xl bg-quiet p-4">
    <h3 className="mb-3 text-[15px] font-bold text-ink">댓글 <span className="ml-1 tabular-nums text-ink-soft">{count}</span></h3>
    {loading && list === null && <p role="status" className="text-[14px] text-ink-soft mb-4">불러오는 중…</p>}
    {loadError && <div role="alert" className="text-[14px] leading-relaxed text-ink-soft mb-4">
      댓글을 불러오지 못했어요. <button type="button" disabled={loading || busy} onClick={() => void load(false, selectedId)} className="min-h-11 underline underline-offset-4 focus-visible:shadow-ring">다시 불러오기</button>
    </div>}
    {list !== null && !loading && !loadError && list.length === 0 && <p className="text-[14px] text-ink-soft mb-4">아직 댓글이 없어요.</p>}
    {list !== null && !loading && !loadError && focusCommentId && !list.some((row) => row.id === focusCommentId) &&
      <p role="status" className="text-[14px] text-ink-soft mb-4">찾으신 댓글이 삭제되었거나 더 이상 보이지 않아요.</p>}
    {topLevel.length > 0 && <ul className="divide-y divide-rule mb-3">
      {topLevel.map((comment) => <li key={comment.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
        {renderComment(comment)}
        {visible.filter((row) => row.parent_comment_id === comment.id).map((row) => renderComment(row, true))}
      </li>)}
    </ul>}
    {list !== null && <div className="flex items-center gap-4 mb-3 text-[14px] text-ink-soft">
      {hasMore && <button type="button" disabled={loading || busy} onClick={() => void load(true)} className="min-h-11 underline">{loading ? '불러오는 중…' : '댓글 더 보기'}</button>}
      <button type="button" disabled={loading || busy} onClick={() => void load(false, selectedId)} className="min-h-11 underline">새로고침</button>
    </div>}
    {message && <p role="status" className="text-[14px] leading-relaxed text-ink-soft mb-3">{message}</p>}
    {!loggedIn ? <button type="button" onClick={() => login()} className="min-h-11 text-[14px] text-ink underline underline-offset-4 py-2 focus-visible:shadow-ring">로그인하고 댓글 남기기</button> : <div className="flex flex-wrap items-end justify-end gap-2 border-t border-rule pt-4">
      <textarea value={drafts.main} disabled={busy || !draftReady}
        onChange={(event) => persistDrafts({ ...draftsRef.current, main: event.target.value })}
        aria-label="댓글 내용" rows={spacious ? 2 : 1} maxLength={500} placeholder="따뜻한 한마디를 남겨주세요"
        className="min-h-20 w-full resize-y rounded-md border border-rule bg-paper px-3 py-3 text-[16px] leading-relaxed text-ink placeholder:text-ink-soft focus:outline-none focus:border-ink focus-visible:shadow-ring" />
      <button type="button" onClick={() => submit()} disabled={busy || !drafts.main.trim() || !draftReady || !nicknameReady}
        className="shrink-0 min-h-11 px-4 py-2 rounded-full bg-ink text-paper text-[14px] font-bold focus-visible:shadow-ring disabled:opacity-40">{pending === 'main' ? '보내는 중…' : '남기기'}</button>
    </div>}
    <NicknameModal open={modalOpen} onDone={handleDone} onClose={() => {
      closeModal()
      mutationBusy.current = false
      setPending(null)
    }} />
  </div>
}
