import PhoneMockup from '../home/PhoneMockup'

export default function Hero() {
  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ backgroundColor: '#0e0c08' }}
    >
      {/* 장식 원 */}
      <div
        className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(184,146,74,0.12) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[-50px] left-[-50px] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(184,146,74,0.07) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="max-w-[1280px] mx-auto px-6 w-full py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* 좌측: 텍스트 */}
          <div>
            <div className="inline-flex items-center gap-2 bg-gold/15 border border-gold/30 rounded-pill px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-[#FF4757] rounded-full animate-pulse" aria-hidden="true" />
              <span className="text-gold text-[13px] font-medium">롯데·신세계·현대 3사 파트너</span>
            </div>

            <h1 className="font-serif text-white text-[36px] md:text-[48px] font-bold leading-tight mb-4">
              백화점 뷰티를<br />
              <span className="text-gold">라이브로</span> 만나다
            </h1>

            <p className="text-white/60 text-[15px] leading-relaxed mb-8 max-w-md">
              공식 BA(뷰티 어드바이저)와 함께하는 프리미엄 뷰티 라이브커머스.
              3040·50대를 위한 백화점 브랜드를 실시간으로 경험하세요.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href="#"
                className="flex items-center gap-2.5 bg-white/10 border border-white/20 rounded-md px-5 py-3 hover:bg-white/15 transition-colors"
                aria-label="App Store에서 다운로드"
              >
                <span className="text-xl" aria-hidden="true">🍎</span>
                <div>
                  <p className="text-white/60 text-[10px]">Download on the</p>
                  <p className="text-white text-[14px] font-semibold">App Store</p>
                </div>
              </a>
              <a
                href="#"
                className="flex items-center gap-2.5 bg-white/10 border border-white/20 rounded-md px-5 py-3 hover:bg-white/15 transition-colors"
                aria-label="Google Play에서 다운로드"
              >
                <span className="text-xl" aria-hidden="true">▶</span>
                <div>
                  <p className="text-white/60 text-[10px]">Get it on</p>
                  <p className="text-white text-[14px] font-semibold">Google Play</p>
                </div>
              </a>
            </div>
          </div>

          {/* 우측: 폰 목업 */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
