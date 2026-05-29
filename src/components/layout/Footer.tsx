import { Link } from 'react-router-dom'

const FOOTER_LINKS = [
  { href: '/about', label: '회사소개' },
  { href: '/join', label: '입점안내' },
  { href: '/partnership', label: '광고·제휴' },
  { href: '/career', label: '채용' },
  { href: '/privacy', label: '개인정보처리방침' },
]

const LEGAL_LINKS = [
  { href: '/terms', label: '이용약관' },
  { href: '/privacy', label: '개인정보처리방침', bold: true },
  { href: '/legal', label: '법적고지' },
  { href: '/sitemap', label: '사이트맵' },
]

const SNS_LINKS = [
  { href: '#', label: 'YouTube', icon: '▶' },
  { href: '#', label: 'Facebook', icon: 'f' },
  { href: '#', label: 'Instagram', icon: '◎' },
]

export default function Footer() {
  return (
    <footer style={{ backgroundColor: '#0a0907' }} className="text-white/60">
      <div className="max-w-[1280px] mx-auto px-6 py-12">
        {/* 상단 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-white/10">
          <Link to="/" className="font-serif text-[22px] font-bold text-gold" aria-label="뷰티관 홈">
            뷰티관
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="푸터 메뉴">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link key={href} to={href} className="text-[13px] text-white/60 hover:text-white/90 transition-colors">
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            {SNS_LINKS.map(({ href, label, icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-[13px] text-white/60 hover:border-white/50 hover:text-white transition-colors"
              >
                <span aria-hidden="true">{icon}</span>
              </a>
            ))}
          </div>
        </div>

        {/* 법적 링크 */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-6">
          {LEGAL_LINKS.map(({ href, label, bold }) => (
            <Link
              key={href}
              to={href}
              className={`text-[12px] hover:text-white/90 transition-colors ${bold ? 'text-white/80 font-semibold' : 'text-white/50'}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* 사업자 정보 */}
        <div className="mt-4 text-[12px] text-white/35 leading-relaxed">
          <p>주식회사 뷰티관 | 대표이사: 홍길동 | 사업자등록번호: 123-45-67890</p>
          <p>통신판매업신고: 제2025-서울강남-0000호 | 주소: 서울특별시 강남구 테헤란로 123</p>
          <p className="mt-1">뷰티관은 통신판매중개자로서 거래 당사자가 아니며, 판매자가 제공하는 상품 정보 및 거래에 대한 책임을 지지 않습니다.</p>
        </div>

        <p className="mt-6 text-[12px] text-white/25">
          © 2025 Beauté-gwan Co., Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
