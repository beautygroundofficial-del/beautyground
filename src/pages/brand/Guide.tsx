import { IconMail, IconPhone } from '@tabler/icons-react'

// 브랜드 셀러센터 — 이용 가이드 (2026-09-12)
// 로드맵 "브랜드 셀러센터 메뉴 구조 확정" 8번(고객지원). 별도 문의 시스템 없이, 화면별 사용법을
// 한 페이지에 정리하고 문의 창구(영업 담당 메일·전화)만 안내한다 — 새 티켓/채팅 시스템은
// 과한 범위라 만들지 않았다.

const card = 'bg-white rounded-[14px] border border-[#e5e0d8]'

interface GuideItem {
  title: string
  body: string
}

const SECTIONS: { heading: string; items: GuideItem[] }[] = [
  {
    heading: '판매자 정보',
    items: [
      {
        title: '사업자 정보·정산계좌는 어디서 고치나요?',
        body: '왼쪽 메뉴 "판매자 정보"에서 사업자등록번호·대표자명·주소·담당자 연락처·정산계좌를 직접 확인하고 고칠 수 있습니다. 브랜드명·입점상태·수수료율은 계약사항이라 이 화면에서 고칠 수 없고, 변경이 필요하면 담당자에게 문의해 주세요.',
      },
    ],
  },
  {
    heading: '상품관리',
    items: [
      {
        title: '상품은 어떻게 등록하나요?',
        body: '"상품관리"에서 자사몰 상품 페이지 주소를 붙여넣으면 상품명·가격·사진이 자동으로 채워집니다. 카페24 등 대부분의 쇼핑몰은 자동으로 읽히고, 스마트스토어처럼 읽히지 않는 곳은 직접 입력하시면 됩니다.',
      },
      {
        title: '등록한 상품은 바로 판매되나요?',
        body: '아니요. 등록한 상품은 "확인 대기" 상태로 들어가고, 뷰티그라운드가 내용을 확인한 뒤 "판매중"으로 전환합니다. 이미 판매중인 상품을 수정한 내용은 별도 확인 없이 바로 반영됩니다.',
      },
      {
        title: '상품정보고시(전성분·사용기한 등)는 꼭 입력해야 하나요?',
        body: '화장품을 온라인으로 판매할 때 표시해야 하는 항목입니다. 비워두면 소비자 화면에 "미기재"로 표시되니, 가능하면 등록·수정 시 함께 입력해 주세요.',
      },
      {
        title: '재고는 어떻게 바꾸나요?',
        body: '"상품관리" 목록에서 재고 숫자를 바로 고쳐 저장할 수 있습니다. 재고가 0이 되면 자동으로 품절 처리되고, 다시 채워 넣으면 자동으로 판매중으로 돌아갑니다.',
      },
    ],
  },
  {
    heading: '판매관리',
    items: [
      {
        title: '주문내역에서 뭘 볼 수 있나요?',
        body: '내 상품이 언제·얼마나 팔렸는지 확인할 수 있습니다. 배송은 뷰티그라운드 매장이 직접 처리하므로, 구매자 이름·연락처·배송지 같은 개인정보는 보호를 위해 이 화면에 표시되지 않습니다.',
      },
      {
        title: '성과 리포트는 무엇을 보여주나요?',
        body: '기간(7/30/90일·전체)을 골라 판매 금액·수량·주문건수·건당 평균, 일별 판매 추이, 상품별 판매 순위 Top10을 확인할 수 있습니다.',
      },
    ],
  },
  {
    heading: '정산·수출',
    items: [
      {
        title: '정산은 언제 되나요?',
        body: '"정산내역"에서 확정된 정산 건을 확인할 수 있습니다. 매월 정해진 주기로 정산서가 발송되며, 자세한 일정은 계약서를 참고하거나 담당자에게 문의해 주세요.',
      },
      {
        title: '수출 소개는 무엇인가요?',
        body: '해외 바이어에게 보여줄 브랜드 소개글·인증정보·대표 이미지를 직접 작성하는 공간입니다. 실제 바이어 발굴·컨택은 뷰티그라운드가 전담합니다.',
      },
    ],
  },
]

export default function BrandGuide() {
  return (
    <>
      <div className={`${card} p-6 mb-6`}>
        <h1 className="text-[16px] font-bold text-[#111] mb-1.5">셀러센터 이용 가이드</h1>
        <p className="text-[13px] text-[#9a9080] leading-relaxed">
          자주 묻는 내용을 화면별로 정리했습니다. 여기 없는 내용은 아래 문의처로 연락해 주세요.
        </p>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.heading} className={`${card} p-6 mb-6`}>
          <h2 className="text-[14px] font-bold text-[#111] mb-4">{section.heading}</h2>
          <div className="space-y-5">
            {section.items.map((item) => (
              <div key={item.title}>
                <p className="text-[13.5px] font-semibold text-[#111] mb-1">{item.title}</p>
                <p className="text-[13px] text-[#6b6355] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={`${card} p-6`}>
        <h2 className="text-[14px] font-bold text-[#111] mb-4">문의하기</h2>
        <div className="space-y-3">
          <a href="mailto:beautyground.official@gmail.com" className="flex items-center gap-2.5 text-[13.5px] text-[#111]">
            <IconMail size={17} className="text-[#b8924a]" />
            beautyground.official@gmail.com
          </a>
          <a href="tel:02-897-8287" className="flex items-center gap-2.5 text-[13.5px] text-[#111]">
            <IconPhone size={17} className="text-[#b8924a]" />
            02-897-8287
          </a>
        </div>
      </div>
    </>
  )
}
