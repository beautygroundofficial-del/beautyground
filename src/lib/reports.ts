import { supabase } from './supabase'

// 신고 — 속 이야기(board.ts reportBoardPost)를 제외한 사용자 생성 콘텐츠 전부. 서버는 supabase/community_block_filter.sql 4).
// 자동으로 가리지 않는다 — 운영자가 관리자 > 커뮤니티 신고에서 읽고 결정한다(오신고로 글이 사라지면 안 된다).
export type ReportTargetType = 'diary' | 'answer' | 'board_comment' | 'diary_comment' | 'answer_comment' | 'chat'

export async function reportContent(type: ReportTargetType, id: string | number, reason?: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.rpc('report_content', { p_target_type: type, p_target_id: String(id), p_reason: reason ?? null })
  if (error) return { ok: false, message: '잠시 후 다시 시도해 주세요' }
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? { ok: false, message: '잠시 후 다시 시도해 주세요' }) as { ok: boolean; message: string }
}

// 신고 사유를 한 줄 묻고 보낸다 — 화면마다 같은 흐름이라 여기서 묶는다. 취소하면 null.
export async function promptAndReport(type: ReportTargetType, id: string | number): Promise<string | null> {
  const reason = window.prompt('어떤 점이 불편했는지 짧게 알려주세요(선택)')
  if (reason === null) return null
  const res = await reportContent(type, id, reason || undefined)
  return res.message
}

export interface ContentReportRow {
  target_type: ReportTargetType
  target_id: string
  content: string | null
  nickname: string | null
  status: string | null
  target_created_at: string | null
  report_count: number
  last_reported_at: string
  reasons: string | null
}

export async function adminContentReports(): Promise<ContentReportRow[]> {
  const { data, error } = await supabase.rpc('admin_content_reports')
  if (error) return []
  return (data ?? []) as ContentReportRow[]
}

export async function adminSetContentStatus(type: ReportTargetType, id: string, status: 'visible' | 'hidden'): Promise<boolean> {
  const { error } = await supabase.rpc('admin_set_content_status', { p_target_type: type, p_target_id: id, p_status: status })
  return !error
}

export const REPORT_TYPE_LABEL: Record<ReportTargetType, string> = {
  diary: '하루 이야기',
  answer: '오늘의 답변',
  board_comment: '속 이야기 댓글',
  diary_comment: '하루 이야기 댓글',
  answer_comment: '답변 댓글',
  chat: '라이브 채팅',
}
