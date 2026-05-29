const SCHEDULE = [
  { day: '월요일', time: '오후 7시', target: '3040대', theme: '스킨케어 루틴', brand: '설화수 · 키엘' },
  { day: '수요일', time: '오후 8시', target: '4050대', theme: '안티에이징 특집', brand: '라메르 · 에스티로더' },
  { day: '금요일', time: '오후 7시 30분', target: '전 연령', theme: '위클리 특가', brand: '랑콤 · 샤넬' },
  { day: '토요일', time: '오후 3시', target: '3040대', theme: '메이크업 클래스', brand: 'MAC · 나스' },
]

export default function ScheduleSection() {
  return (
    <section className="py-20 md:py-28" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
            SCHEDULE
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-text">
            정기 라이브 편성표
          </h2>
          <p className="text-text-sub text-[15px] mt-3">매주 4회 정기 라이브 방송</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SCHEDULE.map(({ day, time, target, theme, brand }) => (
            <div
              key={day}
              className="bg-white rounded-md p-6 border flex items-start gap-4"
              style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
            >
              <div
                className="w-12 h-12 rounded-md flex items-center justify-center text-2xl flex-shrink-0"
                style={{ backgroundColor: '#f0ede8' }}
                aria-hidden="true"
              >
                📺
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[16px] font-bold text-text">{day}</span>
                  <span className="text-[13px] text-gold font-medium">{time}</span>
                </div>
                <p className="text-[14px] font-semibold text-text">{theme}</p>
                <p className="text-[12px] text-text-sub mt-0.5">{brand}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] bg-cream-2 text-text-sub px-2.5 py-0.5 rounded-pill">
                    {target}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
