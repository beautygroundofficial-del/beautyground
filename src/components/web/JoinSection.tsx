import { Link } from 'react-router-dom'
import Button from '../common/Button'

const STEPS = [
  {
    step: '01',
    title: '회원가입',
    desc: '뷰티그라운드 파트너 포털에서 브랜드/셀러 담당자 계정을 생성합니다.',
    icon: '👤',
  },
  {
    step: '02',
    title: '입점 신청',
    desc: '브랜드 정보와 서류를 제출하면 본사 심사 후 승인 안내를 드립니다.',
    icon: '📝',
  },
]

const BENEFITS = [
  '백화점 3사 브랜드와 같은 무대에서 라이브 판매',
  '간편한 상품·라이브 등록 대시보드 제공',
  '투명한 매출·정산 관리',
]

export default function JoinSection() {
  return (
    <section className="py-20 md:py-28" id="join">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
            JOIN US
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-text">
            뷰티그라운드와 함께 라이브로 판매하세요
          </h2>
          <p className="text-text-sub text-[15px] mt-3">간단한 2단계로 입점을 시작하세요</p>
        </div>

        {/* 2단계 프로세스 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {STEPS.map(({ step, title, desc, icon }) => (
            <div
              key={step}
              className="bg-white rounded-md p-8 border relative overflow-hidden"
              style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
            >
              <div
                className="absolute top-6 right-6 text-[60px] font-serif font-bold text-cream-2 leading-none select-none"
                aria-hidden="true"
              >
                {step}
              </div>
              <div
                className="w-12 h-12 rounded-md flex items-center justify-center text-2xl mb-4"
                style={{ backgroundColor: '#f0ede8' }}
                aria-hidden="true"
              >
                {icon}
              </div>
              <h3 className="text-[20px] font-bold text-text mb-2">{title}</h3>
              <p className="text-[14px] text-text-sub leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* 혜택 체크리스트 */}
        <div
          className="bg-cream rounded-md p-6 border-l-[3px]"
          style={{ borderLeftColor: '#b8924a' }}
        >
          <p className="text-[14px] font-semibold text-text mb-3">파트너 혜택</p>
          <ul className="space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[14px] text-text-sub">
                <span
                  className="w-5 h-5 mt-0.5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-[12px] flex-shrink-0"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center mt-10">
          <Link to="/partner/register" className="inline-block">
            <Button variant="gold" size="lg" label="입점 신청하기" />
          </Link>
        </div>
      </div>
    </section>
  )
}
