import { Link } from 'react-router-dom'
import { COMPANY_INFO } from '../../lib/companyInfo'

// 앱(쇼핑몰) 하단 푸터 — 고객센터·사업자정보·법적 링크. 실제 쇼핑몰 수준으로 구성.
// 사업자정보는 전자상거래법상 소비자가 확인 가능해야 하므로 홈 스크롤 하단에 상시 노출.
// (중개자 면책문구는 넣지 않는다 — 뷰티그라운드는 통신판매업자로 직접 책임. PG 반려 이력 참고)
//
// 2026-09-13 대표님이 직접 순서·내용을 정리해 다시 주심 — 상단 로그인/소비자상담실 탭과
// 굵은 상호명 줄(맨 아래 저작권과 중복)을 없애고, 법적 링크를 맨 위로, 나머지는 대표님이
// 준 순서(통신판매업신고→개인정보책임자→대표전화→대표메일→주소→대표이사→호스팅)로 재배치.
// 사업자등록번호만 대표님 목록에서 빠져 있었는데, 전자상거래법상 필수 표기 항목이라
// 빼지 않고 대표이사 줄에 붙여 유지했다(임의 삭제 아님, 보고 후 반영).
const bizDigits = COMPANY_INFO.bizNumber.replace(/-/g, '')
const FTC_URL = `https://www.ftc.go.kr/bizCommPop.do?wrkr_no=${bizDigits}`

const sep = <span className="text-rule" aria-hidden="true">|</span>

export default function AppFooter() {
  return (
    <footer className="bg-paper border-t border-rule">
      <div className="px-5 pt-5 pb-6">
        {/* 법적 링크 — 맨 위로 */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12px] pb-3 border-b border-rule">
          <Link to="/terms" className="text-ink-soft hover:text-ink transition-colors">이용약관</Link>
          {sep}
          <Link to="/privacy" className="text-ink font-semibold hover:text-ink transition-colors">개인정보처리방침</Link>
          {sep}
          <Link to="/company" className="text-ink-soft hover:text-ink transition-colors">회사소개</Link>
        </div>

        {/* 사업자 정보 */}
        <div className="pt-3 text-[11px] text-ink-faint leading-[1.6]">
          <p>
            통신판매업신고 {COMPANY_INFO.mailOrderNumber}{' '}
            <a
              href={FTC_URL}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-block px-1.5 py-px border border-rule text-[10.5px] text-ink-soft hover:bg-quiet transition-colors"
            >
              사업자정보확인
            </a>
          </p>
          <p>개인정보보호책임자 {COMPANY_INFO.privacyOfficer}</p>
          <p>대표전화 <a href={`tel:${COMPANY_INFO.csPhone}`} className="hover:text-ink-soft">{COMPANY_INFO.csPhone}</a>({COMPANY_INFO.csHours})</p>
          <p>대표메일 {COMPANY_INFO.csEmail}</p>
          <p>주소 {COMPANY_INFO.address}</p>
          <p>대표이사 {COMPANY_INFO.ceo}</p>
          <p>호스팅제공자 Vercel Inc.</p>
        </div>

        <p className="mt-4 text-[10.5px] text-ink-faint/80">
          © 2026 {COMPANY_INFO.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
