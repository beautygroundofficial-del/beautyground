import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import ReactionBar from '../components/community/ReactionBar'
import ReactionSummary from '../components/community/ReactionSummary'
import BoardComments from '../components/community/BoardComments'
import Lightbox from '../components/community/Lightbox'
import LikeButton from '../components/community/LikeButton'
import { supabase } from '../lib/supabase'
import { categoryLabel, deleteBoardPost, getBoardPost, reportBoardPost, toggleBoardLike, type BoardPost } from '../lib/board'

// 속 이야기 — 글 하나. (2026-09-10)
// 공감 3종(토닥토닥·나도 그래요·응원해요)은 일기와 같은 ReactionBar. 내 글엔 띄우지 않는다.
// 신고는 기록만 남기고 운영자가 보고 가린다 — 자동으로 감추지 않는다(오신고로 글이 사라지면 안 된다).

function timeAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

export default function AppBoardPost() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [loggedIn, setLoggedIn] = useState(false)
  const [myName, setMyName] = useState<string | null>(null)
  const [post, setPost] = useState<BoardPost | null | undefined>(undefined)
  const [toast, setToast] = useState('')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    const st = location.state as { toast?: string } | null
    if (st?.toast) { showToast(st.toast); window.history.replaceState({}, '') }
  }, [location.state])

  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!alive) return
      setLoggedIn(!!session)
      if (session) {
        const meta = session.user.user_metadata as { name?: string } | undefined
        setMyName(meta?.name || session.user.email?.split('@')[0] || null)
      }
      const p = await getBoardPost(id)
      if (alive) setPost(p)
    })()
    return () => { alive = false }
  }, [id])

  const onDelete = async () => {
    if (!post || !window.confirm('이 이야기를 지울까요?')) return
    const ok = await deleteBoardPost(post.id)
    if (!ok) { showToast('지우지 못했어요'); return }
    navigate('/app/board', { replace: true })
  }

  const onReport = async () => {
    if (!post) return
    if (!loggedIn) { navigate('/app/login'); return }
    const reason = window.prompt('어떤 점이 불편했는지 짧게 알려주세요(선택)') ?? undefined
    if (reason === undefined) return
    const res = await reportBoardPost(post.id, reason)
    showToast(res.message)
  }

  return (
    <AppFrame>
      <BackHeader
        title="속 이야기"
        onBack={() => navigate('/app/board')}
        rightElement={
          post ? (
            post.is_mine ? (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => navigate(`/app/board/write?id=${post.id}`)} className="text-[12.5px] text-ink-faint">수정</button>
                <button type="button" onClick={() => void onDelete()} className="text-[12.5px] text-ink-faint">삭제</button>
              </div>
            ) : (
              <button type="button" onClick={() => void onReport()} className="text-[12.5px] text-ink-faint">신고</button>
            )
          ) : null
        }
      />

      {post === undefined ? (
        <p className="py-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
      ) : post === null ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[14px] font-semibold text-ink">이미 지워진 이야기예요</p>
          <button type="button" onClick={() => navigate('/app/board')} className="mt-4 text-[13px] text-ink-soft underline">
            다른 이야기 보러 가기
          </button>
        </div>
      ) : (
        <>
          <article className="px-5 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-semibold text-ink-soft bg-quiet rounded-full px-2 py-0.5">
                {categoryLabel(post.category)}
              </span>
              <span className="text-[11px] text-ink-faint">
                {post.is_mine ? '나' : maskName(post.nickname)} · {timeAgo(post.created_at)}
              </span>
            </div>

            <p className="text-[15px] text-ink leading-[1.8] whitespace-pre-wrap">{post.content}</p>

            {post.images.length > 0 && (
              <div className={`grid gap-1 mt-4 rounded-card overflow-hidden ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {post.images.slice(0, 4).map((src, i) => (
                  <button
                    type="button"
                    key={`${src}-${i}`}
                    onClick={() => setViewerIndex(i)}
                    aria-label={`사진 ${i + 1} 크게 보기`}
                    className={`bg-quiet focus:outline-none focus-visible:shadow-ring ${post.images.length === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {post.video_url && (
              <div className="mt-4 rounded-card overflow-hidden bg-ink">
                <video src={post.video_url} controls playsInline preload="metadata" className="w-full max-h-[420px]" />
              </div>
            )}

            {/* 하트 — board_likes.sql 이 실행된 뒤(like_count 가 오면)부터 보인다 */}
            {post.like_count !== undefined && (
              <div className="mt-4 -ml-2">
                <LikeButton
                  liked={!!post.liked_by_me}
                  count={post.like_count}
                  loggedIn={loggedIn}
                  disabled={post.is_mine}
                  size="md"
                  onToggle={async () => {
                    const res = await toggleBoardLike(post.id)
                    if (res) setPost((prev) => (prev ? { ...prev, liked_by_me: res.liked, like_count: res.like_count } : prev))
                    return res
                  }}
                />
              </div>
            )}

            {post.is_mine && (
              <div className="mt-5 pt-4 border-t border-rule">
                <ReactionSummary counts={post} size="md" />
              </div>
            )}

            {!post.is_mine && (
              <div className="mt-5 pt-4 border-t border-rule">
                <p className="text-[11.5px] text-ink-faint mb-2">마음이 닿았다면</p>
                <ReactionBar
                  target="board"
                  targetId={post.id}
                  counts={post}
                  loggedIn={loggedIn}
                  onChange={(next) => setPost((prev) => (prev ? { ...prev, ...next } : prev))}
                  onAward={(p) => showToast(`${p}P를 받았어요`)}
                />
              </div>
            )}
          </article>

          <div className="pb-28">
            <BoardComments
              postId={post.id}
              count={post.comment_count}
              loggedIn={loggedIn}
              myName={myName}
              onCountChange={(n) => setPost((prev) => (prev ? { ...prev, comment_count: n } : prev))}
              onAward={(p) => showToast(`${p}P를 받았어요`)}
              onNotice={showToast}
            />
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {toast}
        </div>
      )}

      {post && viewerIndex !== null && (
        <Lightbox images={post.images} index={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </AppFrame>
  )
}
