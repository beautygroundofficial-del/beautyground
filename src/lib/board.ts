import { supabase } from './supabase'
import type { ReactionKind } from './dailyQuestion'

// 속 이야기(손님 게시판) — 주제별로 속마음을 꺼내놓는 곳. (2026-09-10)
//
// 히로인스 게시판을 분석해 기능만 가져오고 이름·구조는 새로 지었다.
//   · 카테고리 7개(15개를 묶음), 제목 없이 본문만, 최신순만, 숫자 0이면 감춤
//   · 공감·댓글은 일기(diaries)와 같은 방식 — ReactionBar 를 그대로 쓴다
// ⚠️ 카테고리 이름은 타사 표현 금지 목록(옵시디언)의 대조표를 따른다. 화면에 원문을 쓰지 않는다.

// 카테고리는 데이터(옵시디언 리서치) 근거를 확인하며 하나씩 늘려간다. (2026-09-12)
// 'menopause' 첫 추가 — 50대 여성 최대 관심사로 확인됐는데 기존 'body'(건강·체력·운동)엔
// 안 묻어나서 못 찾던 것으로 보임. 정확한 이름·위치는 계속 다듬을 수 있음(운영 반영 전).
export type BoardCategory = 'kids' | 'spouse' | 'parents' | 'body' | 'menopause' | 'mind' | 'living' | 'chat'

export const BOARD_CATEGORIES: { key: BoardCategory; label: string; hint: string }[] = [
  { key: 'kids',      label: '아이 키우는 이야기',   hint: '어리든 다 컸든' },
  { key: 'spouse',    label: '남편이랑 사는 이야기', hint: '부부·시댁·헤어짐까지' },
  { key: 'parents',   label: '부모님 생각나는 날',   hint: '돌봄, 그리움' },
  { key: 'body',      label: '몸이 달라지는 이야기', hint: '건강·체력·운동' },
  { key: 'menopause', label: '갱년기 이야기',        hint: '몸도 마음도 달라지는 그 시기' },
  { key: 'mind',      label: '마음이 힘든 날',       hint: '감정, 사람 사이' },
  { key: 'living',    label: '살림하는 이야기',      hint: '돈·일·노후' },
  { key: 'chat',      label: '그냥 하는 이야기',     hint: '취미·여행·잡담' },
]

export const categoryLabel = (key: string) =>
  BOARD_CATEGORIES.find((c) => c.key === key)?.label ?? '이야기'

export interface BoardPost {
  id: string
  user_id: string
  nickname: string | null
  category: BoardCategory
  content: string
  images: string[]
  is_mine: boolean
  created_at: string
  pat: number
  same: number
  cheer: number
  my_kind: ReactionKind | null
  comment_count: number
  video_url: string | null
  // 하트 — board_likes.sql 실행 전엔 RPC 가 안 돌려줘서 undefined → 화면은 하트를 숨긴다 (2026-09-11)
  like_count?: number
  liked_by_me?: boolean
}

export async function toggleBoardLike(postId: string): Promise<{ liked: boolean; like_count: number } | null> {
  const { data, error } = await supabase.rpc('toggle_board_like', { p_post_id: postId })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as { liked: boolean; like_count: number } | null
}

export async function getBoardFeed(categories: BoardCategory[] = [], limit = 30, offset = 0): Promise<BoardPost[]> {
  const { data, error } = await supabase.rpc('get_board_feed', {
    p_categories: categories, p_limit: limit, p_offset: offset,
  })
  if (error) return []
  return (data ?? []) as BoardPost[]
}

export async function getBoardPost(id: string): Promise<BoardPost | null> {
  const { data, error } = await supabase.rpc('get_board_post', { p_id: id })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as BoardPost | null
}

export interface CreateBoardPostResult {
  post_id: string | null
  awarded: number
  message: string
}

export async function createBoardPost(
  category: BoardCategory, content: string, images: string[] = [], nickname?: string | null, video?: string | null,
): Promise<CreateBoardPostResult | null> {
  const { data, error } = await supabase.rpc('create_board_post', {
    p_category: category, p_content: content, p_images: images, p_nickname: nickname ?? null, p_video: video ?? null,
  })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as CreateBoardPostResult | null
}

