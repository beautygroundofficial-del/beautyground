import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import { COMPANY_INFO } from '../../lib/companyInfo'

// ⚠️ PG 재신청 전 법률 검토 대상 — 소비자에게 공개되는 페이지이므로 화면에 "템플릿" 경고문구를 노출하지 말 것
// 2026-08-10: 기존 6개 항목(약식)을 13개 조항으로 확장 — 실제 수집 항목(소셜로그인·피부테스트·유입경로
// 자동수집 등)을 반영하고, 파기절차·쿠키·아동보호·권익구제기관 등 누락돼 있던 필수 조항을 보강.
// 피부테스트 사진은 브라우저 내에서만 처리되고 서버로 전송·저장되지 않음(src/pages/AppSkinTest.tsx 확인).
export default function Privacy() {
  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[720px] mx-auto px-6">
          <h1 className="font-serif text-[28px] font-bold text-text mb-8">개인정보처리방침</h1>
          <div className="bg-white rounded-md p-6 md:p-8 border text-[14px] text-text-sub leading-relaxed space-y-5" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <p>
              {COMPANY_INFO.name}(이하 "회사")는 회사가 운영하는 온라인 쇼핑몰(이하 "몰")을 이용하는 이용자의
              개인정보를 중요하게 생각하며, 「개인정보 보호법」, 「전자상거래 등에서의 소비자보호에 관한 법률」 등
              관계 법령을 준수합니다. 회사는 이용자의 권익을 보호하고 개인정보와 관련한 고충을 원활하게 처리하기
              위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.
            </p>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제1조 (수집하는 개인정보 항목 및 수집 방법)</h2>
              <p>
                회사는 서비스 제공에 필요한 최소한의 개인정보를 아래와 같이 수집합니다.
              </p>
              <ul className="list-disc pl-5 mt-1">
                <li>회원가입(이메일): 이름, 이메일 주소, 휴대전화번호, 비밀번호(암호화 저장)</li>
                <li>회원가입(카카오·네이버 소셜 로그인): 소셜 계정 고유 식별값, 이메일, 프로필 이름</li>
                <li>주문·결제·배송 시: 주문자·수령인 성명, 연락처, 배송지 주소, 결제 정보(결제대행사를 통해 처리되며 카드번호 등은 회사가 직접 보관하지 않음)</li>
                <li>고객상담 시: 문의 내용, 연락처, 이메일 주소</li>
                <li>피부테스트 기능 이용 시: 이용자가 선택적으로 촬영하는 얼굴 사진 — 분석을 위해 브라우저 내에서만 일시적으로 처리되며, 서버로 전송되거나 저장되지 않습니다</li>
                <li>걷기 포인트 기능 이용 시(선택): 이용자가 휴대폰 건강 앱(Apple 건강·Health Connect) 접근을 허용한 경우 그 날의 걸음 수 — 걸음 수 외의 건강 정보는 읽지 않으며, 허용은 기기 설정에서 언제든 철회할 수 있습니다.</li>
                <li>자동 수집 정보: 접속 IP, 쿠키, 접속 일시, 서비스 이용 기록, 기기·브라우저 정보, 방문 시 유입 경로(검색·SNS·광고 등)</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제2조 (개인정보의 수집 및 이용 목적)</h2>
              <ul className="list-disc pl-5 mt-1">
                <li>회원 식별 및 관리, 부정 이용 방지, 분쟁 처리를 위한 기록 보존</li>
                <li>상품 주문, 결제, 배송, 취소·교환·반품·환불 등 계약의 이행</li>
                <li>고객 상담 및 민원 처리</li>
                <li>공지사항 전달, 서비스 이용 통계 분석 및 서비스 개선</li>
                <li>걷기 포인트 지급 및 부정 지급 방지(걸음 수는 이 목적에만 사용하며 광고에 이용하거나 제3자에게 제공하지 않습니다)</li>
                <li>유입 경로 분석을 통한 서비스·마케팅 채널 운영(자동 수집 정보 활용, 개인 식별 목적 아님)</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제3조 (개인정보의 보유 및 이용 기간)</h2>
              <p>
                회사는 개인정보 수집 및 이용 목적이 달성되면 지체 없이 해당 정보를 파기합니다. 다만 관계 법령에
                따라 보존할 필요가 있는 경우에는 해당 기간 동안 보관합니다.
              </p>
              <ul className="list-disc pl-5 mt-1">
                <li>회원 정보: 회원 탈퇴 시까지</li>
                <li>걸음 수 기록: 회원 탈퇴 시까지(탈퇴 시 함께 파기)</li>
                <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
                <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
                <li>소비자 불만 또는 분쟁처리에 관한 기록: 3년</li>
                <li>접속 로그 기록: 3개월</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제4조 (개인정보의 파기 절차 및 방법)</h2>
              <p>
                개인정보는 보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 파기합니다. 전자적 파일
                형태로 저장된 개인정보는 복구 또는 재생이 불가능한 기술적 방법을 사용하여 삭제하며, 종이 문서에
                기록·저장된 개인정보는 분쇄하거나 소각하여 파기합니다. 피부테스트 사진은 별도 파기 절차가
                필요하지 않습니다 — 분석 처리 직후 자동으로 폐기되며 애초에 서버에 저장되지 않습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제5조 (개인정보의 제3자 제공 및 처리 위탁)</h2>
              <p>
                회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않으며, 다음의 경우에 한하여 서비스 제공에
                필요한 최소한의 범위에서 제공 또는 위탁합니다.
              </p>
              <ul className="list-disc pl-5 mt-1">
                <li>배송업체: 상품 배송을 위한 수령인 성명, 연락처, 배송지 주소</li>
                <li>전자지급결제대행사(PortOne 등): 결제 승인, 결제 취소, 환불, 부정거래 방지를 위한 결제 정보 처리</li>
                <li>클라우드 인프라 사업자: 회원·주문 데이터베이스 보관을 위한 시스템 운영·관리</li>
                <li>법령상 제출 의무가 있는 기관: 수사, 감독 등 법령에 따른 정당한 요청이 있는 경우</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제6조 (이용자의 권리와 행사 방법)</h2>
              <p>
                이용자는 언제든지 자신의 개인정보에 대해 열람, 정정, 삭제, 처리정지 및 회원 탈퇴를 요청할 수
                있습니다. 요청은 마이페이지, 고객센터 또는 전자우편을 통해 하실 수 있으며, 회사는 관계 법령에
                따라 지체 없이 조치합니다. 다만 주문·결제·배송 등 거래 관련 정보는 관계 법령에 따라 즉시
                삭제되지 않을 수 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제7조 (쿠키 등 자동 수집 장치의 설치·운영 및 거부)</h2>
              <p>
                회사는 서비스 이용 편의 향상, 로그인 상태 유지, 유입 경로 분석을 위해 쿠키를 사용할 수 있습니다.
                이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있으며, 이 경우 일부 서비스
                이용에 어려움이 있을 수 있습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제8조 (개인정보의 안전성 확보 조치)</h2>
              <p>
                회사는 개인정보의 안전한 처리를 위하여 비밀번호 암호화 저장, 개인정보 접근 권한의 최소화,
                개인정보처리시스템에 대한 접근 통제 등 기술적·관리적 보호조치를 시행합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제9조 (만 14세 미만 아동의 개인정보)</h2>
              <p>
                회사는 원칙적으로 만 14세 미만 아동의 회원가입을 허용하지 않으며, 만 14세 미만 아동의 개인정보를
                의도적으로 수집하지 않습니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제10조 (개인정보 보호책임자 및 문의처)</h2>
              <p>
                개인정보 보호와 관련한 문의, 불만 처리, 피해 구제 신청은 아래로 연락해 주시기 바랍니다.
                <br />
                개인정보 보호책임자: {COMPANY_INFO.privacyOfficer} · 이메일: {COMPANY_INFO.csEmail} · 전화: {COMPANY_INFO.csPhone}
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제11조 (권익침해 구제 방법)</h2>
              <p>이용자는 개인정보 침해에 대한 신고나 상담이 필요한 경우 아래 기관에 문의할 수 있습니다.</p>
              <ul className="list-disc pl-5 mt-1">
                <li>개인정보침해신고센터: (국번없이) 118 / privacy.kisa.or.kr</li>
                <li>개인정보분쟁조정위원회: 1833-6972 / kopico.go.kr</li>
                <li>개인정보보호 종합포털: privacy.go.kr</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">제12조 (개인정보처리방침의 변경)</h2>
              <p>
                이 개인정보처리방침은 법령, 서비스 내용의 변경에 따라 개정될 수 있으며, 변경 시 몰 화면을 통해
                사전에 공지합니다.
              </p>
            </section>
            <p className="text-[12px] text-text-hint pt-4 border-t" style={{ borderColor: '#e5e0d8' }}>
              공고일자: 2026-10-13 · 시행일자: 2026-10-13 · 문의: {COMPANY_INFO.csEmail}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
