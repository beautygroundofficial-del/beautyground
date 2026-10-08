import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import { COMPANY_INFO } from '../../lib/companyInfo'

// ⚠️ PG 재신청 전 법률 검토 대상 — 소비자에게 공개되는 페이지이므로 화면에 "템플릿" 경고문구를 노출하지 말 것
// (2026-07-24: 통신판매중개자 문구가 PG 반려 사유였음 — 제4조는 절대 중개자 표현으로 되돌리지 말 것)
// 2026-07-28: 공정거래위원회 전자상거래 표준약관 구조를 기반으로 19개 조항으로 확장(기존 6개 조항은 부실 지적).
export default function Terms() {
  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[720px] mx-auto px-6">
          <h1 className="font-serif text-[28px] font-bold text-text mb-8">이용약관</h1>
          <div className="bg-white rounded-md p-6 md:p-8 border text-[14px] text-text-sub leading-relaxed space-y-5" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제1조 (목적)</h2>
              <p>
                이 약관은 {COMPANY_INFO.name}(이하 "회사")가 운영하는 온라인 쇼핑몰(이하 "몰")에서 제공하는
                인터넷 관련 서비스를 이용함에 있어 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제2조 (정의)</h2>
              <p>
                "몰"이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 운영하는 가상의 영업장을 말합니다.
                "이용자"란 몰에 접속하여 이 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말하며,
                "회원"이란 몰에 개인정보를 제공하여 회원등록을 한 자로서 회사의 정보를 지속적으로 제공받으며
                몰이 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제3조 (약관의 효력 및 변경)</h2>
              <p>
                이 약관은 몰 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력을 발생합니다. 회사는
                「전자상거래 등에서의 소비자보호에 관한 법률」, 「약관의 규제에 관한 법률」 등 관계 법령을 위배하지
                않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여 현행 약관과 함께
                그 적용일자 7일 전부터 몰 화면에 공지합니다. 이용자에게 불리하게 약관 내용을 변경하는 경우에는
                최소한 30일 이상의 사전 유예기간을 두고 공지합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제4조 (회사의 지위 및 책임)</h2>
              <p>
                회사는 몰에서 판매되는 모든 상품을 사전에 직접 매입하여 재고로 보유한 상태에서 판매하며,
                통신판매업자로서 계약 당사자의 지위를 가집니다. 상품의 선정·등록·정보 관리, 재고 보유,
                가격 책정, 하자·배송·교환·환불 등 소비자와의 거래에 관한 일체의 책임을 회사가 직접 부담합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제5조 (서비스의 제공 및 변경)</h2>
              <p>
                회사는 상품 또는 용역에 관한 정보 제공 및 구매계약의 체결, 결제, 배송 등의 서비스를 제공합니다.
                회사는 상품의 품절 또는 기술적 사양의 변경 등의 경우에는 장차 체결되는 계약에 의해 제공할
                서비스의 내용을 변경할 수 있으며, 이 경우 변경된 내용 및 제공일자를 명시하여 사전에 공지합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제6조 (서비스의 중단)</h2>
              <p>
                회사는 컴퓨터 등 정보통신설비의 보수점검·교체 및 고장, 통신의 두절 등의 사유가 발생한 경우에는
                서비스의 제공을 일시적으로 중단할 수 있습니다. 이 경우 회사는 사전에 공지하며, 부득이한 경우
                사후에 공지할 수 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제7조 (회원가입)</h2>
              <p>
                이용자는 회사가 정한 절차에 따라 회원가입을 신청하며, 회사는 이용자의 신청에 대해 서비스 이용을
                승낙함을 원칙으로 합니다. 만 14세 미만 아동은 원칙적으로 회원으로 가입할 수 없습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제8조 (회원 탈퇴 및 자격 상실)</h2>
              <p>
                회원은 언제든지 마이페이지 등을 통해 탈퇴를 요청할 수 있으며, 회사는 즉시 회원탈퇴를 처리합니다.
                회원이 타인의 정보를 도용하거나 허위 사실을 기재하는 등 몰의 운영을 고의로 방해한 경우, 회사는
                사전 통지 후 회원자격을 제한 또는 상실시킬 수 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제9조 (개인정보보호)</h2>
              <p>
                회사는 관계 법령이 정하는 바에 따라 이용자의 개인정보를 보호하기 위해 노력하며, 개인정보의
                수집·이용·보관에 관한 자세한 사항은 별도로 게시하는 개인정보처리방침에 따릅니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제10조 (구매신청 및 계약의 성립)</h2>
              <p>
                이용자는 몰 상에서 상품 선택, 수량 지정, 배송정보 입력, 결제방법 선택 등의 절차로 구매를
                신청하며, 회사가 이러한 신청에 대하여 승낙의 의사표시가 이용자에게 도달한 시점에 계약이
                성립한 것으로 봅니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제11조 (지급방법)</h2>
              <p>
                몰에서 구매한 상품에 대한 대금 지급은 회사가 제휴한 전자지급결제대행업체(PortOne 등)를 통한
                신용카드 결제, 실시간 계좌이체, 간편결제 등 회사가 정하는 방법으로 할 수 있습니다. 결제 정보
                (카드번호 등)는 전자지급결제대행업체를 통해 처리되며 회사가 직접 보관하지 않습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제12조 (재화 등의 공급)</h2>
              <p>
                회사는 이용자와 재화의 공급시기에 관하여 별도의 약정이 없는 이상, 이용자가 청약을 한 날부터
                7일 이내에 재화를 배송할 수 있도록 조치합니다. 다만 상품 준비 상황에 따라 공급일정이 달라질
                수 있으며, 이 경우 상품 상세페이지 또는 별도 안내를 통해 고지합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제13조 (청약철회 등)</h2>
              <p>
                이용자는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 상품 수령일로부터 7일 이내에
                청약철회를 할 수 있습니다. 다만 다음 각 호의 경우에는 청약철회가 제한될 수 있습니다.
              </p>
              <ul className="list-disc pl-5 mt-1">
                <li>이용자의 책임 있는 사유로 상품이 멸실 또는 훼손된 경우(포장 개봉 등으로 상품 가치가 현저히 감소한 화장품·위생용품 등 포함)</li>
                <li>이용자의 사용 또는 일부 소비로 상품의 가치가 현저히 감소한 경우</li>
                <li>시간의 경과에 의하여 재판매가 곤란할 정도로 상품의 가치가 현저히 감소한 경우</li>
                <li>복제가 가능한 상품의 포장을 훼손한 경우</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제14조 (청약철회의 효과)</h2>
              <p>
                회사는 재화 등을 반환받은 날부터 3영업일 이내에 이미 지급받은 재화 등의 대금을 환급합니다.
                신용카드 등으로 대금을 지급한 경우, 회사는 지체 없이 해당 결제수단을 제공한 사업자(전자지급결제
                대행업체)에게 대금 청구를 정지 또는 취소하도록 요청합니다. 다만 전자지급결제대행업체의 정산
                절차 등 회사가 통제할 수 없는 사유로 대금 청구의 정지 또는 취소 요청 처리에 추가 시일이
                소요될 수 있으며, 이 경우에도 회사는 지체 없이 그 사유를 통지합니다. 청약철회 시 반환에
                필요한 비용은 이용자가 부담하되, 재화 등의 내용이 표시·광고 내용과 다르거나 계약내용과 다르게
                이행된 경우의 청약철회에 필요한 비용은 회사가 부담합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제15조 (면책)</h2>
              <p>
                회사는 천재지변 등 불가항력적 사유로 회사의 고의·과실 없이 발생한 손해에 대해서는 책임을
                지지 않습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제16조 (회사의 의무)</h2>
              <p>
                회사는 관계법령과 이 약관이 금지하는 행위를 하지 않으며, 지속적·안정적으로 서비스를 제공하기
                위하여 노력합니다. 회사는 이용자가 안전하게 서비스를 이용할 수 있도록 개인정보보호를 위한
                보안시스템을 갖춥니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제17조 (회원의 의무)</h2>
              <p>
                이용자는 회원가입 신청 또는 정보 변경 시 사실에 근거하여 정보를 기재해야 하며, 이 약관에서
                규정하는 사항과 기타 회사가 정한 제반 규정을 준수하여야 합니다. 이용자는 아이디 및 비밀번호
                관리에 대한 책임을 지며, 이를 제3자가 이용하도록 하여서는 안 됩니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제18조 (분쟁해결)</h2>
              <p>
                회사는 이용자가 제기하는 정당한 의견이나 불만을 반영하고 그 피해를 보상처리하기 위하여 고객센터를
                운영합니다. 회사와 이용자 간에 발생한 전자상거래 분쟁과 관련하여 이용자의 피해구제 신청이 있는
                경우에는 공정거래위원회 또는 시·도지사가 의뢰하는 분쟁조정기관의 조정을 따를 수 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제19조 (재판관할 및 준거법)</h2>
              <p>
                이 약관과 관련한 분쟁에 대하여는 대한민국 법을 적용하며, 회사와 이용자 간에 제기된 소송은
                민사소송법상의 관할법원에 제기합니다.
              </p>
            </section>
            <p className="text-[12px] text-text-hint pt-4 border-t" style={{ borderColor: '#e5e0d8' }}>
              공고일자: 2026-07-28 · 시행일자: 2026-07-28 · 문의: {COMPANY_INFO.csEmail}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
