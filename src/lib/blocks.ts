import { supabase } from './supabase'

// 사용자 차단 — 앱 심사 조건(Apple 1.2 UGC: 차단 수단 필수, Google Play UGC 정책). 서버는 supabase/community_block_filter.sql.
// 차단하면 그 사람의 이야기·댓글·답변·소식이 나에게 안 보이고, 친구 관계는 양쪽 다 끊기며, 그 사람은 내 글에 댓글을 못 단다.
// 차단 목록은 마이페이지 > 계정 관리 > 차단한 사용자(/app/blocked)에서 풀 수 있다.
export const BLOCKS_CHANGED_EVENT = 'bg:blocks-changed'

export interface BlockedUser {
  user_id: string
  nickname: string | null
  created_at: string
}

function emitChanged() {
  try { window.dispatchEvent(new Event(BLOCKS_CHANGED_EVENT)) } catch { /* SSR·테스트 환경 무시 */ }
}

export async function blockUser(userId: string): Promise<{ ok: boolean; message: string }> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId })
  if (error) return { ok: false, message: error.message.includes('로그인') ? '로그인이 필요해요' : '차단하지 못했어요. 잠시 후 다시 시도해 주세요' }
  emitChanged()
  return { ok: true, message: '차단했어요. 이 사람의 이야기와 댓글이 더 이상 보이지 않아요' }
}

export async function unblockUser(userId: string): Promise<boolean> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId })
  if (error) return false
  emitChanged()
  return true
}

export async function getMyBlocks(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('get_my_blocks')
  if (error) return []
  return (data ?? []) as BlockedUser[]
}

// 특정 사용자를 내가 차단했는지 — 프로필·글 화면에서 버튼 상태용
export async function isBlockedByMe(userId: string): Promise<boolean> {
  const list = await getMyBlocks()
  return list.some((b) => b.user_id === userId)
}
