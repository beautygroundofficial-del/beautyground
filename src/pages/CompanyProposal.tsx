import GNB from '../components/layout/GNB'
import Footer from '../components/layout/Footer'

const HISTORY = [
  { year: '2022', title: '법인 설립 및 오프라인 매장 오픈', desc: '(주)뷰티그라운드 법인 설립 · AK플라자 뷰티 편집샵 오픈' },
  { year: '2023', title: '백화점 팝업스토어 확대 & 글로벌 진출', desc: '롯데 잠실점, 수원 AK 서현, 현대 판교 등 팝업 진행 · Amazon · Qoo10 · Shopee 진출' },
  { year: '2024', title: '글로벌 유통 오프라인 대형 채널 확장', desc: '미국 TJX · Costco / 일본 로프트(LOFT) / 베트남 Guardian / 중국 KKV · SANFU 진출' },
  { year: '2025', title: '브랜드 총판 대행 확대 및 채널 확장', desc: '브랜드 마케팅 및 유통 대행 확대 · 라이브커머스 공식 런칭' },
  { year: '2026', title: '백화점 매장 확장 및 AI 마케팅 도입', desc: '백화점 편집샵 매장 본격 확장(AK백화점, 롯데 등) · AI 기반 데이터 마케팅 도입' },
]

const COMPARE = [
  { label: '상품 구성', before: 'MD의 개인적인 감과 직관에 의존', after: '글로벌 유통 및 판매 데이터 기반 정밀 큐레이션' },
  { label: '브랜드 소싱', before: '이미 국내에 흔히 유통 중인 브랜드 위주', after: '30+ 글로벌 파트너 브랜드와 직접 소싱 연계' },
  { label: '집객 마케팅', before: '단순 백화점 워크인 고객 트래픽에 의존', after: '자체 온라인 바이럴 마케팅 & 카카오 CRM 고객 유도' },
  { label: '데이터 공유', before: '수동적인 월간 매출 단순 보고', after: '실시간 대시보드 연동 + 일별 다각도 판매 패턴 분석' },
  { label: '재고 관리', before: '개별 입점 브랜드사의 공급 속도에 의존', after: '자체 대형 물류 창고 기반 실시간 보충 시스템' },
  { label: '해외 확장성', before: '국내 판매 및 오프라인 대면 한계', after: '글로벌 유통망(미국, 일본 등) 연계 수출 및 성장 지원' },
]

const PORTFOLIO = [
  { title: '에스테틱 / 오가닉', brands: '더록시, 파이헤리티지, 꼬땅, 뀌라, 본에스티스 등' },
  { title: '코슈메티컬 (더마)', brands: '셀론, 킨뮬러, 닥터랩, 보타닉센스, 쿼드쎄라, 트리폴라, 르본코스메틱 등' },
  { title: '클린 / 비건 뷰티', brands: '키위글로우, 세로랩스, 아포메덤, 산다화, 코스넷 등' },
]

const BENEFITS = [
  { title: '브랜드 신뢰도 상승', desc: '대한민국 주요 백화점 입점 타이틀 획득으로 브랜드의 프리미엄 이미지 자동 형성 및 신뢰도 즉시 제고' },
  { title: '초기 비용 전액 면제', desc: '인테리어 시공, 매장 집기 세팅 비용을 뷰티그라운드가 전액 부담 — 브랜드는 재고·운영 리스크 없이 입점' },
  { title: '입체적 마케팅 지원', desc: '본사 주도의 SNS 온라인 바이럴 캠페인 및 고관여 카카오 CRM 연계 타겟 마케팅으로 브랜드 고객 유입 상시 보장' },
  { title: '오프라인 단독 팝업', desc: '연 1~2회 오프라인 매장 내 브랜드 단독 팝업스토어 및 뷰티클래스 기회 제공으로 잠재 고객 밀착 경험 극대화' },
  { title: '글로벌 진출 연계', desc: '매장 실제 유통·소비 데이터를 기반으로 8개국 바이어 네트워크 매칭, 글로벌 시장 진출 기회 다이렉트 지원' },
]

const EXPANSION = [
  { store: 'AK플라자 백화점', target: '수원역점', concept: '프리미엄 Beauty 큐레이션', size: '10~20평', timing: '2026년 7월 입점 확정', highlight: true },
  { store: '뷰티그라운드 플래그십', target: '강남 역삼점', concept: '트렌디 K-Beauty 체험형 매장', size: '30평', timing: '2026년 10월 입점 확정', highlight: true },
  { store: 'AK플라자 백화점', target: '분당 서현역점', concept: 'K-Beauty 토탈 프리미엄', size: '10~20평', timing: '2027년 상반기 예정', highlight: false },
  { store: '롯데 백화점', target: '영등포역점', concept: '프리미엄 Beauty 큐레이션', size: '10~20평', timing: '2027년 하반기 예정', highlight: false },
  { store: '신세계 백화점', target: '영등포역점', concept: 'K-Beauty 토탈 스토어(확장)', size: '10~20평', timing: '2027년 하반기 예정', highlight: false },
]

