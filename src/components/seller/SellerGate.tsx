import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import AppFrame from '../layout/AppFrame'
import BackHeader from '../layout/BackHeader'
import { supabase } from '../../lib/supabase'
import { getMyAffiliate, type Affiliate } from '../../lib/affiliate'

// 링크 셀러 화면 공통 문지기.
// 로그인 방식 = 쇼핑앱 계정 그대로(카카오·네이버·이메일, AppLogin.tsx). 별도 계정을 만들지 않는다 —
// 4060 고객이 "또 가입"하지 않게 하고, 주문 귀속(orders.user_id)과 같은 계정으로 묶기 위함(2026-09-26).
//   ① 로그인 안 됨 → 안내 + 로그인 버튼(/app/login, from=현재 경로)
//   ② 로그인됐지만 셀러 미가입 → requireJoined 면 가입 화면으로
//   ③ 가입됨 → children(affiliate, reload) 렌더
export type GateState = { session: boolean; affiliate: Affiliate | null; loading: boolean }

export default function SellerGate({
  title,
  requireJoined = true,
  children,
}: {
  title: string
  requireJoined?: boolean
  children: (g: { affiliate: Affiliate | null; reload: () => Promise<void> }) => ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [state, setState] = useState<GateState>({ session: false, affiliate: null, loading: true })

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setState({ session: false, affiliate: null, loading: false }); return }
    const aff = await getMyAffiliate()
    setState({ session: true, affiliate: aff, loading: false })
  }
  useEffect(() => { void load() }, [])

  useEffect(() => {
    if (state.loading || !state.session) return
    if (requireJoined && !state.affiliate && location.pathname !== '/app/seller/join') {
      navigate('/app/seller/join', { replace: true })
    }
  }, [state, requireJoined, navigate, location.pathname])

  if (state.loading) {
    return (
      <AppFrame>
        <BackHeader title={title} onBack={() => navigate('/app/mypage')} />
        <p className="px-5 py-10 text-center text-[13px] text-ink-faint">불러오는 중…</p>
      </AppFrame>
    )
  }

  if (!state.session) {
    return (
      <AppFrame>
        <BackHeader title={title} onBack={() => navigate('/app/mypage')} />
        <section className="px-5 pt-8 pb-10">
          <h2 className="text-[19px] font-bold text-ink leading-snug">내 링크로 소개하고<br />판매수수료를 받아요</h2>
          <p className="text-[13.5px] text-ink-soft mt-3 leading-relaxed">
            마음에 드는 상품의 링크를 내 링크로 바꿔 친구·SNS에 올리면, 그 링크로 구매가 일어날 때마다
            판매금액의 <b className="text-ink">5%</b>가 쌓여요. 재고도, 배송도, 비용도 없어요.
          </p>
          <ul className="mt-5 space-y-2 text-[13px] text-ink-soft">
            <li>① 쇼핑앱 계정으로 로그인 (카카오·네이버·이메일)</li>
            <li>② 이름·연락처·정산 계좌 입력</li>
            <li>③ 상품 링크 붙여넣기 → 내 링크 완성</li>
          </ul>
          <button
            type="button"
            onClick={() => navigate('/app/login', { state: { from: location.pathname } })}
            className="mt-7 w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 focus:outline-none focus-visible:shadow-ring"
          >
            로그인하고 시작하기
          </button>
          <p className="text-center text-[12px] text-ink-faint mt-3">처음이면 가입, 이미 하셨다면 로그인됩니다</p>
        </section>
      </AppFrame>
    )
  }

  return <>{children({ affiliate: state.affiliate, reload: load })}</>
}
