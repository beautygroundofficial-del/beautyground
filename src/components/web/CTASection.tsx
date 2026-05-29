import Button from '../common/Button'

export default function CTASection() {
  return (
    <section
      className="py-20 md:py-28"
      style={{ backgroundColor: '#b8924a' }}
      aria-label="앱 다운로드 및 입점 안내"
    >
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* 좌측 */}
          <div>
            <h2 className="font-serif text-[32px] md:text-[42px] font-bold text-white leading-tight mb-3">
              지금 바로 시작하세요
            </h2>
            <p className="text-white/80 text-[15px] leading-relaxed">
              뷰티관 앱을 다운로드하고 프리미엄 뷰티 라이브를 경험하세요.
              브랜드 입점을 원하신다면 파트너로 함께하세요.
            </p>
          </div>

          {/* 우측 */}
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="#"
              className="flex items-center gap-2.5 bg-white/20 border border-white/40 rounded-md px-5 py-3 hover:bg-white/30 transition-colors"
              aria-label="App Store에서 다운로드"
            >
              <span className="text-xl" aria-hidden="true">🍎</span>
              <div>
                <p className="text-white/80 text-[10px]">Download on the</p>
                <p className="text-white text-[14px] font-semibold">App Store</p>
              </div>
            </a>
            <a
              href="#"
              className="flex items-center gap-2.5 bg-white/20 border border-white/40 rounded-md px-5 py-3 hover:bg-white/30 transition-colors"
              aria-label="Google Play에서 다운로드"
            >
              <span className="text-xl" aria-hidden="true">▶</span>
              <div>
                <p className="text-white/80 text-[10px]">Get it on</p>
                <p className="text-white text-[14px] font-semibold">Google Play</p>
              </div>
            </a>
            <Button
              variant="ghost"
              size="md"
              label="입점 문의"
              className="border-white/40 text-white hover:bg-white/15"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
