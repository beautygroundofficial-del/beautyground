import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import { COMPANY_INFO } from '../../lib/companyInfo'

export default function Terms() {
  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[720px] mx-auto px-6">
          <h1 className="font-serif text-[28px] font-bold text-text mb-8">이용약관</h1>
          <div className="bg-white rounded-md p-6 md:p-8 border text-[14px] text-text-sub leading-relaxed space-y-5" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <p>
              ⚠️ 본 약관은 표준 템플릿이며, 서비스 실제 오픈 전 {COMPANY_INFO.name}의 사업 실태에 맞게
              법률 검토 후 확정해야 합니다. 사업자 정보(사업자등록번호·통신판매업신고번호 등)가 확정되는 대로
              함께 반영합니다.
            </p>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제1조 (목적)</h2>
              <p>
                이 약관은 {COMPANY_INFO.name}(이하 "회사")가 운영하는 온라인 쇼핑몰(이하 "몰")에서 제공하는
                인터넷 관련 서비스를 이용함에 있어 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제2조 (회사의 지위)</h2>
              <p>
                회사는 입점 판매자(파트너)가 등록한 상품 정보 및 거래에 대해 통신판매중개자의 지위를 가지며,
                판매자가 등록한 상품, 상품정보, 거래에 관한 의무와 책임은 원칙적으로 각 판매자에게 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제3조 (회원가입)</h2>
              <p>
                이용자는 회사가 정한 절차에 따라 회원가입을 신청하며, 회사는 이용자의 신청에 대해 서비스 이용을
                승낙함을 원칙으로 합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제4조 (주문 및 결제)</h2>
              <p>
                이용자는 몰이 정한 절차에 따라 주문을 신청하며, 결제는 회사가 제휴한 전자결제업체를 통해
                이루어집니다. 결제 완료 시점에 매매계약이 체결된 것으로 봅니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제5조 (청약철회 및 환불)</h2>
              <p>
                이용자는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 상품 수령일로부터 7일 이내에
                청약철회를 할 수 있습니다. 단, 이용자의 책임 있는 사유로 상품이 훼손된 경우 등에는 청약철회가
                제한될 수 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제6조 (면책)</h2>
              <p>
                회사는 천재지변, 판매자의 귀책사유 등 회사의 고의·과실 없이 발생한 손해에 대해서는 책임을
                지지 않습니다.
              </p>
            </section>
            <p className="text-[12px] text-text-hint pt-4 border-t" style={{ borderColor: '#e5e0d8' }}>
              공고일자: 정보 준비 중 · 시행일자: 정보 준비 중 · 문의: {COMPANY_INFO.csEmail}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
