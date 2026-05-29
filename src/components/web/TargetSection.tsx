const SEGMENTS = [
  {
    age: '30대',
    color: '#7F77DD',
    bg: '#EEEDFE',
    keywords: ['트렌드', '가성비', '멀티 기능', '빠른 배송', '아이섀도 팔레트'],
    desc: '트렌디한 뷰티를 합리적으로 즐기는 MZ 직장 여성',
  },
  {
    age: '40대',
    color: '#1D9E75',
    bg: '#E1F5EE',
    keywords: ['안티에이징', '탄력', '프리미엄', '피부 재생', '에센스'],
    desc: '피부 변화에 진지하게 투자하는 뷰티 파워 컨슈머',
  },
  {
    age: '50대',
    color: '#993556',
    bg: '#FBEAF0',
    keywords: ['보습', '재생', '명품 브랜드', '포인트 활용', '라메르 · 설화수'],
    desc: '백화점 충성 고객, 디지털 라이브로 편리하게 쇼핑',
  },
]

export default function TargetSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: '#0e0c08' }}>
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
            TARGET
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-white">
            3040·50대를 위한<br />맞춤 뷰티 경험
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SEGMENTS.map(({ age, color, bg, keywords, desc }) => (
            <div
              key={age}
              className="rounded-md p-8"
              style={{ backgroundColor: bg }}
            >
              <p
                className="font-serif text-[32px] font-bold mb-2"
                style={{ color }}
              >
                {age}
              </p>
              <p className="text-[14px] text-text-sub leading-relaxed mb-6">{desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-[12px] font-medium px-3 py-1 rounded-pill bg-white/70"
                    style={{ color }}
                  >
                    #{kw}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
