import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTodayQuestion, getQuestionAnswers, answerTodayQuestion,
  toggleAnswerLike, getAnswerComments, createAnswerComment, deleteAnswerComment,
  MAX_ANSWER_IMAGES,
  type TodayQuestion as Question, type QuestionAnswer,
} from '../../lib/dailyQuestion'
import { uploadCommunityImages } from '../../lib/diaries'
import ReactionBar from './ReactionBar'
import LikeButton from './LikeButton'
import { CommentToggle } from './DiaryComments'
import CommentThread, { type CommentApi } from './CommentThread'
import Lightbox from './Lightbox'

// 오늘의 질문 — 하루 한 개, 한 줄로 답하는 자리. (2026-09-07)
//
// 대표님 지시 "소비자가 놀 수 있는 곳, 휴식을 취하는 곳으로".
// 커뮤니티가 0건인 진짜 이유는 포인트가 적어서가 아니라 '쓸 말이 없어서'다.
// 빈 종이에 일기를 쓰라고 하면 못 쓰지만, 질문 하나에 한 줄 답하는 건 누구나 한다.
//
// 설계 규칙 —
//  · 답하지 않아도 남의 답이 다 보인다. 읽기만 해도 되는 곳이어야 한다
//    (히로인스처럼 "답해야 열어준다"고 막으면 그때부터 숙제가 된다)
//  · 마감·타이머·소멸 같은 재촉 장치는 넣지 않는다
//  · 포인트는 버튼에 써 붙이지 않는다. 남긴 뒤에 조용히 알려준다
//  · 오늘 걸린 질문이 없으면 카드 자체를 감춘다("오늘은 질문이 없어요"도 빚처럼 읽힌다)
// 2026-09-11 — 대표님 "커뮤니티 게시판 모두 하트·말풍선·이미지 업로드": 답에 사진(2장)·하트·댓글을 붙였다.
//   하루 이야기 카드와 같은 줄 구성 — [이름] ····· [♡][💬], 그 아래 공감 3종, 말풍선을 누르면 댓글이 펼쳐진다.

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

const MAX_LEN = 200

const answerCommentApi: CommentApi = {
  list: (id) => getAnswerComments(id),
  create: (id, text, name) => createAnswerComment(id, text, name),
  remove: (id) => deleteAnswerComment(id),
}

