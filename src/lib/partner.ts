import { supabase } from './supabase'
import type { Partner } from './types'

// 현재 로그인한 사용자의 파트너 레코드 조회 (없으면 null)
// user id 는 getSession()(로컬 세션, 네트워크 없음)으로 얻는다.
// getUser()는 매번 네트워크 검증이라 동시 호출 시 일시적으로 null 이 떨어져
// (사이드바 vs 상품관리) 승인 상태 판정이 엇갈리는 회귀가 있었다.
export async function getMyPartner(): Promise<Partner | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null

  const { data } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return (data as Partner | null) ?? null
}
