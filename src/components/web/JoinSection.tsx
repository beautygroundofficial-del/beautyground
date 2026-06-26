import { Link } from 'react-router-dom'
import Button from '../common/Button'

const STEPS = [
  {
    step: '01',
    title: '회원가입',
    desc: '뷰티관 파트너 포털에서 브랜드/백화점 담당자 계정을 생성합니다.',
    icon: '👤',
  },
  {
    step: '02',
    title: '입점신청',
    desc: '브랜드 정보, 상품 카탈로그, BA 정보를 등록하고 입점 심사를 신청합니다.',
    icon: '📝',
  },
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
            입점 안내
          </h2>
          <p className="text-text-sub text-[15px] mt-3">간단한 2단계로 뷰티관에 입점하세요</p>
        </div>

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

        {/* 안내 박스 */}
        <div
          className="bg-cream rounded-md p-6 border-l-[3px]"
          style={{ borderLeftColor: '#b8924a' }}
        >
          <p className="text-[14px] font-semibold text-text mb-1">입점 안내</p>
          <ul className="text-[13px] text-text-sub space-y-1.5">
            <li>• 롯데·신세계·현대 백화점 공식 파트너 브랜드에 한해 입점 신청이 가능합니다.</li>
            <li>• 입점 심사는 신청 후 영업일 기준 5~7일 내 완료됩니다.</li>
            <li>• 공식 BA 출연이 필수이며, 사전 교육 후 라이브를 진행합니다.</li>
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