// 답에 붙은 사진 — 2장까지라 작게 나란히. 누르면 크게.
function AnswerImages({ images, onOpen }: { images: string[]; onOpen: (i: number) => void }) {
  if (images.length === 0) return null
  return (
    <div className={`grid gap-1 mb-2 ${images.length === 1 ? 'grid-cols-2' : 'grid-cols-2'}`}>
      {images.slice(0, MAX_ANSWER_IMAGES).map((src, i) => (
        <button
          type="button" key={`${src}-${i}`} onClick={() => onOpen(i)} aria-label={`사진 ${i + 1} 크게 보기`}
          className="bg-quiet rounded-lg overflow-hidden aspect-[4/3] focus:outline-none focus-visible:shadow-ring"
        >
          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  )
}

export default function TodayQuestion() {
  const navigate = useNavigate()

  const [question, setQuestion] = useState<Question | null>(null)
  const [answers, setAnswers] = useState<QuestionAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [myName, setMyName] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [files, setFiles] = useState<File[]>([])            // 새로 고른 사진
  const [keptImages, setKeptImages] = useState<string[]>([]) // 고쳐 쓸 때 남겨둘 올려둔 사진
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null)
  const albumRef = useRef<HTMLInputElement>(null)

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => { previews.forEach((u) => URL.revokeObjectURL(u)) }, [previews])

  const flash = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 2600)
  }

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    setLoggedIn(!!session)
    if (session) {
      // 마이페이지·이야기와 같은 규칙 — 닉네임이 없으면 이메일 앞부분을 쓴다.
      const meta = session.user.user_metadata as { name?: string } | undefined
      setMyName(meta?.name || session.user.email?.split('@')[0] || null)
    }

    const q = await getTodayQuestion()
    setQuestion(q)
    if (q) {
      setDraft(q.my_answer ?? '')
      setKeptImages(q.my_images ?? [])
      setAnswers(await getQuestionAnswers(q.id, 20))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const toggleComments = (id: string) => setOpenComments((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'))
    const room = Math.max(0, MAX_ANSWER_IMAGES - keptImages.length - files.length)
    if (picked.length > room) flash(`사진은 ${MAX_ANSWER_IMAGES}장까지 올릴 수 있어요`)
    if (room > 0) setFiles([...files, ...picked.slice(0, room)])
    e.target.value = ''
  }

  const submit = async () => {
    if (!question) return
    if (!loggedIn) { navigate('/app/login'); return }
    const text = draft.trim()
    if (!text && files.length === 0 && keptImages.length === 0) { flash('한 줄만 적어주세요'); return }

    setSaving(true)
    let images = keptImages
    if (files.length > 0) {
      const uploaded = await uploadCommunityImages(files, 'answers')
      if (uploaded.length < files.length) flash('사진 일부를 올리지 못했어요')
      images = [...keptImages, ...uploaded].slice(0, MAX_ANSWER_IMAGES)
    }
    const res = await answerTodayQuestion(question.id, text, myName, images)
    setSaving(false)
    if (!res.answer_id) { flash(res.message || '남기지 못했어요'); return }

    setEditing(false)
    setFiles([])
    flash(res.awarded > 0 ? `${res.awarded}P를 받았어요` : '오늘의 답을 남겼어요')
    // 내 답과 답한 사람 수가 함께 바뀌므로 질문·목록을 같이 다시 불러온다.
    const q = await getTodayQuestion()
    setQuestion(q)
    if (q) { setKeptImages(q.my_images ?? []); setAnswers(await getQuestionAnswers(q.id, 20)) }
  }

  const startEdit = () => {
    setEditing(true)
    setDraft(question?.my_answer ?? '')
    setKeptImages(question?.my_images ?? [])
    setFiles([])
  }
  const cancelEdit = () => {
    setEditing(false)
    setDraft(question?.my_answer ?? '')
    setKeptImages(question?.my_images ?? [])
    setFiles([])
  }

  if (loading || !question) return null

  const answered = !!question.my_answer_id || !!question.my_answer
  const showComposer = !answered || editing
  const composerImages = keptImages.length + previews.length
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-rule text-[12px] text-ink-soft disabled:opacity-40 focus:outline-none focus-visible:shadow-ring'

  return (
    <section className="pt-5">
      <div className="rounded-card border border-rule bg-paper overflow-hidden">
        {/* 질문 */}
        <div className="px-5 pt-5 pb-4">
          <p className="text-[11.5px] text-ink-faint leading-none mb-2">오늘의 질문</p>
          <h2 className="text-[17px] font-bold text-ink leading-snug">{question.question}</h2>
          {question.hint && (
            <p className="text-[12.5px] text-ink-soft mt-1.5 leading-relaxed">{question.hint}</p>
          )}
        </div>

        {/* 내 답 — 아직 안 했으면 입력칸, 했으면 내가 쓴 것 */}
        <div className="px-5 pb-4">
          {showComposer ? (
            <div className="rounded-control border border-rule bg-quiet/40 p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => { if (!loggedIn) navigate('/app/login') }}
                rows={2}
                maxLength={MAX_LEN}
                // 관리자가 곁들이는 한 줄(hint)을 넣으면 같은 문구가 위아래로 두 번 보인다.
                // hint 가 있을 때는 입력칸 안내를 다른 말로 바꾼다.
                placeholder={question.hint ? '여기에 남겨주세요' : '한 줄이면 충분해요'}
                className="w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
              />

              {/* 사진 미리보기 — 올려둔 것 + 새로 고른 것, 각각 뺄 수 있다 */}
              {composerImages > 0 && (
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {keptImages.map((src) => (
                    <div key={src} className="relative bg-quiet rounded-lg overflow-hidden aspect-[4/3]">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setKeptImages(keptImages.filter((x) => x !== src))} aria-label="올려둔 사진 빼기"
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ink/80 text-paper text-[14px] leading-none focus:outline-none focus-visible:shadow-ring">×</button>
                    </div>
                  ))}
                  {previews.map((src, i) => (
                    <div key={`${src}-${i}`} className="relative bg-quiet rounded-lg overflow-hidden aspect-[4/3]">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`${i + 1}번째 사진 빼기`}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ink/80 text-paper text-[14px] leading-none focus:outline-none focus-visible:shadow-ring">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 mt-2 border-t border-rule">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { if (!loggedIn) { navigate('/app/login'); return } albumRef.current?.click() }}
                    disabled={composerImages >= MAX_ANSWER_IMAGES} className={btn}>
                    <span aria-hidden="true">🖼️</span> 사진
                  </button>
                  <span className="text-[11px] text-ink-faint tabular-nums">{draft.length}/{MAX_LEN}</span>
                </div>
                <div className="flex items-center gap-2">
                  {editing && (
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 rounded-control text-[12.5px] text-ink-soft">
                      취소
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-control bg-ink text-paper text-[12.5px] font-semibold disabled:opacity-50"
                  >
                    {saving ? '남기는 중…' : '남기기'}
                  </button>
                </div>
              </div>
              <input ref={albumRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
            </div>
          ) : (
            <div className="rounded-control border border-ink/15 bg-quiet/40 p-3">
              <p className="text-[11.5px] text-ink-faint mb-1">내가 남긴 답</p>
              {(question.my_images?.length ?? 0) > 0 && (
                <AnswerImages images={question.my_images ?? []} onOpen={(i) => setViewer({ images: question.my_images ?? [], index: i })} />
              )}
              {question.my_answer && (
                <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">{question.my_answer}</p>
              )}
              <button type="button" onClick={startEdit} className="mt-2 text-[12px] text-ink-soft underline">
                고쳐 쓰기
              </button>
            </div>
          )}
        </div>

        {/* 다른 사람들의 답 — 답하지 않아도 보인다 */}
        {answers.length > 0 && (
          <div className="border-t border-rule bg-quiet/20 px-5 py-4">
            <p className="text-[11.5px] text-ink-faint mb-3">
              {question.answer_count}명이 오늘을 이렇게 지나고 있어요
            </p>
            <ul className="space-y-4">
              {answers.map((a) => {
                const imgs = a.images ?? []
                return (
                  <li key={a.id}>
                    <AnswerImages images={imgs} onOpen={(i) => setViewer({ images: imgs, index: i })} />
                    {a.content && (
                      <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap">{a.content}</p>
                    )}
                    {/* 하루 이야기 카드와 같은 줄 — [이름] ····· [♡][💬] */}
                    <div className="flex items-center justify-between mt-1 mb-1.5">
                      <span className="text-[11.5px] font-semibold text-ink-soft">
                        {a.is_mine ? '나' : maskName(a.nickname)}
                      </span>
                      <div className="flex items-center gap-1 -mr-2">
                        <LikeButton
                          liked={!!a.liked_by_me}
                          count={a.like_count ?? 0}
                          loggedIn={loggedIn}
                          disabled={a.is_mine}
                          onToggle={async () => {
                            const res = await toggleAnswerLike(a.id)
                            if (res) setAnswers((prev) => prev.map((x) => (x.id === a.id ? { ...x, liked_by_me: res.liked, like_count: res.like_count } : x)))
                            return res
                          }}
                        />
                        <CommentToggle count={a.comment_count ?? 0} open={openComments.has(a.id)} onClick={() => toggleComments(a.id)} />
                      </div>
                    </div>
                    {/* 자기 답에는 반응 버튼을 띄우지 않는다 — 셀프 공감은 적립도 안 되고 의미도 없다 */}
                    {!a.is_mine && (
                      <ReactionBar
                        target="answer"
                        targetId={a.id}
                        counts={a}
                        loggedIn={loggedIn}
                        size="sm"
                        onAward={(p) => flash(`${p}P를 받았어요`)}
                      />
                    )}
                    <CommentThread
                      targetId={a.id}
                      api={answerCommentApi}
                      open={openComments.has(a.id)}
                      count={a.comment_count ?? 0}
                      loggedIn={loggedIn}
                      myName={myName}
                      onCountChange={(n) => setAnswers((prev) => prev.map((x) => (x.id === a.id ? { ...x, comment_count: n } : x)))}
                      onAward={(p) => flash(`${p}P를 받았어요`)}
                      onNotice={flash}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {notice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {notice}
        </div>
      )}

      {viewer && <Lightbox images={viewer.images} index={viewer.index} onClose={() => setViewer(null)} />}
    </section>
  )
}
