import { Link } from 'react-router-dom'
import GNB from '../components/layout/GNB'
import Footer from '../components/layout/Footer'
import { COMPANY_INFO } from '../lib/companyInfo'

const STATS = [
  { value: '30+', label: '파트너 브랜드' },
  { value: '8개국', label: '글로벌 유통 네트워크' },
  { value: '2022', label: '법인 설립 · 백화점 편집샵 오픈' },
  { value: '2026.10', label: '강남 플래그십 오픈 예정' },
]

const BUSINESS = [
  {
    no: '01',
    title: '백화점 뷰티 편집샵',
    desc: 'AK플라자 광명점을 시작으로 백화점 내 K-Beauty 편집샵을 직영 운영합니다. VMD·판매·재고·프로모션을 본사가 직접 관리하며, 데이터 기반 큐레이션으로 매장을 구성합니다.',
  },
  {
    no: '02',
    title: '라이브커머스 플랫폼',
    desc: '자체 라이브커머스 쇼핑몰을 운영하며 브랜드별 라이브 방송, 라이브 한정 특가, 다시보기까지 온라인 판매의 전 과정을 지원합니다.',
  },
  {
    no: '03',
    title: '글로벌 유통 · 수출',
    desc: '미국 TJX·Costco, 일본 로프트(LOFT), 베트남 Guardian, 중국 KKV 등 해외 대형 채널과 Amazon·Qoo10·Shopee 이커머스를 통해 K-Beauty 브랜드의 해외 진출을 연계합니다.',
  },
  {
    no: '04',
    title: '브랜드 파트너십 · 마케팅',
    desc: '브랜드 총판·유통 대행과 SNS 바이럴, 카카오 CRM 연계 마케팅으로 파트너 브랜드의 국내외 성장을 함께 만듭니다.',
  },
]

const HISTORY = [
  { year: '2022', title: '법인 설립 및 오프라인 매장 오픈', desc: '(주)뷰티그라운드 법인 설립 · AK플라자 뷰티 편집샵 오픈' },
  { year: '2023', title: '백화점 팝업스토어 확대 & 글로벌 진출', desc: '롯데 잠실점, 수원 AK 서현, 현대 판교 등 팝업 진행 · Amazon · Qoo10 · Shopee 진출' },
  { year: '2024', title: '글로벌 유통 오프라인 대형 채널 확장', desc: '미국 TJX · Costco / 일본 로프트(LOFT) / 베트남 Guardian / 중국 KKV · SANFU 진출' },
  { year: '2025', title: '브랜드 총판 대행 확대 및 채널 확장', desc: '브랜드 마케팅 및 유통 대행 확대 · 라이브커머스 공식 런칭' },
  { year: '2026', title: '백화점 매장 확장 및 AI 마케팅 도입', desc: '백화점 편집샵 매장 본격 확장(AK백화점, 롯데 등) · AI 기반 데이터 마케팅 도입' },
]

const PORTFOLIO = [
  { title: '에스테틱 / 오가닉', brands: '더록시, 파이헤리티지, 꼬땅, 뀌라, 본에스티스 등' },
  { title: '코슈메티컬 (더마)', brands: '셀론, 킨뮬러, 닥터랩, 보타닉센스, 쿼드쎄라, 트리폴라, 르본코스메틱 등' },
  { title: '클린 / 비건 뷰티', brands: '키위글로우, 세로랩스, 아포메덤, 산다화, 코스넷 등' },
]

const ROADMAP = [
  { when: '2026년 7월', what: 'AK플라자 수원역점 오픈 — 운영 중', highlight: true },
  { when: '2026년 10월', what: '뷰티그라운드 플래그십 강남 역삼점 오픈', highlight: true },
  { when: '2027년', what: 'AK 분당 서현 · 롯데 영등포 · 신세계 영등포 확장 추진', highlight: false },
]

const sectionTitle = 'text-[13px] font-bold text-gold tracking-[0.2em] uppercase'
const h2 = 'font-serif text-[26px] sm:text-[32px] font-bold text-text mt-2 mb-10'

