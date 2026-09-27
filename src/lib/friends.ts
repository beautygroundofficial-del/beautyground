import { supabase } from './supabase'
import type { Diary } from './diaries'

// 친구 맺기 — 신청 → 수락 → 친구(양방향). (2026-09-11 대표님 "유저끼리 친구 맺기 기능도 만들어줘")
// 서버는 supabase/friends.sql. 이름은 "친구"만 쓴다(타사 표현 "응원친구" 금지).
// 속 이야기(익명 게시판)에는 붙이지 않는다.

export type FriendStatus = 'none' | 'requested' | 'received' | 'friends'
export const FRIENDS_CHANGED_EVENT = 'bg:friends-changed'

interface ReadOptions { throwOnError?: boolean }

function changed() {
  window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT))
}

// 여러 사람과의 관계 — 피드 카드 버튼용. 관계 없는 사람은 'none'.
export async function getFriendStatuses(userIds: string[], options: ReadOptions = {}): Promise<Record<string, FriendStatus>> {
  const ids = Array.from(new Set(userIds)).filter(Boolean)
  const out: Record<string, FriendStatus> = {}
  if (ids.length === 0) return out
  const { data, error } = await supabase.rpc('get_friend_statuses', { p_user_ids: ids })
  if (error) {
    if (options.throwOnError) throw error
    return out
  }
  const priority: Record<FriendStatus, number> = { none: 0, requested: 1, received: 2, friends: 3 }
  for (const row of (data ?? []) as { user_id: string; status: FriendStatus }[]) {
    if (priority[row.status] > priority[out[row.user_id] ?? 'none']) out[row.user_id] = row.status
  }
  return out
}

export async function requestFriend(userId: string): Promise<{ status: string; message: string }> {
  const fail = { status: 'error', message: '잠시 후 다시 시도해 주세요' }
  try {
    const { data, error } = await supabase.rpc('request_friend', { p_user_id: userId })
    if (error) return fail
    const row = (Array.isArray(data) ? data[0] : data) as { status: string; message: string } | null
    if (row?.status === 'requested' || row?.status === 'friends') changed()
    return row ?? fail
  } catch {
    return fail
  }
}

export async function respondFriend(userId: string, accept: boolean): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('respond_friend', { p_user_id: userId, p_accept: accept })
    const ok = !error && data === true
    if (ok) changed()
    return ok
  } catch {
    return false
  }
}

// 보낸 신청 취소 · 친구 끊기 — 둘 다 같은 함수
export async function removeFriend(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('remove_friend', { p_user_id: userId })
    const ok = !error && data === true
    if (ok) changed()
    return ok
  } catch {
    return false
  }
}

export interface FriendRow { user_id: string; nickname: string | null; since: string }
export async function getMyFriends(options: ReadOptions = {}): Promise<FriendRow[]> {
  const { data, error } = await supabase.rpc('get_my_friends')
  if (error) {
    if (options.throwOnError) throw error
    return []
  }
  return (data ?? []) as FriendRow[]
}

export interface FriendRequestRow { user_id: string; nickname: string | null; direction: 'received' | 'sent'; created_at: string }
export async function getFriendRequests(options: ReadOptions = {}): Promise<FriendRequestRow[]> {
  const { data, error } = await supabase.rpc('get_friend_requests')
  if (error) {
    if (options.throwOnError) throw error
    return []
  }
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
