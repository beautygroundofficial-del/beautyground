const SERVICES = [
  {
    name: '뷰티관',
    desc: '백화점 3사 공식 BA가 진행하는 프리미엄 뷰티 라이브커머스 앱',
    icon: '📱',
  },
  {
    name: '뷰티관 Cloud',
    desc: '브랜드와 백화점을 위한 라이브커머스 솔루션 플랫폼',
    icon: '☁️',
  },
  {
    name: '뷰티관 ONE',
    desc: '오프라인 뷰티 컨설팅과 온라인 라이브를 연결하는 통합 서비스',
    icon: '✨',
  },
]

export default function IntroSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 min-h-[400px]">
        {/* 좌측: 헤드카피 */}
        <div
          className="flex flex-col justify-center px-8 md:px-16 py-12"
          style={{ backgroundColor: '#fff' }}
        >
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-4">
            ABOUT
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-text leading-tight">
            백화점 뷰티의<br />
            새로운 기준
          </h2>
          <p className="text-text-sub text-[15px] leading-relaxed mt-4 max-w-sm">
            30년 백화점 뷰티의 신뢰와 디지털 라이브커머스의 편리함을 하나로.
            뷰티관이 프리미엄 뷰티 경험을 재정의합니다.
          </p>
        </div>

        {/* 우측: 서비스 소개 */}
        <div
          className="flex flex-col justify-center gap-4 px-8 md:px-16 py-12"
          style={{ backgroundColor: '#f7f4ef' }}
        >
          {SERVICES.map(({ name, desc, icon }) => (
            <div key={name} className="flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-md flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: '#edeae3' }}
                aria-hidden="true"
              >
                {icon}
              </div>
              <div>
                <p className="text-[15px] font-bold text-text">{name}</p>
                <p className="text-[13px] text-text-sub mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
