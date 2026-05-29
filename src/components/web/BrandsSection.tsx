import { DEPT_CARDS } from '../../constants'

const DEPT_EMOJI: Record<string, string> = {
  lotte: '🏪',
  shinsegae: '🏬',
  hyundai: '🏢',
}

const DEPT_BRANDS: Record<string, string[]> = {
  lotte: ['랑콤', '에스티로더', '키엘', '클라란스', '비오템'],
  shinsegae: ['샤넬 뷰티', 'YSL', 'MAC', '나스', '바비브라운'],
  hyundai: ['설화수', '라메르', '아모레퍼시픽', '헤라', 'SK-II'],
}

export default function BrandsSection() {
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
            PARTNERS
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-text">
            백화점 3사 공식 파트너
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEPT_CARDS.map((dept) => {
            const emoji = DEPT_EMOJI[dept.key] ?? '🏬'
            const brands = DEPT_BRANDS[dept.key] ?? []

            return (
              <div
                key={dept.key}
                className="rounded-md p-8 flex flex-col"
                style={{ backgroundColor: dept.bgColor }}
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-4xl" aria-hidden="true">{emoji}</span>
                  {dept.isVip && (
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-pill"
                      style={{ backgroundColor: dept.accentColor, color: '#fff' }}
                    >
                      VIP 전용관
                    </span>
                  )}
                </div>

                <h3
                  className="font-serif text-[22px] font-bold mb-1"
                  style={{ color: dept.textColor }}
                >
                  {dept.name}
                </h3>
                <p className="text-[13px] mb-4" style={{ color: dept.accentColor }}>
                  {dept.brandCount}개 브랜드 입점
                </p>

                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {brands.map((brand) => (
                    <span
                      key={brand}
                      className="text-[12px] px-2.5 py-1 rounded-pill bg-white/60"
                      style={{ color: dept.textColor }}
                    >
                      {brand}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