export default function CompanyIntro() {
  return (
    <>
      <GNB />
      <main className="bg-white">
        {/* 히어로 */}
        <section className="bg-dark px-6 py-20 sm:py-28 text-center">
          <p className="text-gold text-[13px] font-bold tracking-[0.3em] mb-5">BEAUTYGROUND</p>
          <h1 className="font-serif text-white text-[28px] sm:text-[40px] font-bold leading-[1.4] max-w-[720px] mx-auto">
            좋은 브랜드가
            <br />
            고객을 만나는 가장 빠른 길
          </h1>
          <p className="text-white/50 text-[15px] mt-6 italic">
            "The Right Beauty - The Right Life"
          </p>
          <p className="text-white/60 text-[14px] sm:text-[15px] leading-relaxed max-w-[560px] mx-auto mt-8">
            뷰티그라운드는 백화점 편집샵과 라이브커머스, 글로벌 유통을 잇는
            K-Beauty 커머스 컴퍼니입니다. 검증된 브랜드를 발굴하고,
            오프라인 매장과 온라인 방송에서 고객과 직접 만나게 합니다.
          </p>
        </section>

        {/* 핵심 숫자 */}
        <section className="bg-cream-4 px-6 py-14">
          <div className="max-w-[880px] mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-serif text-gold text-[26px] sm:text-[30px] font-bold">{s.value}</p>
                <p className="text-text-sub text-[12.5px] mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 회사 개요 */}
        <section className="max-w-[880px] mx-auto px-6 py-20">
          <p className={sectionTitle}>01 · About</p>
          <h2 className={h2}>회사 개요</h2>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5 border-t border-cream-2 pt-8">
            {[
              ['회사명', '(주)뷰티그라운드 BEAUTYGROUND Co., Ltd.'],
              ['대표자', COMPANY_INFO.ceo],
              ['설립', '2022년'],
              ['본사', COMPANY_INFO.address],
              ['사업 영역', '백화점 뷰티 편집샵 · 라이브커머스 · K-Beauty 글로벌 유통·마케팅'],
              ['오프라인 매장', 'AK플라자 광명점 · 수원점 운영 중'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[12px] text-text-hint mb-1">{k}</p>
                <p className="text-[15px] text-text font-medium leading-relaxed">{v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 사업 영역 */}
        <section className="bg-dark px-6 py-20">
          <div className="max-w-[880px] mx-auto">
            <p className="text-[13px] font-bold text-gold tracking-[0.2em] uppercase">02 · Business</p>
            <h2 className="font-serif text-[26px] sm:text-[32px] font-bold text-white mt-2 mb-10">
              무엇을 하는 회사인가
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-10 gap-y-10">
              {BUSINESS.map((b) => (
                <div key={b.no} className="border-t border-white/10 pt-6">
                  <p className="font-serif text-gold text-[18px] font-bold mb-2">{b.no}</p>
                  <p className="text-white font-bold text-[16px] mb-2">{b.title}</p>
                  <p className="text-white/60 text-[13.5px] leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 매장 */}
        <section className="max-w-[1080px] mx-auto px-6 py-20">
          <p className={sectionTitle}>03 · Stores</p>
          <h2 className={h2}>오프라인 매장</h2>

          <p className="text-gold font-bold text-[15px] mb-4">AK플라자 광명점</p>
          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            <figure>
              <img src="/images/about/store-front.jpg" alt="AK플라자 광명점 매장 정면 전경" className="w-full aspect-[4/3] object-cover rounded-md" />
              <figcaption className="text-[12px] text-text-hint mt-2 text-center">매장 정면 전경</figcaption>
            </figure>
            <figure>
              <img src="/images/about/store-display.jpg" alt="AK플라자 광명점 큐레이션 디스플레이" className="w-full aspect-[4/3] object-cover rounded-md" />
              <figcaption className="text-[12px] text-text-hint mt-2 text-center">큐레이션 디스플레이</figcaption>
            </figure>
          </div>

          <p className="text-gold font-bold text-[15px] mb-4">AK플라자 수원점</p>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <figure>
              <img src="/images/about/store-suwon-front.jpg" alt="AK플라자 수원점 매장 정면 전경" className="w-full aspect-[4/3] object-cover rounded-md" />
              <figcaption className="text-[12px] text-text-hint mt-2 text-center">매장 정면 전경</figcaption>
            </figure>
            <figure>
              <img src="/images/about/store-suwon-wide.jpg" alt="AK플라자 수원점 뷰티존 전경" className="w-full aspect-[4/3] object-cover rounded-md" />
              <figcaption className="text-[12px] text-text-hint mt-2 text-center">뷰티존 전경</figcaption>
            </figure>
          </div>

          <p className="text-text-sub text-[14px] leading-relaxed max-w-[720px]">
            에스테틱·더마코스메틱·트렌디 브랜드를 큐레이션한 K-Beauty 편집샵으로,
            두 매장 모두 본사 직영으로 VMD·판매·재고·프로모션 전체를 직접 운영합니다.
          </p>
        </section>

        {/* 연혁 */}
        <section className="bg-cream-4 px-6 py-20">
          <div className="max-w-[880px] mx-auto">
            <p className={sectionTitle}>04 · History</p>
            <h2 className={h2}>2022 → 2026</h2>
            <div className="space-y-0">
              {HISTORY.map((h, i) => (
                <div key={h.year} className="flex gap-6 sm:gap-10">
                  <div className="flex flex-col items-center shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-gold mt-1.5" />
                    {i < HISTORY.length - 1 && <span className="w-px flex-1 bg-cream-2 my-1" />}
                  </div>
                  <div className="pb-10">
                    <p className="text-gold font-bold text-[15px] mb-1">{h.year}</p>
                    <p className="text-text font-bold text-[16px] mb-1.5">{h.title}</p>
                    <p className="text-text-sub text-[13.5px] leading-relaxed">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 브랜드 포트폴리오 */}
        <section className="max-w-[1080px] mx-auto px-6 py-20">
          <p className={sectionTitle}>05 · Brands</p>
          <h2 className={h2}>함께하는 브랜드</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {PORTFOLIO.map((p) => (
              <div key={p.title} className="border border-cream-2 rounded-md p-6">
                <p className="text-text font-bold text-[15px] mb-3">{p.title}</p>
                <p className="text-text-sub text-[13.5px] leading-relaxed">{p.brands}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 로드맵 */}
        <section className="bg-cream-4 px-6 py-20">
          <div className="max-w-[880px] mx-auto">
            <p className={sectionTitle}>06 · Next</p>
            <h2 className={h2}>앞으로의 뷰티그라운드</h2>
            <div className="space-y-0">
              {ROADMAP.map((r, i) => (
                <div key={r.what} className="flex gap-6 sm:gap-10">
                  <div className="flex flex-col items-center shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${r.highlight ? 'bg-gold' : 'bg-cream-2'}`} />
                    {i < ROADMAP.length - 1 && <span className="w-px flex-1 bg-cream-2 my-1" />}
                  </div>
                  <div className="pb-8">
                    <p className={`font-bold text-[14px] mb-0.5 ${r.highlight ? 'text-gold' : 'text-text-hint'}`}>{r.when}</p>
                    <p className={`text-[15px] leading-relaxed ${r.highlight ? 'text-text font-bold' : 'text-text-sub'}`}>{r.what}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-dark px-6 py-20 text-center">
          <p className="font-serif text-white text-[22px] sm:text-[26px] font-bold mb-4">
            뷰티그라운드와 함께하고 싶으신가요?
          </p>
          <p className="text-white/50 text-[14px] mb-8">
            입점 · 제휴 · 협업 문의는 아래 연락처로 편하게 연락 주세요
          </p>
          <p className="text-gold text-[16px] font-bold mb-10">{COMPANY_INFO.csEmail}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/proposal"
              className="text-[13px] text-white/70 hover:text-gold border border-white/20 hover:border-gold rounded-pill px-5 py-2.5 transition-colors"
            >
              입점 제안서 보기
            </Link>
            <Link
              to="/app/home"
              className="text-[13px] text-white/70 hover:text-gold border border-white/20 hover:border-gold rounded-pill px-5 py-2.5 transition-colors"
            >
              라이브 쇼핑몰 둘러보기
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
