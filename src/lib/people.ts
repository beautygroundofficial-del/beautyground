import { supabase } from './supabase'
import type { Diary } from './diaries'
import type { DiaryPet } from './pets'

// 그 사람의 이야기 — 닉네임을 누르면 오는 페이지. (2026-09-12, 커뮤니티 로드맵 4-10 A1)
// 서버는 supabase/people.sql. 속 이야기(익명)는 포함하지 않는다.

export interface PersonProfile {
  user_id: string
  nickname: string | null
  diary_count: number
  since: string | null
  pets: DiaryPet[]
  is_me: boolean
}

export async function getUserProfile(userId: string): Promise<PersonProfile | null> {
  const { data, error } = await supabase.rpc('get_user_profile', { p_user_id: userId })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as PersonProfile | null
}

export async function getUserDiaries(userId: string, limit = 30, offset = 0): Promise<Diary[]> {
  const { data, error } = await supabase.rpc('get_user_diary_feed', { p_user_id: userId, p_limit: limit, p_offset: offset })
  if (error) return []
  return (data ?? []) as Diary[]
}
