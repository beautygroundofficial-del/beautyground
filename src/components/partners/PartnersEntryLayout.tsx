import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import './partnersEntry.css'

// 파트너스 입구·가입 화면의 공통 틀 — 왼쪽(PC)/위(모바일) 소개, 오른쪽/아래 행동 카드.
export default function PartnersEntryLayout({ backTo, children }: { backTo: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="pe-page">
      <header className="pe-top">
        <span className="pe-brand">뷰티그라운드<small>파트너스</small></span>
        <button type="button" className="pe-back" onClick={() => navigate(backTo)}>← 돌아가기</button>
      </header>
      <div className="pe-wrap">
        <section className="pe-hero">
          <p className="pe-eyebrow" style={{ margin: 0 }}>뷰티그라운드 파트너스</p>
          <h1>내 링크로 소개하고<br />판매수수료를 받아요</h1>
          <p>
            쇼핑몰 어느 제품이든 링크를 복사·공유해 친구·SNS에 올리면, 그 링크로 구매가 일어날 때마다
            판매금액의 <b>5%부터</b> 쌓여요. 재고도, 배송도, 비용도 없어요.
          </p>
          <ol className="pe-steps">
            {[
              ['회원가입 또는 로그인', '쇼핑 계정이 있으면 그대로 이어가요'],
              ['개인정보·계좌 등록', '수수료를 받을 계좌를 한 번만 입력'],
              ['내 링크 만들기', '제품 페이지의 [링크 복사]·[공유하기]로 바로'],
            ].map(([t, d], i) => (
              <li key={t}><span className="n">{i + 1}</span><div><b>{t}</b><span>{d}</span></div></li>
            ))}
          </ol>
          <p className="pe-note">
            링크를 공유해 소개하는 방식이에요. 다른 파트너를 모집하거나 하위 판매에 대한 수당은 없어요.
            수수료는 결제 완료 후 취소·환불되지 않은 주문 기준으로 매월 정산해 익월 10일에 보내드려요. 본인이 산 주문은 제외돼요.
          </p>
        </section>
        <section className="pe-panel">{children}</section>
      </div>
    </div>
  )
}
