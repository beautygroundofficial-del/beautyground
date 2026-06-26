import { Link } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'

export default function PartnerApplyComplete() {
  return (
    <>
      <GNB />
      <main className="py-24 md:py-32" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[640px] mx-auto px-6">
          <div
            className="bg-white rounded-md p-10 md:p-14 text-center border"
            style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
          >
            <div className="text-6xl mb-5" aria-hidden="true">✅</div>
            <h1 className="font-serif text-[26px] md:text-[30px] font-bold text-text mb-3">
              입점 신청이 접수되었습니다
            </h1>
            <p className="text-[15px] text-text-sub leading-relaxed">
              소중한 신청 감사합니다.<br />
              심사는 영업일 기준 <strong className="text-text">3~5일</strong> 내 완료되며,
              결과는 입력하신 이메일로 안내드립니다.
            </p>

            <div
              className="bg-cream rounded-md p-5 mt-8 text-left border-l-[3px]"
              style={{ borderLeftColor: '#b8924a' }}
            >
              <p className="text-[14px] font-semibold text-text mb-1">다음 단계</p>
              <ul className="text-[13px] text-text-sub space-y-1.5">
                <li>• 심사 통과 시 파트너 대시보드 접근이 활성화됩니다.</li>
                <li>• 로그인 후 상품 등록 · 라이브 예약을 진행할 수 있습니다.</li>
                <li>• 사전 BA 교육 일정 조율 후 라이브를 시작합니다.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
              <Link
                to="/"
                className="inline-block bg-gold text-white rounded-pill text-[14px] px-6 py-3 font-medium hover:bg-gold-light transition-colors"
              >
                홈으로 돌아가기
              </Link>
              <Link
                to="/partner/login"
                className="inline-block bg-cream-3 text-text-sub rounded-pill text-[14px] px-6 py-3 font-medium hover:bg-cream-2 transition-colors"
              >
                파트너 로그인
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
