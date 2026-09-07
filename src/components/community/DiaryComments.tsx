import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getDiaryComments, createDiaryComment, deleteDiaryComment, type DiaryComment,
} from '../../lib/diaries'

// 이야기 댓글 — 펼쳐야 보인다. (2026-09-07)
//
// 카드마다 댓글을 항상 펼쳐두면 피드가 빽빽해져서, 히로인스 게시판을 보고 대표님이 지적하신
// "읽을 게 너무 많아 답답하다"가 그대로 재현된다. 그래서 개수만 보이고 누르면 열린다.
//
// 포인트는 버튼에 써 붙이지 않는다 — 남긴 뒤에 조용히 알린다.

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

interface Props {
  diaryId: string
  count: number
  loggedIn: boolean
  myName: string | null
  onCountChange: (next: number) => void
  onAward?: (points: number) => void
  onNotice?: (msg: string) => void
}

export default function DiaryComments({
  diaryId, count, loggedIn, myName, onCountChange, onAward, onNotice,
}: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<DiaryComment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && list === null) setList(await getDiaryComments(diaryId))
  }

  const submit = async () => {
    if (!loggedIn) { navigate('/app/login'); return }
    const text = draft.trim()
    if (!text) return

    setSaving(true)
    const res = await createDiaryComment(diaryId, text, myName)
    setSaving(false)
    if (!res.comment_id) { onNotice?.(res.message || '남기지 못했어요'); return }

    setDraft('')
    setList(await getDiaryComments(diaryId))
    onCountChange(count + 1)
    if (res.awarded > 0) onAward?.(res.awarded)
  }

  const remove = async (c: DiaryComment) => {
    if (!window.confirm('이 댓글을 지울까요?')) return
    const ok = await deleteDiaryComment(c.id)
    if (!ok) { onNotice?.('지우지 못했어요'); return }
    setList((prev) => (prev ?? []).filter((x) => x.id !== c.id))
    onCountChange(Math.max(0, count - 1))
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => void toggle()}
        className="text-[12px] text-ink-soft focus:outline-none focus-visible:shadow-ring"
      >
        {count > 0 ? `댓글 ${count}` : '댓글 남기기'}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-rule">
          {list === null ? (
            <p className="text-[12.5px] text-ink-faint">불러오는 중…</p>
          ) : (
            list.length > 0 && (
              <ul className="space-y-2.5 mb-3">
                {list.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">{c.content}</p>
                      <p className="text-[11px] text-ink-faint mt-0.5">
                        {c.is_mine ? '나' : maskName(c.nickname)}
                      </p>
                    </div>
                    {c.is_mine && (
                      <button
                        type="button"
                        onClick={() => void remove(c)}
                        className="shrink-0 text-[11px] text-ink-faint"
                      >
                        삭제
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => { if (!loggedIn) navigate('/app/login') }}
              rows={1}
              maxLength={500}
              placeholder="따뜻한 한마디를 남겨주세요"
              className="flex-1 resize-none rounded-control border border-rule bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving || !draft.trim()}
              className="shrink-0 px-3.5 py-2 rounded-control bg-ink text-paper text-[12.5px] font-semibold disabled:opacity-40"
            >
              {saving ? '…' : '남기기'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
