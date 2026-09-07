import { useEffect, useState } from 'react'
import { IconMessageQuestion } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/common/Button'

// 오늘의 질문 관리 — 하루 한 개씩 날짜를 정해 걸어두는 화면. (2026-09-07)
//
// 손님 화면(홈)은 '오늘 날짜(KST)에 걸린 발행 상태 질문' 하나만 보여준다.
// 오늘 걸린 질문이 없으면 카드 자체가 안 뜨므로, 미리 며칠치를 채워두는 것이 좋다.
//
// ⚠️ 질문 문구는 대답을 재촉하지 않는 말투로. "오늘 뭐 했나요?"처럼 점검하듯 묻지 말고
//    "요즘 잠은 잘 주무세요?"처럼 안부를 묻듯 쓴다(이용자는 35~55세, 자기를 늘 뒤로 미루는 분들).

interface QuestionRow {
  id: string
  ask_date: string
  question: string
  hint: string | null
  status: 'draft' | 'published'
  created_at: string
  daily_answers: { count: number }[]
}

const inputCls =
  'w-full border border-rule rounded-control px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors bg-paper'

function todayKST() {
  // 브라우저가 어느 시간대에 있든 KST 날짜로 맞춘다(서버 판정이 Asia/Seoul 기준이라 어긋나면 안 된다).
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
}

const EMPTY = { ask_date: todayKST(), question: '', hint: '' }

export default function AdminDailyQuestions() {
  const [rows, setRows] = useState<QuestionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('daily_questions')
      .select('*, daily_answers(count)')
      .order('ask_date', { ascending: false })
      .limit(200)
    setRows((data ?? []) as QuestionRow[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY); setError('') }

  const save = async () => {
    if (!form.question.trim()) { setError('질문을 입력해 주세요.'); return }
    if (!form.ask_date) { setError('날짜를 선택해 주세요.'); return }
    setSaving(true); setError('')

    const payload = {
      ask_date: form.ask_date,
      question: form.question.trim(),
      hint: form.hint.trim() || null,
    }

    const q = editingId
      ? supabase.from('daily_questions').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      : supabase.from('daily_questions').insert(payload)

    const { error: err } = await q
    setSaving(false)
    if (err) {
      // 같은 날짜에 이미 질문이 있으면 unique 제약에 걸린다 — 하루 한 개가 원칙이라 그대로 알린다.
      setError(err.code === '23505' ? '그 날짜에는 이미 질문이 있습니다. 기존 질문을 수정해 주세요.' : `저장 실패: ${err.message}`)
      return
    }
    cancelEdit()
    void load()
  }

  const startEdit = (r: QuestionRow) => {
    setEditingId(r.id)
    setForm({ ask_date: r.ask_date, question: r.question, hint: r.hint ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleStatus = async (r: QuestionRow) => {
    const next = r.status === 'published' ? 'draft' : 'published'
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: next } : x)))
    const { error: err } = await supabase
      .from('daily_questions')
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq('id', r.id)
    if (err) setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: r.status } : x)))
  }

  const remove = async (r: QuestionRow) => {
    const n = r.daily_answers?.[0]?.count ?? 0
    const warn = n > 0
      ? `"${r.question}"\n\n답변 ${n}건도 함께 삭제됩니다. 되돌릴 수 없습니다. 계속할까요?`
      : `"${r.question}" 질문을 삭제할까요?`
    if (!window.confirm(warn)) return
    const { error: err } = await supabase.from('daily_questions').delete().eq('id', r.id)
    if (err) { setError(`삭제 실패: ${err.message}`); return }
    setRows((prev) => prev.filter((x) => x.id !== r.id))
    if (editingId === r.id) cancelEdit()
  }

  const today = todayKST()

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">오늘의 질문 관리</p>
      </header>

      <main className="max-w-[1100px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">오늘의 질문 관리</h1>
        <p className="text-[13px] text-ink-soft mb-6">
          홈 화면에 하루 한 개씩 걸리는 질문입니다. 손님은 한 줄로 답하고, 다른 사람의 답을 함께 봅니다.
          <br />
          그날 발행된 질문이 없으면 카드가 아예 뜨지 않으니 <strong>며칠치를 미리 채워두시는 것이 좋습니다.</strong>
          {' '}적립 포인트는 <strong>활동 미션 관리</strong>의 <code className="text-[12px]">question_answer</code> 미션에서 정합니다.
        </p>

        <div className="bg-paper rounded-md border border-rule p-5 mb-6">
          <p className="text-[13px] font-semibold text-ink mb-3">{editingId ? '질문 수정' : '새 질문 등록'}</p>
          <div className="grid sm:grid-cols-[180px_1fr] gap-3 mb-3">
            <input
              type="date"
              value={form.ask_date}
              onChange={(e) => setForm((f) => ({ ...f, ask_date: e.target.value }))}
              className={inputCls}
            />
            <input
              placeholder="질문 * — 예: 요즘 잠은 잘 주무세요?"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              className={inputCls}
            />
          </div>
          <input
            placeholder="곁들이는 한 줄 (선택) — 예: 짧게 한 줄이면 충분해요"
            value={form.hint}
            onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
            className={`${inputCls} mb-3`}
          />
          <div className="flex items-center gap-3">
            <Button
              variant="accent"
              size="sm"
              label={saving ? '저장 중…' : editingId ? '수정 저장' : '질문 등록'}
              disabled={saving}
              onClick={() => void save()}
            />
            {editingId && (
              <button type="button" onClick={cancelEdit} className="text-[12.5px] text-ink-soft hover:text-ink underline">
                취소
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5 whitespace-pre-line">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-24 bg-paper rounded-md border border-rule">
            <IconMessageQuestion size={40} className="text-rule mx-auto mb-3" />
            <p className="text-[14px] text-ink-faint">아직 등록된 질문이 없습니다</p>
          </div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">날짜</th>
                  <th className="px-4 py-3 font-medium">질문</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">답변</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const count = r.daily_answers?.[0]?.count ?? 0
                  const isToday = r.ask_date === today
                  return (
                    <tr key={r.id} className={`border-b border-rule last:border-b-0 ${isToday ? 'bg-signal-blue/5' : ''}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-ink-soft">{r.ask_date}</span>
                        {isToday && (
                          <span className="ml-2 inline-flex items-center rounded-pill bg-signal-blue/10 text-signal-blue px-2 py-0.5 text-[11px] font-semibold">
                            오늘
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink max-w-[420px]">
                        <p className="font-semibold truncate" title={r.question}>{r.question}</p>
                        {r.hint && <p className="text-[12px] text-ink-faint truncate">{r.hint}</p>}
                      </td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap tabular-nums">{count}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium ${
                          r.status === 'published' ? 'bg-signal-blue/10 text-signal-blue' : 'bg-quiet text-ink-faint'
                        }`}>
                          {r.status === 'published' ? '발행' : '임시저장'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => startEdit(r)} className="text-[12px] text-ink-soft hover:text-ink underline">
                            수정
                          </button>
                          <button type="button" onClick={() => void toggleStatus(r)} className="text-[12px] text-signal-blue hover:underline">
                            {r.status === 'published' ? '임시저장으로' : '발행하기'}
                          </button>
                          <button type="button" onClick={() => void remove(r)} className="text-[12px] text-signal-red hover:underline">
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