const sectionTitle = 'text-[13px] font-bold text-gold tracking-[0.2em] uppercase'
const h2 = 'font-serif text-[26px] sm:text-[32px] font-bold text-text mt-2 mb-10'

export default function CompanyProposal() {
  return (
    <>
      <GNB />
      <main className="bg-white">
        {/* 히어로 */}
        <section className="bg-dark px-6 py-20 sm:py-28 text-center">
          <p className="text-gold text-[13px] font-bold tracking-[0.3em] mb-5">BEAUTYGROUND</p>
          <h1 className="font-serif text-white text-[28px] sm:text-[40px] font-bold leading-[1.4] max-w-[720px] mx-auto">
            백화점 편집샵 매장
            <br />
            사업 및 입점 제안서
          </h1>
          <p className="text-white/50 text-[15px] mt-6 italic">
            "Beauty 편집샵의 새로운 기준을 만들겠습니다"
          </p>
          <a
            href="/files/beautyground-company-intro.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-10 text-[13px] text-white/60 hover:text-gold border-b border-white/20 hover:border-gold transition-colors"
          >
            PDF로 보기 ↓
          </a>
        </section>

        {/* 회사 개요 */}
        <section className="max-w-[880px] mx-auto px-6 py-20">
          <p className={sectionTitle}>01 · 소개 &amp; 현황</p>
          <h2 className={h2}>회사 개요</h2>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-5 border-t border-cream-2 pt-8">
            {[
              ['회사명', '(주)뷰티그라운드 BEAUTYGROUND Co., Ltd.'],
              ['사업 영역', '오프라인 뷰티 편집샵, 팝업샵 · K-Beauty 글로벌 유통·마케팅·이커머스'],
              ['파트너 브랜드', '30+ 파트너 브랜드 직접 소싱 (더록시, 쿼드쎄라, 뀌라, 트리폴라, 본에스티스 등 50+)'],
              ['오프라인 매장', 'AK플라자 광명점 K-Beauty 편집샵 운영 중'],
              ['본사 위치', '경기도 성남시 분당구 정자동 소재'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[12px] text-text-hint mb-1">{k}</p>
                <p className="text-[15px] text-text font-medium leading-relaxed">{v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 연혁 */}
        <section className="bg-cream-4 px-6 py-20">
          <div className="max-w-[880px] mx-auto">
            <p className={sectionTitle}>주요 연혁</p>
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

        {/* AK플라자 광명점 */}
        <section className="max-w-[1080px] mx-auto px-6 py-20">
          <p className={sectionTitle}>현재 운영 현황</p>
          <h2 className={h2}>AK플라자 광명점</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            <figure>
              <img src="/images/about/store-front.jpg" alt="AK플라자 광명점 매장 정면 전경" className="w-full aspect-[4/3] object-cover rounded-md" />
              <figcaption className="text-[12px] text-text-hint mt-2 text-center">매장 정면 전경</figcaption>
            </figure>
            <figure>
              <img src="/images/about/store-display.jpg" alt="AK플라자 광명점 큐레이션 디스플레이" className="w-full aspect-[4/3] object-cover rounded-md" />
              <figcaption className="text-[12px] text-text-hint mt-2 text-center">큐레이션 디스플레이</figcaption>
            </figure>
          </div>
          <p className="text-gold italic text-[14px] mb-6">"The Right Beauty - The Right Life"</p>
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4 border-t border-cream-2 pt-6">
            {[
              ['위치', 'AK플라자 광명점 뷰티존'],
              ['오픈 시기', '2022년 매장 오픈'],
              ['컨셉', '에스테틱 / 더마코스메틱 / 트렌디 큐레이션 편집샵'],
              ['운영 방식', '본사 직영 운영 (VMD, 판매, 재고, 프로모션 전체 직접 관리)'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 text-[14px]">
                <span className="text-text-hint w-[80px] shrink-0">{k}</span>
                <span className="text-text">{v}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 왜 뷰티그라운드인가 */}
        <section className="bg-dark px-6 py-20">
          <div className="max-w-[880px] mx-auto">
            <p className="text-[13px] font-bold text-gold tracking-[0.2em] uppercase">02 · 운영 역량</p>
            <h2 className="font-serif text-[26px] sm:text-[32px] font-bold text-white mt-2 mb-10">
              왜 뷰티그라운드 편집샵인가
            </h2>
            <div className="space-y-6">
              {COMPARE.map((c) => (
                <div key={c.label} className="border-t border-white/10 pt-6">
                  <p className="text-white/40 text-[12px] mb-3">{c.label}</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <p className="text-white/40 text-[13.5px] leading-relaxed">{c.before}</p>
                    <p className="text-white text-[14px] font-medium leading-relaxed">{c.after}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 브랜드 포트폴리오 */}
        <section className="max-w-[1080px] mx-auto px-6 py-20">
          <p className={sectionTitle}>브랜드 포트폴리오</p>
          <h2 className={h2}>입점 브랜드 큐레이션</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {PORTFOLIO.map((p) => (
              <div key={p.title} className="border border-cream-2 rounded-md p-6">
                <p className="text-text font-bold text-[15px] mb-3">{p.title}</p>
                <p className="text-text-sub text-[13.5px] leading-relaxed">{p.brands}</p>
              </div>
            ))}
          </div>
          <p className="text-[13px] text-text-hint mt-6 leading-relaxed">
            큐레이션 기준: SNS 바이럴·트래픽 검증 · 평점 4.8 이상 및 누적 리뷰 1,000개 이상 · EWG 성분 등급·비건 인증 등 성분 안전성 검증 · 백화점 고객 세그먼트 매칭 · 글로벌 세일즈 트랙 레코드
          </p>
        </section>

        {/* 입점 혜택 */}
        <section className="bg-cream-4 px-6 py-20">
          <div className="max-w-[880px] mx-auto">
            <p className={sectionTitle}>03 · 확장 &amp; 협업 제안</p>
            <h2 className={h2}>입점 브랜드가 얻는 5대 핵심 혜택</h2>
            <div className="space-y-6">
              {BENEFITS.map((b, i) => (
                <div key={b.title} className="flex gap-5">
                  <span className="font-serif text-gold text-[20px] font-bold shrink-0 w-8">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-text font-bold text-[15px] mb-1">{b.title}</p>
                    <p className="text-text-sub text-[13.5px] leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 확장 로드맵 */}
        <section className="max-w-[1080px] mx-auto px-6 py-20">
          <p className={sectionTitle}>백화점 편집샵 확장 계획</p>
          <h2 className={h2}>협업 프로세스 및 확장 로드맵</h2>

          <div className="flex flex-wrap gap-2 mb-12">
            {['미팅 & 상담 (1~2주)', '제안서 & 계약 (2~3주)', '설계 & 시공 (4~6주)', '입고 & 세팅 (1~2주)', '오픈 & 프로모션'].map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <span className="text-[12.5px] text-text-sub border border-cream-2 rounded-pill px-3 py-1.5 whitespace-nowrap">{s}</span>
                {i < arr.length - 1 && <span className="text-text-hint">→</span>}
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13.5px] min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-dark">
                  <th className="py-3 pr-4 text-text-hint font-medium">백화점 / 구분</th>
                  <th className="py-3 pr-4 text-text-hint font-medium">타겟 지점</th>
                  <th className="py-3 pr-4 text-text-hint font-medium">매장 컨셉</th>
                  <th className="py-3 pr-4 text-text-hint font-medium">규모</th>
                  <th className="py-3 text-text-hint font-medium">목표 시기</th>
                </tr>
              </thead>
              <tbody>
                {EXPANSION.map((e) => (
                  <tr key={`${e.store}-${e.target}`} className="border-b border-cream-2">
                    <td className="py-3.5 pr-4 text-text font-medium">{e.store}</td>
                    <td className={`py-3.5 pr-4 ${e.highlight ? 'text-gold font-bold' : 'text-text'}`}>{e.target}</td>
                    <td className="py-3.5 pr-4 text-text-sub">{e.concept}</td>
                    <td className="py-3.5 pr-4 text-text-sub">{e.size}</td>
                    <td className={`py-3.5 ${e.highlight ? 'text-text font-bold' : 'text-text-hint'}`}>{e.timing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-dark px-6 py-20 text-center">
          <p className="font-serif text-white text-[22px] sm:text-[26px] font-bold mb-4">
            함께 만들어갈 다음 매장을 논의하고 싶습니다
          </p>
          <p className="text-white/50 text-[14px] mb-8">
            제휴 · 입점 문의는 아래 연락처로 편하게 연락 주세요
          </p>
          <p className="text-gold text-[16px] font-bold">beautyground.official@gmail.com</p>
        </section>
      </main>
      <Footer />
    </>
  )
}
