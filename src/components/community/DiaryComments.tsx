import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getDiaryComments, createDiaryComment, deleteDiaryComment, type DiaryComment,
} from '../../lib/diaries'

// 이야기 댓글 — 펼쳐야 보인다. (2026-09-07 → 2026-09-11 버튼과 패널을 분리)
//
// 카드마다 댓글을 항상 펼쳐두면 피드가 빽빽해져서, 히로인스 게시판을 보고 대표님이 지적하신
// "읽을 게 너무 많아 답답하다"가 그대로 재현된다. 그래서 개수만 보이고 누르면 열린다.
// 버튼(CommentToggle)은 카드 아래 줄("수정 삭제" 옆)에 하트와 나란히 두고, 패널(DiaryComments)은 그 밑에 펼친다.
//
// 포인트는 버튼에 써 붙이지 않는다 — 남긴 뒤에 조용히 알린다.

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

// 말풍선 버튼 — 글자("댓글 남기기") 대신 아이콘 하나, 개수는 있을 때만
export function CommentToggle({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `댓글 ${count}개 ${open ? '접기' : '보기'}` : '댓글 남기기'}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] transition-colors focus:outline-none focus-visible:shadow-ring ${
        open ? 'bg-quiet text-ink' : 'text-ink-soft hover:bg-quiet'
      }`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 3.5V16A2.5 2.5 0 0 1 4 13.5z" />
      </svg>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  )
}

interface Props {
  diaryId: string
  open: boolean
  count: number
  loggedIn: boolean
  myName: string | null
  onCountChange: (next: number) => void
  onAward?: (points: number) => void
  onNotice?: (msg: string) => void
}

// 펼침 패널 — open 일 때만 그린다. 목록은 처음 열릴 때 한 번 불러온다.
export default function DiaryComments({
  diaryId, open, count, loggedIn, myName, onCountChange, onAward, onNotice,
}: Props) {
  const navigate = useNavigate()
  const [list, setList] = useState<DiaryComment[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && list === null) void getDiaryComments(diaryId).then(setList)
  }, [open, list, diaryId])

  if (!open) return null

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
  )
}
