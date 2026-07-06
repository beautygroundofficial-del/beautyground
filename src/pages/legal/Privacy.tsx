import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import { COMPANY_INFO } from '../../lib/companyInfo'

export default function Privacy() {
  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[720px] mx-auto px-6">
          <h1 className="font-serif text-[28px] font-bold text-text mb-8">개인정보처리방침</h1>
          <div className="bg-white rounded-md p-6 md:p-8 border text-[14px] text-text-sub leading-relaxed space-y-5" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <p>
              ⚠️ 본 방침은 표준 템플릿이며, 서비스 실제 오픈 전 개인정보보호책임자·사업자 정보를 확정해
              법률 검토 후 게시해야 합니다.
            </p>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">1. 수집하는 개인정보 항목</h2>
              <p>
                회원가입 시: 이름, 이메일, 휴대전화번호, 비밀번호(암호화 저장)<br />
                주문 시: 배송지 주소, 수령인 성함·연락처, 결제 정보(결제대행사를 통해 처리되며 카드번호 등은
                회사가 직접 보관하지 않습니다)
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">2. 수집 목적</h2>
              <p>회원 관리, 상품 주문·배송·결제, 고객상담, 부정이용 방지</p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">3. 보유 및 이용 기간</h2>
              <p>
                회원 탈퇴 시까지 보유하며, 관계 법령에 따라 보존이 필요한 거래 기록은 아래 기간 동안 보관합니다.
              </p>
              <ul className="list-disc pl-5 mt-1">
                <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
                <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
                <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">4. 제3자 제공 및 위탁</h2>
              <p>
                주문 상품 배송을 위해 배송업체에, 결제 처리를 위해 전자결제대행사(PortOne 등)에 필요한
                최소한의 정보가 제공·위탁될 수 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">5. 이용자의 권리</h2>
              <p>이용자는 언제든지 본인의 개인정보를 조회·수정·삭제·처리정지를 요청할 수 있습니다.</p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">6. 개인정보 보호책임자</h2>
              <p>
                성명: 정보 준비 중 · 연락처: {COMPANY_INFO.csEmail} / {COMPANY_INFO.csPhone}
              </p>
            </section>
            <p className="text-[12px] text-text-hint pt-4 border-t" style={{ borderColor: '#e5e0d8' }}>
              공고일자: 정보 준비 중 · 시행일자: 정보 준비 중
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
