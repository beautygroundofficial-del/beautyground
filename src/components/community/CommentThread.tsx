import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// 댓글 펼침 패널(공용) — 오늘의 질문 답변 등 DiaryComments 와 같은 규칙으로 댓글을 붙일 곳이 늘어나서 뺐다. (2026-09-11)
// 어디에 붙는지는 api 로 넘긴다(목록·쓰기·지우기). open 일 때만 그리고, 목록은 처음 열릴 때 한 번 불러온다.
// 포인트는 버튼에 써 붙이지 않는다 — 남긴 뒤에 조용히 알린다.

export interface CommentRow {
  id: string
  nickname: string | null
  content: string
  created_at: string
  is_mine: boolean
}

export interface CommentApi {
  list: (targetId: string) => Promise<CommentRow[]>
  create: (targetId: string, content: string, nickname: string | null) => Promise<{ comment_id: string | null; awarded: number; message: string }>
  remove: (commentId: string) => Promise<boolean>
}

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

interface Props {
  targetId: string
  api: CommentApi
  open: boolean
  count: number
  loggedIn: boolean
  myName: string | null
  onCountChange: (next: number) => void
  onAward?: (points: number) => void
  onNotice?: (msg: string) => void
}

export default function CommentThread({
  targetId, api, open, count, loggedIn, myName, onCountChange, onAward, onNotice,
}: Props) {
  const navigate = useNavigate()
  const [list, setList] = useState<CommentRow[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && list === null) void api.list(targetId).then(setList)
  }, [open, list, targetId, api])

  if (!open) return null

  const submit = async () => {
    if (!loggedIn) { navigate('/app/login'); return }
    const text = draft.trim()
    if (!text) return
    setSaving(true)
    const res = await api.create(targetId, text, myName)
    setSaving(false)
    if (!res.comment_id) { onNotice?.(res.message || '남기지 못했어요'); return }
    setDraft('')
    setList(await api.list(targetId))
    onCountChange(count + 1)
    if (res.awarded > 0) onAward?.(res.awarded)
  }

  const remove = async (c: CommentRow) => {
    if (!window.confirm('이 댓글을 지울까요?')) return
    const ok = await api.remove(c.id)
    if (!ok) { onNotice?.('지우지 못했어요'); return }
    setList((prev) => (prev ?? []).filter((x) => x.id !== c.id))
    onCountChange(Math.max(0, count - 1))
  }

  return (
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
                  <p className="text-[11px] text-ink-faint mt-0.5">{c.is_mine ? '나' : maskName(c.nickname)}</p>
                </div>
                {c.is_mine && (
                  <button type="button" onClick={() => void remove(c)} className="shrink-0 text-[11px] text-ink-faint">삭제</button>
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
  )
}
