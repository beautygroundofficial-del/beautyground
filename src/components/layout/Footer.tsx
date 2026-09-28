import { Link } from 'react-router-dom'
import { COMPANY_INFO } from '../../lib/companyInfo'

// 라이브커머스(진행자 지원)·입점 신청(브랜드 모집)은 온라인몰과 당분간 분리 — 노출 안 함(2026-07-31)
const FOOTER_LINKS = [
  { href: '/about', label: '회사소개' },
  { href: '/privacy', label: '개인정보처리방침' },
  // 해외 바이어용 — 브랜드 모집이 아니라 뷰티그라운드가 직접 수출자로서 제안하는 채널(2026-08-15)
  { href: '/export', label: 'For Global Partners' },
  // 브랜드 파트너 허브 — 입점·비입점 브랜드 누구나 열람하는 정보 페이지(신청 폼 없음, 2026-08-24)
  { href: '/partners', label: '브랜드 파트너 허브' },
]

const LEGAL_LINKS = [
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침', bold: true },
  { href: '/account-delete', label: '계정 삭제 안내' },
  { href: '/about', label: '회사소개' },
]

export default function Footer() {
  return (
    <footer className="bg-paper border-t border-rule">
      <div className="max-w-[1280px] mx-auto px-6 py-12">
        {/* 상단 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-rule">
          <Link to="/" className="text-[22px] font-bold text-ink" aria-label="뷰티그라운드 홈">
            뷰티그라운드
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="푸터 메뉴">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link key={href} to={href} className="text-[13px] text-ink-soft hover:text-ink transition-colors">
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* 법적 링크 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-6">
          {LEGAL_LINKS.map(({ href, label, bold }) => (
            <Link
              key={href}
              to={href}
              className={`text-[12px] hover:text-ink transition-colors ${bold ? 'text-ink font-bold' : 'text-ink-faint'}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* 사업자 정보 */}
        <div className="mt-4 text-[12px] text-ink-faint leading-relaxed">
          <p>{COMPANY_INFO.name} | 대표: {COMPANY_INFO.ceo} | 사업자등록번호: {COMPANY_INFO.bizNumber}</p>
          <p>통신판매업신고: {COMPANY_INFO.mailOrderNumber} | 주소: {COMPANY_INFO.address}</p>
          <p>소비자상담실: {COMPANY_INFO.csPhone} ({COMPANY_INFO.csHours}) | 이메일: {COMPANY_INFO.csEmail}</p>
        </div>

        <p className="mt-6 text-[12px] text-ink-faint">
          © 2026 {COMPANY_INFO.name}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
