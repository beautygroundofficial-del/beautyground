import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import { supabase } from '../../lib/supabase'
import { getMyAffiliate } from '../../lib/affiliate'

// 파트너스 페이지(입구) — 앱 안에서 파트너스가 무엇인지 소개하고 [파트너스 회원가입]으로 보낸다.
// 이미 로그인 + 정보 등록까지 된 사람은 바로 개인 파트너스 페이지로, 로그인만 된 사람은 정보 등록으로.
export default function AppPartners() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (session) {
        const aff = await getMyAffiliate()
        if (!active) return
        navigate(aff ? '/app/partners/home' : '/app/partners/info', { replace: true })
        return
      }
      setChecking(false)
    })()
    return () => { active = false }
  }, [navigate])

  return (
    <AppFrame>
      <BackHeader title="파트너스" onBack={() => navigate('/app/mypage')} />
      {checking ? (
        <p className="px-5 py-10 text-center text-[13px] text-ink-faint">불러오는 중…</p>
      ) : (
        <section className="px-5 pt-8 pb-10">
          <p className="text-[11.5px] text-ink-faint leading-none mb-2">뷰티그라운드 파트너스</p>
          <h2 className="text-[20px] font-bold text-ink leading-snug">내 링크로 소개하고<br />판매수수료를 받아요</h2>
          <p className="text-[13.5px] text-ink-soft mt-3 leading-relaxed">
            앱에 있는 제품의 링크를 내 링크로 바꿔 친구·SNS에 올리면, 그 링크로 구매가 일어날 때마다
            판매금액의 <b className="text-ink">5%</b>가 쌓여요. 재고도, 배송도, 비용도 없어요.
          </p>

          <ol className="mt-6 space-y-3">
            {[
              ['파트너스 회원가입', '카카오·네이버·이메일 중 편한 방법으로'],
              ['개인정보·계좌 등록', '수수료를 받을 계좌를 한 번만 입력'],
              ['개인 파트너스 페이지', '제품 링크를 넣으면 내 링크가 만들어져요'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-ink text-paper text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
                <div><p className="text-[14px] font-semibold text-ink">{t}</p><p className="text-[12.5px] text-ink-soft">{d}</p></div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={() => navigate('/app/partners/signup')}
            className="mt-8 w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 focus:outline-none focus-visible:shadow-ring"
          >
            파트너스 회원가입
          </button>
          <p className="text-center text-[12px] text-ink-faint mt-3">이미 파트너스라면 같은 버튼으로 로그인돼요</p>

          <p className="text-[11.5px] text-ink-faint mt-8 leading-relaxed">
            링크를 공유해 소개하는 방식이에요. 다른 파트너를 모집하거나 하위 판매에 대한 수당은 없어요.
            수수료는 구매 확정 기준으로 매월 정산되며, 취소·환불된 주문은 제외돼요.
          </p>
        </section>
      )}
    </AppFrame>
  )
}
