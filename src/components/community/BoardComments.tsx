import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getBoardComments, createBoardComment, deleteBoardComment, type BoardComment,
} from '../../lib/board'

// 속 이야기 댓글 — DiaryComments 와 같은 규칙(펼쳐야 보임, 포인트는 남긴 뒤 조용히).
// 상세 화면에서는 처음부터 펼쳐 보인다 — 글 하나만 보는 화면이라 빽빽해질 일이 없다.

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

function timeAgo(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}

interface Props {
  postId: string
  count: number
  loggedIn: boolean
  myName: string | null
  onCountChange: (next: number) => void
  onAward?: (points: number) => void
  onNotice?: (msg: string) => void
}

export default function BoardComments({
  postId, count, loggedIn, myName, onCountChange, onAward, onNotice,
}: Props) {
  const navigate = useNavigate()
  const [list, setList] = useState<BoardComment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void getBoardComments(postId).then(setList) }, [postId])

  const submit = async () => {
    if (!loggedIn) { navigate('/app/login'); return }
    const text = draft.trim()
    if (!text) return

    setSaving(true)
    const res = await createBoardComment(postId, text, myName)
    setSaving(false)
    if (!res.comment_id) { onNotice?.(res.message || '남기지 못했어요'); return }

    setDraft('')
    setList(await getBoardComments(postId))
    onCountChange(count + 1)
    if (res.awarded > 0) onAward?.(res.awarded)
  }

  const remove = async (c: BoardComment) => {
    if (!window.confirm('이 댓글을 지울까요?')) return
    const ok = await deleteBoardComment(c.id)
    if (!ok) { onNotice?.('지우지 못했어요'); return }
    setList((prev) => (prev ?? []).filter((x) => x.id !== c.id))
    onCountChange(Math.max(0, count - 1))
  }

  return (
    <section className="px-5 pt-6">
      <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">
        {count > 0 ? `${count}개의 마음이 닿았어요` : '아직 댓글이 없어요'}
      </p>
      <h2 className="text-[15px] font-bold text-ink leading-tight mb-4">댓글</h2>

      {list === null ? (
        <p className="text-[12.5px] text-ink-faint">불러오는 중…</p>
      ) : (
        list.length > 0 && (
          <ul className="space-y-3.5 mb-4">
            {list.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] text-ink leading-relaxed whitespace-pre-wrap">{c.content}</p>
                  <p className="text-[11px] text-ink-faint mt-1">
                    {c.is_mine ? '나' : maskName(c.nickname)} · {timeAgo(c.created_at)}
                  </p>
                </div>
                {c.is_mine && (
                  <button type="button" onClick={() => void remove(c)} className="shrink-0 text-[11px] text-ink-faint">
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
          rows={2}
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
    </section>
  )
}
