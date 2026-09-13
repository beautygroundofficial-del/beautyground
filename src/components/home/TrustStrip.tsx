import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../../constants'

// "왜 뷰티그라운드에서 사야 하는가" 요약 — 배송비 기준·신규가입 혜택·정품 안내를 한 줄씩.
// 홈 어디에도 이런 요약이 없어서(대표님 지적, 2026-08-06) 히어로 배너 바로 아래에 얇게 배치.
const ITEMS = [
  { label: '무료배송', desc: `${FREE_SHIPPING_THRESHOLD.toLocaleString('ko-KR')}원 이상 구매 시 (미만 ${SHIPPING_FEE.toLocaleString('ko-KR')}원)` },
  { label: '신규가입 혜택', desc: '가입만 해도 3,000원, 첫 구매하면 쿠폰까지' },
]

export default function TrustStrip() {
  return (
    <div className="border-y border-rule bg-quiet/40">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-3 flex flex-wrap gap-x-6 gap-y-1.5 justify-center md:justify-start">
        {ITEMS.map((item) => (
          <p key={item.label} className="text-[12px] text-ink-soft whitespace-nowrap">
            <span className="font-bold text-ink">{item.label}</span>
            <span className="mx-1 text-ink-faint">·</span>
            {item.desc}
          </p>
        ))}
      </div>
    </div>
  )
}
