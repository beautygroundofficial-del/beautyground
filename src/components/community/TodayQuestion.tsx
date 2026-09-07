import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  getTodayQuestion, getQuestionAnswers, answerTodayQuestion,
  type TodayQuestion as Question, type QuestionAnswer,
} from '../../lib/dailyQuestion'
import ReactionBar from './ReactionBar'

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

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

const MAX_LEN = 200

export default function TodayQuestion() {
  const navigate = useNavigate()

  const [question, setQuestion] = useState<Question | null>(null)
  const [answers, setAnswers] = useState<QuestionAnswer[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [myName, setMyName] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

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
      setAnswers(await getQuestionAnswers(q.id, 20))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const submit = async () => {
    if (!question) return
    if (!loggedIn) { navigate('/app/login'); return }
    const text = draft.trim()
    if (!text) { flash('한 줄만 적어주세요'); return }

    setSaving(true)
    const res = await answerTodayQuestion(question.id, text, myName)
    setSaving(false)
    if (!res.answer_id) { flash(res.message || '남기지 못했어요'); return }

    setEditing(false)
    flash(res.awarded > 0 ? `${res.awarded}P를 받았어요` : '오늘의 답을 남겼어요')
    // 내 답과 답한 사람 수가 함께 바뀌므로 질문·목록을 같이 다시 불러온다.
    const q = await getTodayQuestion()
    setQuestion(q)
    if (q) setAnswers(await getQuestionAnswers(q.id, 20))
  }

  if (loading || !question) return null

  const answered = !!question.my_answer
  const showComposer = !answered || editing

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
                placeholder="한 줄이면 충분해요"
                className="w-full resize-none bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <div className="flex items-center justify-between pt-2 border-t border-rule">
                <span className="text-[11px] text-ink-faint tabular-nums">{draft.length}/{MAX_LEN}</span>
                <div className="flex items-center gap-2">
                  {editing && (
                    <button
                      type="button"
                      onClick={() => { setEditing(false); setDraft(question.my_answer ?? '') }}
                      className="px-3 py-1.5 rounded-control text-[12.5px] text-ink-soft"
                    >
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
            </div>
          ) : (
            <div className="rounded-control border border-ink/15 bg-quiet/40 p-3">
              <p className="text-[11.5px] text-ink-faint mb-1">내가 남긴 답</p>
              <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed">{question.my_answer}</p>
              <button
                type="button"
                onClick={() => { setEditing(true); setDraft(question.my_answer ?? '') }}
                className="mt-2 text-[12px] text-ink-soft underline"
              >
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
            <ul className="space-y-3.5">
              {answers.map((a) => (
                <li key={a.id}>
                  <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap">{a.content}</p>
                  <div className="flex items-center gap-2 mt-1.5 mb-2">
                    <span className="text-[11.5px] font-semibold text-ink-soft">
                      {a.is_mine ? '나' : maskName(a.nickname)}
                    </span>
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
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {notice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {notice}
        </div>
      )}
    </section>
  )
}
