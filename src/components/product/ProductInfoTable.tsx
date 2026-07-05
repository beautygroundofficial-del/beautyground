import type { ReactNode } from 'react'
import { SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, REWARD_RATE, MADE_IN } from '../../constants'

interface ProductInfoTableProps {
  consumerPrice: number // 소비자가(정가)
  salePrice: number // 판매가
  brand?: string
  madeIn?: string
  showPrice?: boolean // 소비자가·판매가 행 표시 여부(가격이 위에 따로 있으면 false)
  className?: string
}

// petitfee 스타일 상품 정보 테이블 (소비자가·판매가·적립금·브랜드·제조국·배송비)
// 고객 상세 / 파트너 상품관리 상세 공용. 배송·적립 정책은 constants 에서 전역 관리.
export default function ProductInfoTable({
  consumerPrice,
  salePrice,
  brand,
  madeIn = MADE_IN,
  showPrice = true,
  className = '',
}: ProductInfoTableProps) {
  const hasDiscount = salePrice < consumerPrice
  const reward = Math.floor((salePrice * REWARD_RATE) / 10) * 10 // 10원 단위 내림
  const priceRows: Array<[string, ReactNode]> = showPrice
    ? [
        [
          '소비자가',
          <span className={hasDiscount ? 'line-through text-[#bbb]' : 'text-[#111]'}>
            {consumerPrice.toLocaleString('ko-KR')}원
          </span>,
        ],
        ['판매가', <span className="font-bold text-[#c0392b]">{salePrice.toLocaleString('ko-KR')}원</span>],
      ]
    : []
  const rows: Array<[string, ReactNode]> = [
    ...priceRows,
    ['적립금', `${reward.toLocaleString('ko-KR')}원 (${Math.round(REWARD_RATE * 100)}%)`],
    ...(brand ? [['브랜드', brand] as [string, ReactNode]] : []),
    ['제조국', madeIn],
    [
      '배송비',
      `${SHIPPING_FEE.toLocaleString('ko-KR')}원 (${FREE_SHIPPING_THRESHOLD.toLocaleString('ko-KR')}원 이상 구매 시 무료)`,
    ],
  ]
  return (
    <dl className={`text-[13px] ${className}`}>
      {rows.map(([label, value], i) => (
        <div key={i} className="flex items-start py-2.5 border-b border-[#f0ede7] last:border-b-0">
          <dt className="w-[84px] shrink-0 text-[#8a8a8a]">{label}</dt>
          <dd className="flex-1 text-[#333] leading-relaxed">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
