import { getBoardComments, createBoardComment, deleteBoardComment } from '../../lib/board'
import CommentThread, { type CommentApi } from './CommentThread'

const boardApi: CommentApi = { list: getBoardComments, create: createBoardComment, remove: deleteBoardComment }

interface Props {
  postId: string
  count: number
  loggedIn: boolean
  onCountChange: (next: number) => void
  onAward?: (points: number) => void
  onNotice?: (msg: string) => void
  focusCommentId?: string | null
}

export default function BoardComments({ postId, ...props }: Props) {
  return <section className="px-5 pt-6">
    {props.count > 0 && <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">{props.count}개의 마음이 닿았어요</p>}
    <h2 className="text-[15px] font-bold text-ink leading-tight mb-4">댓글</h2>
    <CommentThread {...props} targetId={postId} api={boardApi} namespace="board" open spacious
      returnTo={`/app/board/${encodeURIComponent(postId)}`} />
  </section>
}
