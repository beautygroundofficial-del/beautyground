import { useState, useEffect } from 'react'
import { IconBrandApple, IconBrandGooglePlay } from '@tabler/icons-react'
import PhoneMockup from '../common/PhoneMockup'

const models = [
  '/images/KakaoTalk_20260616_212711753.jpg',
  '/images/KakaoTalk_20260616_212711753_01.jpg',
  '/images/KakaoTalk_20260616_212711753_02.jpg',
  '/images/KakaoTalk_20260616_212711753_03.jpg',
  '/images/KakaoTalk_20260616_212711753_04.jpg',
  '/images/KakaoTalk_20260616_212711753_05.jpg',
  '/images/KakaoTalk_20260616_212711753_06.jpg',
  '/images/KakaoTalk_20260616_212711753_07.jpg',
  '/images/KakaoTalk_20260616_212711753_08.jpg',
  '/images/KakaoTalk_20260616_212711753_09.jpg',
  '/images/KakaoTalk_20260616_212711753_10.jpg',
  '/images/KakaoTalk_20260616_212711753_11.jpg',
  '/images/KakaoTalk_20260616_212711753_12.jpg',
]

const GRID_IMAGES = [
  { src: models[0],  speed: 8,  delay: 0 },
  { src: models[3],  speed: 11, delay: 1 },
  { src: models[6],  speed: 14, delay: 2 },
  { src: models[9],  speed: 10, delay: 0.5 },
]

export default function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % models.length)
        setVisible(true)
      }, 500)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative bg-dark min-h-screen flex flex-col items-center md:grid md:grid-cols-2 md:items-center overflow-hidden">
      {/* 장식 원 */}
      <div className="absolute top-[-100px] right-[-50px] w-[500px] h-[500px] rounded-full border border-gold/10 pointer-events-none" aria-hidden="true" />
      <div className="absolute top-[50px] right-[80px] w-[300px] h-[300px] rounded-full bg-gold/6 pointer-events-none" aria-hidden="true" />
      <div className="absolute bottom-[80px] right-[200px] w-[160px] h-[160px] rounded-full border border-gold/15 pointer-events-none" aria-hidden="true" />

      {/* 폰 목업 — 모바일: 상단 중앙, 데스크톱: 우측 열 */}
      <div
        className="order-first md:order-last flex items-center justify-center w-full pt-20 pb-6 md:pt-0 md:pb-0 md:h-screen md:border-l md:border-white/[0.04]"
        aria-hidden="true"
      >
        {/* 모바일: 두 폰 상하 배치, transform 없이 정면 */}
        <div className="md:hidden flex flex-col items-center gap-4 w-full px-6">
          <div
            className="w-full max-w-[280px]"
            style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5))' }}
          >
            <PhoneMockup width={280} imageSrc={models[currentIndex]} imageVisible={visible} />
          </div>

          {/* 세컨드 폰 — 4분할 그리드 */}
          <div
            className="relative rounded-[28px] border-[5px] border-white/70 overflow-hidden w-full max-w-[280px]"
            style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.5))' }}
          >
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-2.5 bg-[#111] rounded-full z-10" />
            <div className="grid grid-cols-2">
              {GRID_IMAGES.map(({ src, speed, delay }, i) => (
                <div key={i} className="relative overflow-hidden" style={{ height: 140 }}>
                  <img
                    src={src}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      animation: `nolling ${speed}s ease-in-out infinite`,
                      animationDelay: `${delay}s`,
                    }}
                  />
                  {i % 2 === 0 && (
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-white/30" />
                  )}
                  {i < 2 && (
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-white/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 데스크톱: 메인 폰 220px + 세컨드 폰 — 기존 레이아웃 유지 */}
        <div className="hidden md:flex items-center gap-6">
          <PhoneMockup width={220} imageSrc={models[currentIndex]} imageVisible={visible} />

          {/* 세컨드 폰 — 4분할 그리드 */}
          <div
            className="relative rounded-[28px] border-[5px] border-white/70 overflow-hidden flex-shrink-0 self-center mt-16"
            style={{ width: 148 }}
          >
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-2.5 bg-[#111] rounded-full z-10" />
            <div className="grid grid-cols-2" style={{ height: 280 }}>
              {GRID_IMAGES.map(({ src, speed, delay }, i) => (
                <div key={i} className="relative overflow-hidden" style={{ height: 140 }}>
                  <img
                    src={src}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center top',
                      animation: `nolling ${speed}s ease-in-out infinite`,
                      animationDelay: `${delay}s`,
                    }}
                  />
                  {i % 2 === 0 && (
                    <div className="absolute right-0 top-0 bottom-0 w-px bg-white/30" />
                  )}
                  {i < 2 && (
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-white/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 텍스트 — 모바일: 하단, 데스크톱: 좌측 열 */}
      <div className="order-last md:order-first px-6 md:px-24 py-8 md:py-24 w-full">
        <p className="text-[11px] text-gold tracking-[3px] uppercase mb-6">
          DEPARTMENT BEAUTY LIVE
        </p>
        <h1
          className="font-display text-2xl md:text-4xl font-bold leading-tight text-white mb-6"
          style={{ wordBreak: 'keep-all' }}
        >
          백화점 뷰티를<br />
          <em className="not-italic text-gold">집에서, 전문가와</em><br />
          함께 경험하세요
        </h1>
        <p className="text-[15px] text-[#888] leading-[1.9] mb-10 max-w-md">
          롯데 · 신세계 · 현대 3사 공식 BA가 직접 출연하는 프리미엄 라이브커머스 플랫폼
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="#"
            className="inline-flex items-center gap-2.5 bg-gold text-white px-6 py-3 rounded-pill text-[13px] font-medium hover:bg-gold-light transition-colors"
            aria-label="App Store에서 다운로드"
          >
            <IconBrandApple size={18} aria-hidden="true" />
            App Store
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-2.5 bg-transparent border border-[#333] text-[#bbb] px-6 py-3 rounded-pill text-[13px] font-medium hover:border-[#555] transition-colors"
            aria-label="Google Play에서 다운로드"
          >
            <IconBrandGooglePlay size={18} aria-hidden="true" />
            Google Play
          </a>
        </div>
      </div>
    </section>
  )
}