// 고쳐 쓰기 — 본인 글만(RLS board_posts_own_all). 포인트는 다시 주지 않는다.
export async function updateBoardPost(
  id: string, patch: { category: BoardCategory; content: string; images: string[]; video_url: string | null },
): Promise<boolean> {
  const { error } = await supabase
    .from('board_posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  return !error
}

// 내가 쓴 속 이야기 — 숨김 처리된 글도 나에게는 보인다(status 로 표시)
export type MyBoardPost = BoardPost & { status: 'visible' | 'hidden' }

export async function getMyBoardPosts(limit = 30, offset = 0): Promise<MyBoardPost[]> {
  const { data, error } = await supabase.rpc('get_my_board_posts', { p_limit: limit, p_offset: offset })
  if (error) return []
  return (data ?? []) as MyBoardPost[]
}

// ── 새 소식 — 내 글에 달린 댓글·공감 ────────────────────────────────────
export interface NewsItem {
  // answer_* 는 news_answers.sql 실행 후부터 온다(오늘의 질문 답변, 2026-09-11)
  kind: 'board_comment' | 'board_reaction' | 'diary_comment' | 'diary_reaction' | 'answer_comment' | 'answer_reaction'
  target_type: 'board' | 'diary' | 'answer'
  target_id: string
  actor_nickname: string | null
  // 댓글 단 사람(news_actor.sql 이후) — 공감은 익명이라 null (2026-09-12)
  actor_user_id?: string | null
  excerpt: string
  comment_text: string | null
  reaction_kind: ReactionKind | null
  created_at: string
  is_new: boolean
}

export async function getMyNews(limit = 30): Promise<NewsItem[]> {
  const { data, error } = await supabase.rpc('get_my_news', { p_limit: limit })
  if (error) return []
  return (data ?? []) as NewsItem[]
}

export async function getMyNewsCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_my_news_count')
  if (error) return 0
  return Number(data ?? 0)
}

export async function markNewsSeen(): Promise<void> {
  await supabase.rpc('mark_news_seen')
}

// ── 관리자 — 신고된 글 ───────────────────────────────────────────────────
export interface BoardReportRow {
  post_id: string
  category: string
  content: string
  nickname: string | null
  status: 'visible' | 'hidden'
  post_created_at: string
  report_count: number
  last_reported_at: string
  reasons: string | null
}

export async function adminBoardReports(): Promise<BoardReportRow[]> {
  const { data, error } = await supabase.rpc('admin_board_reports')
  if (error) return []
  return (data ?? []) as BoardReportRow[]
}

// 숨김/복구 — 관리자 RLS(board_posts_admin_all)로 직접 update
export async function setBoardPostStatus(id: string, status: 'visible' | 'hidden'): Promise<boolean> {
  const { error } = await supabase.from('board_posts').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  return !error
}

export async function deleteBoardPost(id: string): Promise<boolean> {
  const { error } = await supabase.from('board_posts').delete().eq('id', id)
  return !error
}

export async function reportBoardPost(id: string, reason?: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc('report_board_post', { p_post_id: id, p_reason: reason ?? null })
  if (error) return { ok: false, message: '잠시 후 다시 시도해 주세요' }
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? { ok: false, message: '잠시 후 다시 시도해 주세요' }) as { ok: boolean; message: string }
}

// ── 댓글 ───────────────────────────────────────────────────────────────────
export interface BoardComment {
  id: string
  nickname: string | null
  content: string
  created_at: string
  is_mine: boolean
}

export async function getBoardComments(postId: string, limit = 50): Promise<BoardComment[]> {
  const { data, error } = await supabase.rpc('get_board_comments', {
    p_post_id: postId, p_limit: limit, p_offset: 0,
  })
  if (error) return []
  return (data ?? []) as BoardComment[]
}

export interface CreateBoardCommentResult {
  comment_id: string | null
  awarded: number
  message: string
}

export async function createBoardComment(
  postId: string, content: string, nickname?: string | null,
): Promise<CreateBoardCommentResult> {
  const fail: CreateBoardCommentResult = { comment_id: null, awarded: 0, message: '잠시 후 다시 시도해 주세요' }
  const { data, error } = await supabase.rpc('create_board_comment', {
    p_post_id: postId, p_content: content, p_nickname: nickname ?? null,
  })
  if (error) return fail
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? fail) as CreateBoardCommentResult
}

export async function deleteBoardComment(commentId: string): Promise<boolean> {
  const { error } = await supabase.from('board_comments').delete().eq('id', commentId)
  return !error
}
