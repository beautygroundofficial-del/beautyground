import { supabase } from './supabase'
import { claimMission } from './missions'

// 커뮤니티 애칭 — 글/댓글을 처음 쓰려고 할 때 없으면 만들게 한다(2026-09-18, supabase/user_nicknames.sql).
// 카카오/네이버 가입은 마찰 없이 그대로 두고, "남에게 보이는 순간"에만 걸리게 하는 설계.

export async function getMyNickname(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('user_nicknames').select('nickname').eq('user_id', user.id).maybeSingle()
  return (data as { nickname: string } | null)?.nickname ?? null
}

export interface SetNicknameResult {
  ok: boolean
  message: string
  awarded: number
}

export async function setMyNickname(nickname: string): Promise<SetNicknameResult> {
  const { data, error } = await supabase.rpc('set_my_nickname', { p_nickname: nickname })
  if (error) return { ok: false, message: '잠시 후 다시 시도해 주세요', awarded: 0 }
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.ok) return { ok: false, message: row?.message || '설정하지 못했어요', awarded: 0 }

  // 편의상 기존 화면들이 쓰는 user_metadata.name 폴백과도 맞춰둔다 — 실패해도 애칭 자체는 이미 저장됨
  await supabase.auth.updateUser({ data: { name: nickname, nickname } }).catch(() => {})
  const claim = await claimMission('nickname_set', 1)

  return { ok: true, message: row.message || '애칭이 설정됐어요', awarded: claim?.awarded ?? 0 }
}
