import { supabase } from './supabase'
import type { Partner } from './types'

// 현재 로그인한 사용자의 파트너 레코드 조회 (없으면 null)
export async function getMyPartner(): Promise<Partner | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return (data as Partner | null) ?? null
}
