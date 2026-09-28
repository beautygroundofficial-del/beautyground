import { Link } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import { COMPANY_INFO } from '../../lib/companyInfo'

// 계정 삭제 안내(공개 페이지) — Google Play 데이터 안전 양식의 "계정 삭제 요청 URL"과 Apple 5.1.1(v)가 요구하는
// "앱 밖에서도 삭제 방법을 알 수 있는 페이지". 실제 삭제는 앱 안 마이페이지 > 계정 관리 > 회원탈퇴에서 즉시 처리된다(AppAccount.tsx).
export default function AccountDelete() {
  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[720px] mx-auto px-6">
          <h1 className="font-serif text-[28px] font-bold text-text mb-8">계정 삭제 안내</h1>
          <div className="bg-white rounded-md p-6 md:p-8 border text-[14px] text-text-sub leading-relaxed space-y-5" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <p>
              뷰티그라운드 앱·웹 회원은 언제든지 직접 계정을 삭제(회원탈퇴)할 수 있습니다. 삭제는 즉시 처리되며 별도 심사나 대기 기간이 없습니다.
            </p>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">1. 앱 또는 웹에서 직접 삭제하기</h2>
              <ol className="list-decimal pl-5 space-y-1">
                <li>로그인 후 <b>마이페이지</b>로 이동합니다.</li>
                <li><b>계정 관리</b>(회원정보 수정)를 누릅니다.</li>
                <li>맨 아래 <b>회원탈퇴 신청</b>을 누르고 안내를 확인한 뒤 <b>탈퇴</b>를 누릅니다.</li>
              </ol>
              <p className="mt-2">
                <Link to="/app/account" className="underline underline-offset-4 text-text">계정 관리로 바로 가기</Link>
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">2. 이메일로 요청하기</h2>
              <p>
                앱에 접근할 수 없는 경우 가입한 이메일 주소로 <a href={`mailto:${COMPANY_INFO.csEmail}?subject=계정 삭제 요청`} className="underline underline-offset-4 text-text">{COMPANY_INFO.csEmail}</a>에
                "계정 삭제 요청"을 보내 주세요. 본인 확인 후 영업일 기준 3일 이내에 처리하고 결과를 회신합니다.
              </p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">3. 삭제되는 정보</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>로그인 계정(이메일·소셜 로그인 연결), 이름·연락처·배송지 등 회원정보</li>
                <li>커뮤니티에 남긴 이야기·댓글·좋아요·친구 관계, 적립금·쿠폰, 찜 목록, 걸음·미션 기록</li>
                <li>파트너스(제휴) 정보 및 정산 대기 중이 아닌 링크</li>
              </ul>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">4. 법령에 따라 일정 기간 보관되는 정보</h2>
              <p>
                「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 아래 기록은 계정 삭제 후에도 정해진 기간 동안 분리 보관한 뒤 파기합니다.
              </p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
                <li>대금결제 및 재화 등의 공급에 관한 기록: 5년</li>
                <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년</li>
              </ul>
              <p className="mt-2">자세한 내용은 <Link to="/privacy" className="underline underline-offset-4 text-text">개인정보처리방침</Link>을 확인해 주세요.</p>
            </section>
            <section>
              <h2 className="text-[15px] font-bold text-text mb-2">5. 문의</h2>
              <p>{COMPANY_INFO.name} · {COMPANY_INFO.csEmail} · {COMPANY_INFO.csPhone}</p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
