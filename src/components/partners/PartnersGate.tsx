import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../layout/AppFrame'
import BackHeader from '../layout/BackHeader'
import { supabase } from '../../lib/supabase'
import { getMyAffiliate, type Affiliate } from '../../lib/affiliate'

// 파트너스 흐름 문지기 (2026-09-26 대표님 확정 순서)
//   ① /app/partners        파트너스 페이지(입구) → [파트너스 회원가입]
//   ② /app/partners/signup 파트너스 회원가입(카카오·네이버·이메일 — 쇼핑 계정과 같은 로그인이지만 전용 화면)
//   ③ /app/partners/info   개인정보·계좌 등록(가입 직후) / 수정(이후)
//   ④ /app/partners/home   개인 파트너스 페이지 — 제품 링크 → 개인 링크 생성, 내 링크·판매·정산
// 이 컴포넌트는 ③·④ 이하 화면을 감싼다: 로그인 없으면 ①로, 로그인됐지만 정보 미등록이면 ③으로 보낸다.
export default function PartnersGate({
  title,
  requireInfo = true,
  children,
}: {
  title: string
  requireInfo?: boolean
  children: (g: { affiliate: Affiliate | null; reload: () => Promise<void> }) => ReactNode
}) {
  const navigate = useNavigate()
  const [state, setState] = useState<{ loading: boolean; session: boolean; affiliate: Affiliate | null }>({ loading: true, session: false, affiliate: null })

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setState({ loading: false, session: false, affiliate: null }); return }
    const aff = await getMyAffiliate()
    setState({ loading: false, session: true, affiliate: aff })
  }
  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (state.loading) return
    if (!state.session) { navigate('/app/partners', { replace: true }); return }
    if (requireInfo && !state.affiliate) navigate('/app/partners/info', { replace: true })
  }, [state, requireInfo, navigate])

  if (state.loading || !state.session || (requireInfo && !state.affiliate)) {
    return (
      <AppFrame>
        <BackHeader title={title} onBack={() => navigate('/app/partners')} />
        <p className="px-5 py-10 text-center text-[13px] text-ink-faint">불러오는 중…</p>
      </AppFrame>
    )
  }
  return <>{children({ affiliate: state.affiliate, reload: load })}</>
}
