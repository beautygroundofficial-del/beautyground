const VALUES = [
  { icon: '🚀', title: '도전', desc: '뷰티와 테크의 경계를 허무는 새로운 시도' },
  { icon: '🤝', title: '신뢰', desc: '백화점·브랜드·고객 모두와 쌓는 진정한 파트너십' },
  { icon: '✨', title: '혁신', desc: '오프라인 뷰티 경험을 디지털로 재창조' },
]

export default function CareerSection() {
  return (
    <section
      className="py-20 md:py-28"
      id="career"
      style={{ backgroundColor: '#1a1208' }}
    >
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* 좌측: 헤드카피 */}
          <div>
            <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-4 block">
              CAREER
            </span>
            <h2 className="font-serif text-[32px] md:text-[42px] font-bold text-white leading-tight mb-4">
              뷰티커머스의<br />
              미래를 함께<br />
              <span className="text-gold">만들어갈</span> 팀원
            </h2>
            <p className="text-white/60 text-[15px] leading-relaxed">
              뷰티그라운드는 뷰티와 기술을 사랑하는 사람들이 모여 새로운 소비 경험을 만들어갑니다.
            </p>
          </div>

          {/* 우측: 핵심가치 + 버튼 */}
          <div>
            <div className="space-y-4 mb-8">
              {VALUES.map(({ icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 bg-white/5 rounded-md p-5 border border-white/10"
                >
                  <span className="text-2xl flex-shrink-0" aria-hidden="true">{icon}</span>
                  <div>
                    <p className="text-white font-bold text-[15px]">{title}</p>
                    <p className="text-white/55 text-[13px] mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-gold text-white font-semibold text-[14px] px-8 py-4 rounded-pill hover:bg-gold-light transition-colors focus:outline-none focus:shadow-focus"
            >
              채용 공고 보기 →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
