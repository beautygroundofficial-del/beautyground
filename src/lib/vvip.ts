import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// 현재 로그인 사용자가 VVIP(app_vvip 등록 이메일, 대표님 수동 지정)인지 판별.
// DB의 is_vvip() 함수를 호출한다(supabase/vvip_members.sql 실행 후 동작).
// 함수가 아직 없거나 비로그인이면 false — fail-closed(useIsStaff와 동일 패턴).
export function useIsVvip(): { loading: boolean; isVvip: boolean } {
  const [state, setState] = useState<{ loading: boolean; isVvip: boolean }>({
    loading: true,
    isVvip: false,
  })

  useEffect(() => {
    let active = true
    supabase.rpc('is_vvip').then(({ data, error }) => {
      if (!active) return
      setState({ loading: false, isVvip: !error && data === true })
    })
    return () => {
      active = false
    }
  }, [])

  return state
}

// 백화점 입점 브랜드는 20% 할인(백화점 수수료가 없는 온라인 판매분이라 그만큼 할인 여력이 생김),
// 그 외 온라인 전용 브랜드는 30% 할인(2026-09-03 대표님 지시). 적립은 없음 — 할인만.
export function vvipDiscountRate(isDeptStoreBrand: boolean): number {
  return isDeptStoreBrand ? 0.2 : 0.3
}

export function vvipPrice(price: number, isDeptStoreBrand: boolean): number {
  return Math.round(price * (1 - vvipDiscountRate(isDeptStoreBrand)))
}

// partner_id별 백화점 입점 여부 조회 — VVIP 할인율(20%/30%) 판별에 쓰인다.
// AppCart.tsx·AppOrder.tsx가 각자 따로 구현하고 있던 걸 하나로 합침(2026-09-14).
export async function getVvipDeptStoreMap(partnerIds: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>()
  if (partnerIds.length === 0) return map
  const { data } = await supabase.from('partners').select('id, is_dept_store_brand').in('id', partnerIds)
  for (const p of (data ?? []) as { id: string; is_dept_store_brand: boolean }[]) {
    map.set(p.id, p.is_dept_store_brand)
  }
  return map
}
