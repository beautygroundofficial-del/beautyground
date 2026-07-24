import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import { COMPANY_INFO } from '../../lib/companyInfo'

const ROWS: [string, string][] = [
  ['상호명', COMPANY_INFO.name],
  ['대표자', COMPANY_INFO.ceo],
  ['사업자등록번호', COMPANY_INFO.bizNumber],
  ['통신판매업신고번호', COMPANY_INFO.mailOrderNumber],
  ['사업장 주소', COMPANY_INFO.address],
  ['고객센터', COMPANY_INFO.csPhone],
  ['이메일', COMPANY_INFO.csEmail],
]

export default function Company() {
  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[640px] mx-auto px-6">
          <h1 className="font-serif text-[28px] font-bold text-text mb-8">회사소개</h1>
          <div className="bg-white rounded-md p-6 md:p-8 border" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <p className="text-[14px] text-text-sub leading-relaxed mb-6">
              {COMPANY_INFO.name}는 다양한 브랜드의 뷰티 상품을 한 곳에서 만나볼 수 있는
              온라인 셀렉샵입니다.
            </p>
            <table className="w-full text-[14px]">
              <tbody>
                {ROWS.map(([label, value]) => (
                  <tr key={label} className="border-t first:border-t-0" style={{ borderColor: '#e5e0d8' }}>
                    <th className="text-left text-text-hint font-medium py-3 pr-4 w-[140px] align-top">{label}</th>
                    <td className="py-3 text-text">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
