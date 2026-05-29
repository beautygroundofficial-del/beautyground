const STATS = [
  { value: '3사', label: '파트너 백화점', sub: '롯데 · 신세계 · 현대' },
  { value: '50+', label: '입점 브랜드', sub: '럭셔리·프리미엄' },
  { value: '주 4회', label: '정기 라이브', sub: '월·수·금·토' },
  { value: '3040·50', label: '주요 타겟', sub: '백화점 기존 고객' },
]

export default function StatBar() {
  return (
    <section className="border-b border-cream-2" aria-label="서비스 현황">
      <div className="max-w-[1280px] mx-auto grid grid-cols-2 md:grid-cols-4">
        {STATS.map(({ value, label, sub }, index) => (
          <div
            key={label}
            className={`px-8 py-8 text-center ${index < STATS.length - 1 ? 'border-r border-cream-2' : ''}`}
          >
            <p className="font-serif text-[28px] font-bold text-gold leading-none">{value}</p>
            <p className="text-[14px] font-semibold text-text mt-1">{label}</p>
            <p className="text-[12px] text-text-hint mt-0.5">{sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
