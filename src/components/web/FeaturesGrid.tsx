const FEATURES = [
  {
    icon: '👩‍💼',
    title: '공식 BA 출연',
    desc: '백화점 공식 인증 뷰티 어드바이저가 직접 출연하는 신뢰 라이브',
  },
  {
    icon: '🔬',
    title: '피부 Q&A',
    desc: '시청자 피부 고민에 전문 BA가 실시간으로 답변하는 1:1 상담',
  },
  {
    icon: '💎',
    title: '멤버십 포인트',
    desc: '백화점 포인트를 그대로 적립·사용, 기존 혜택을 온라인에서도',
  },
  {
    icon: '🚀',
    title: '당일 배송',
    desc: '백화점 물류 시스템 연동으로 주문 당일 문 앞 배송 서비스',
  },
]

export default function FeaturesGrid() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
            FEATURES
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-text">
            뷰티그라운드만의 특별한 혜택
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-white p-6 rounded-md border"
              style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
            >
              <div className="text-3xl mb-4" aria-hidden="true">{icon}</div>
              <h3 className="text-[16px] font-bold text-text mb-2">{title}</h3>
              <p className="text-[13px] text-text-sub leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
