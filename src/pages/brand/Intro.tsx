import { Link } from 'react-router-dom'
import { IconMail, IconPhone } from '@tabler/icons-react'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'

// 브랜드 입점사용 공개 안내 페이지 (2026-09-18) — 로그인 없이 누구나 볼 수 있다.
// 관리자가 /admin/partners에서 셀프가입 링크(/brand/register/:id)를 복사할 때, 이 페이지
// 링크(/brand/intro)도 함께 보내서 "이렇게 가입하고, 셀러센터에서 이런 걸 할 수 있다"를
// 가입 전에 미리 보여준다. 로그인 후 화면별 상세 FAQ는 /brand/guide(BrandGuide)가 따로 있다 —
// 이 페이지는 그 축약판 + 가입 절차 안내다.

const card = 'bg-white rounded-[14px] border border-[#e5e0d8]'

const STEPS = [
  { title: '가입 링크 받기', body: '뷰티그라운드 담당자가 브랜드 전용 가입 링크를 메일 또는 문자로 보내드립니다.' },
  { title: '이메일·비밀번호 입력', body: '링크를 열면 브랜드명이 바로 확인되고, 아이디(이메일)와 비밀번호만 입력하면 가입이 끝납니다.' },
  { title: '셀러센터 바로 이용', body: '가입 즉시 대시보드로 이동해 상품 등록·판매 현황·정산 확인을 시작할 수 있습니다.' },
]

const FEATURES = [
  { title: '상품관리', body: '자사몰 상품 주소를 붙여넣으면 이름·가격·사진이 자동으로 채워집니다. 등록한 상품은 뷰티그라운드 확인 후 판매가 시작됩니다.' },
  { title: '판매관리', body: '내 상품이 언제 얼마나 팔렸는지 주문내역과 성과 리포트(기간별 판매 금액·순위)로 확인할 수 있습니다.' },
  { title: '정산·판매자 정보', body: '정산 내역을 확인하고, 사업자정보·정산계좌를 직접 관리할 수 있습니다.' },
  { title: '수출 소개', body: '해외 바이어에게 보여줄 브랜드 소개글과 이미지를 직접 작성할 수 있습니다.' },
]

export default function BrandIntro() {
  return (
    <>
      <GNB />
      <main style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[640px] mx-auto px-6 py-20 md:py-28">
          <div className="text-center mb-10">
            <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
              BRAND PARTNER
            </span>
            <h1 className="font-serif text-[26px] md:text-[32px] font-bold text-text mb-3">
              뷰티그라운드 브랜드 셀러센터
            </h1>
            <p className="text-[13.5px] text-text-sub leading-relaxed">
              입점 브랜드가 직접 상품을 등록하고, 판매 현황과 정산을 확인하는 공간입니다.
              <br />
              가입은 뷰티그라운드가 보내드리는 전용 링크로만 진행됩니다.
            </p>
          </div>

          <div className={`${card} p-6 md:p-8 mb-6`}>
            <h2 className="text-[15px] font-bold text-text mb-5">가입 방법</h2>
            <div className="space-y-5">
              {STEPS.map((s, i) => (
                <div key={s.title} className="flex gap-4">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-[#f7f4ef] border border-[#e5e0d8] flex items-center justify-center text-[13px] font-bold text-gold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-text mb-1">{s.title}</p>
                    <p className="text-[13px] text-text-sub leading-relaxed">{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 pt-5 border-t border-[#efeae1] text-[12.5px] text-text-sub leading-relaxed">
              아직 가입 링크를 받지 못하셨다면 아래 문의처로 연락해 주세요.
            </p>
          </div>

          <div className={`${card} p-6 md:p-8 mb-6`}>
            <h2 className="text-[15px] font-bold text-text mb-5">셀러센터에서 할 수 있는 일</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <p className="text-[13.5px] font-semibold text-text mb-1">{f.title}</p>
                  <p className="text-[12.5px] text-text-sub leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} p-6 md:p-8 mb-6 text-center`}>
            <p className="text-[13px] text-text-sub mb-4">이미 가입 링크로 계정을 만드셨나요?</p>
            <Link to="/brand/login">
              <Button variant="ink" size="md" label="브랜드 로그인" className="w-full sm:w-auto sm:px-10" />
            </Link>
          </div>

          <div className={`${card} p-6 md:p-8`}>
            <h2 className="text-[14px] font-bold text-text mb-4">문의하기</h2>
            <div className="space-y-3">
              <a href="mailto:beautyground.official@gmail.com" className="flex items-center gap-2.5 text-[13.5px] text-text">
                <IconMail size={17} className="text-gold" />
                beautyground.official@gmail.com
              </a>
              <a href="tel:02-897-8287" className="flex items-center gap-2.5 text-[13.5px] text-text">
                <IconPhone size={17} className="text-gold" />
                02-897-8287
              </a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
