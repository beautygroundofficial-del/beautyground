import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { COMPANY_INFO } from '../../lib/companyInfo'

// 앱(쇼핑몰) 하단 푸터 — 고객센터·사업자정보·법적 링크. 실제 쇼핑몰 수준으로 구성.
// 사업자정보는 전자상거래법상 소비자가 확인 가능해야 하므로 홈 스크롤 하단에 상시 노출.
// (중개자 면책문구는 넣지 않는다 — 뷰티그라운드는 통신판매업자로 직접 책임. PG 반려 이력 참고)
const bizDigits = COMPANY_INFO.bizNumber.replace(/-/g, '')
const FTC_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${bizDigits}`

const sep = <span className="text-rule" aria-hidden="true">|</span>

export default function AppFooter() {
  // 로그인 상태와 무관하게 "로그인" 링크만 고정으로 떠 있었음(2026-09-09 지적) —
  // 이미 로그인한 손님한테는 로그인 화면으로 다시 보내는 대신 마이페이지로 보낸다.
  const [loggedIn, setLoggedIn] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <footer className="bg-paper border-t border-rule">
      <div className="px-5 pt-7 pb-9">
        {/* 상단 링크 탭 */}
        <nav className="flex items-center gap-4 text-[13px] font-semibold text-ink-soft pb-5 border-b border-rule" aria-label="하단 메뉴">
          {loggedIn ? (
            <Link to="/app/mypage" className="hover:text-ink transition-colors">마이페이지</Link>
          ) : (
            <Link to="/app/login" className="hover:text-ink transition-colors">로그인</Link>
          )}
          {sep}
          <a href={`tel:${COMPANY_INFO.csPhone}`} className="hover:text-ink transition-colors">소비자상담실</a>
        </nav>

        {/* 사업자 정보 */}
        <div className="pt-5 text-[11.5px] text-ink-faint leading-[1.75]">
          <p className="text-ink-soft font-semibold text-[12.5px] mb-1">{COMPANY_INFO.name}</p>
          <p>대표이사 {COMPANY_INFO.ceo} · 개인정보보호책임자 {COMPANY_INFO.privacyOfficer} · 사업자등록번호 {COMPANY_INFO.bizNumber}</p>
          <p>
            통신판매업신고 {COMPANY_INFO.mailOrderNumber}{' '}
            <a
              href={FTC_URL}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-block px-1.5 py-px border border-rule text-[11px] text-ink-soft hover:bg-quiet transition-colors"
            >
              사업자정보확인
            </a>
          </p>
          <p>대표전화 {COMPANY_INFO.csPhone} · 대표메일 {COMPANY_INFO.csEmail}</p>
          <p>주소 {COMPANY_INFO.address}</p>
          <p>호스팅제공자 Vercel Inc.</p>
        </div>

        {/* 소비자상담실 (호스팅제공자 아래) */}
        <div className="mt-5 text-[11.5px] text-ink-faint leading-[1.75]">
          <p className="text-ink-soft font-semibold text-[12.5px] mb-1">소비자상담실</p>
          <p>
            <a href={`tel:${COMPANY_INFO.csPhone}`} className="text-ink-soft">{COMPANY_INFO.csPhone}</a>
          </p>
          <p>운영시간 {COMPANY_INFO.csHours}</p>
        </div>

        {/* 법적 링크 */}
        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px]">
          <Link to="/terms" className="text-ink-soft hover:text-ink transition-colors">이용약관</Link>
          {sep}
          <Link to="/privacy" className="text-ink font-semibold hover:text-ink transition-colors">개인정보처리방침</Link>
          {sep}
          <Link to="/company" className="text-ink-soft hover:text-ink transition-colors">회사소개</Link>
        </div>

        <p className="mt-6 text-[11px] text-ink-faint/80">
          © 2026 {COMPANY_INFO.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
