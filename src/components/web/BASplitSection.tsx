const CHECKLIST = [
  { icon: '💬', title: '간편한 채팅 소통', desc: '시청자와 실시간으로 제품 상담, 고민 해결' },
  { icon: '🎯', title: '1:1 고객 소통', desc: '개인 피부 타입에 맞춘 맞춤형 뷰티 솔루션' },
  { icon: '📈', title: '마케팅 효과 극대화', desc: '라이브 방송 하나로 브랜드 노출과 매출 동시 달성' },
]

export default function BASplitSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-0 items-center">
        {/* 좌측: 텍스트 */}
        <div className="px-8 md:px-16 py-12">
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-4 block">
            BA 소통
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-text leading-tight mb-8">
            공식 BA와 함께하는<br />
            프리미엄 뷰티 경험
          </h2>
          <div className="space-y-6">
            {CHECKLIST.map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: '#f0ede8' }}
                  aria-hidden="true"
                >
                  {icon}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-text">{title}</p>
                  <p className="text-[13px] text-text-sub mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 우측: 배경 */}
        <div
          className="relative h-[400px] md:h-full min-h-[400px] flex items-center justify-center rounded-lg mx-6 md:mx-0 md:rounded-none"
          style={{ backgroundColor: '#f0ede8' }}
        >
          <div className="text-center">
            <div className="text-8xl mb-4" aria-hidden="true">💄</div>
            <p className="font-serif text-[20px] font-bold text-text">설화수 공식 BA</p>
            <p className="text-text-sub text-[13px] mt-1">현대백화점관 · 3,243명 시청</p>
          </div>
        </div>
      </div>
    </section>
  )
}
