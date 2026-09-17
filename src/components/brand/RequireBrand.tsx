import { useEffect, useState } from 'react'
import { Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { getMyPartner } from '../../lib/partner'

// 브랜드사 전용 라우트 가드.
// RequireBrandAuth(로그인 여부)만으로는 일반 쇼핑 고객도 URL로 /brand/* 에 직접 접근해
// 페이지 껍데기가 열리므로, partners 테이블에 본인 레코드가 실제로 연결돼 있는지 한 번 더 확인한다.
// (RequireHost.tsx와 동일 패턴)
//
// ?as=<partnerId> — 관리자가 "이 브랜드로 보기"를 눌렀을 때만 붙는다(2026-09-18).
// getMyPartner가 관리자 여부를 RLS로 확인하므로 여기서는 그냥 넘기기만 한다.
export default function RequireBrand() {
  const [searchParams] = useSearchParams()
  const asPartnerId = searchParams.get('as') ?? undefined
  const [loading, setLoading] = useState(true)
  const [isBrand, setIsBrand] = useState(false)

  useEffect(() => {
    let active = true
    getMyPartner(asPartnerId).then((p) => {
      if (active) { setIsBrand(!!p); setLoading(false) }
    })
    return () => { active = false }
  }, [asPartnerId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-hint text-[14px]">
        불러오는 중…
      </div>
    )
  }

  if (!isBrand) {
    return <Navigate to="/app/home" replace />
  }

  return <Outlet />
}
