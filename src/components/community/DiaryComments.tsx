import { getDiaryComments, createDiaryComment, deleteDiaryComment } from '../../lib/diaries'
import { BubbleIcon } from './marks'
import CommentThread, { type CommentApi } from './CommentThread'

export function CommentToggle({ count, open, onClick }: { count: number; open: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      aria-label={count > 0 ? `댓글 ${count}개 ${open ? '접기' : '보기'}` : '댓글 남기기'}
      aria-expanded={open}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] transition-colors focus:outline-none focus-visible:shadow-ring ${open ? 'bg-quiet text-ink' : 'text-ink-soft hover:bg-quiet'}`}>
      <BubbleIcon size={18} />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  )
}

const diaryApi: CommentApi = { list: getDiaryComments, create: createDiaryComment, remove: deleteDiaryComment }

interface Props {
  diaryId: string
  open: boolean
  count: number
  loggedIn: boolean
  onCountChange: (next: number) => void
  onAward?: (points: number) => void
  onNotice?: (msg: string) => void
  focusCommentId?: string | null
}

export default function DiaryComments({ diaryId, ...props }: Props) {
  return <CommentThread {...props} targetId={diaryId} api={diaryApi} namespace="diary" allowReplies profileLinks
    returnTo={`/app/diary?focus=${encodeURIComponent(diaryId)}&comments=${encodeURIComponent(diaryId)}`} />
}
