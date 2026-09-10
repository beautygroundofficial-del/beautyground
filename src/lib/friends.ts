import { supabase } from './supabase'
import type { Diary } from './diaries'

// 친구 맺기 — 신청 → 수락 → 친구(양방향). (2026-09-11 대표님 "유저끼리 친구 맺기 기능도 만들어줘")
// 서버는 supabase/friends.sql. 이름은 "친구"만 쓴다(타사 표현 "응원친구" 금지).
// 속 이야기(익명 게시판)에는 붙이지 않는다.

export type FriendStatus = 'none' | 'requested' | 'received' | 'friends'

// 여러 사람과의 관계 — 피드 카드 버튼용. 관계 없는 사람은 'none'.
export async function getFriendStatuses(userIds: string[]): Promise<Record<string, FriendStatus>> {
  const ids = Array.from(new Set(userIds)).filter(Boolean)
  const out: Record<string, FriendStatus> = {}
  if (ids.length === 0) return out
  const { data, error } = await supabase.rpc('get_friend_statuses', { p_user_ids: ids })
  if (error) return out
  for (const row of (data ?? []) as { user_id: string; status: FriendStatus }[]) out[row.user_id] = row.status
  return out
}

export async function requestFriend(userId: string): Promise<{ status: string; message: string }> {
  const fail = { status: 'error', message: '잠시 후 다시 시도해 주세요' }
  const { data, error } = await supabase.rpc('request_friend', { p_user_id: userId })
  if (error) return fail
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? fail) as { status: string; message: string }
}

export async function respondFriend(userId: string, accept: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('respond_friend', { p_user_id: userId, p_accept: accept })
  return !error && data === true
}

// 보낸 신청 취소 · 친구 끊기 — 둘 다 같은 함수
export async function removeFriend(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('remove_friend', { p_user_id: userId })
  return !error && data === true
}

export interface FriendRow { user_id: string; nickname: string | null; since: string }
export async function getMyFriends(): Promise<FriendRow[]> {
  const { data, error } = await supabase.rpc('get_my_friends')
  if (error) return []
  return (data ?? []) as FriendRow[]
}

export interface FriendRequestRow { user_id: string; nickname: string | null; direction: 'received' | 'sent'; created_at: string }
export async function getFriendRequests(): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase.rpc('get_friend_requests')
  if (error) return []
  return (data ?? []) as FriendRequestRow[]
}

export async function getFriendRequestCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_friend_request_count')
  if (error) return 0
  return Number(data ?? 0)
}

// 친구 글만 — 하루 이야기 "친구" 탭
export async function getFriendDiaryFeed(limit = 30, offset = 0): Promise<Diary[]> {
  const { data, error } = await supabase.rpc('get_friend_diary_feed', { p_limit: limit, p_offset: offset })
  if (error) return []
  return (data ?? []) as Diary[]
}
