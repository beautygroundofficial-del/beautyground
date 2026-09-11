// 상품정보고시 — 전자상거래법상 구매 전 표시 의무 항목. 예전엔 "전성분은 제품 포장을 참조해
// 주세요"라며 구매 후로 미뤘는데(고지 의무 취지와 안 맞음), 이제 실제 값이 있으면 그대로 보여주고
// 없으면 "미기재"라고 정직하게 표시한다(2026-09-11, 대표님 지시: 법적 문제 없이).
// 모바일(AppProductDetail)·PC(DesktopProductDetail) 공용.
export interface ProductInfoFields {
  capacityWeight: string | null
  ingredients: string | null
  expiryInfo: string | null
  usageMethod: string | null
  manufacturer: string | null
  responsibleSeller: string | null
  precautions: string | null
  qualityStandard: string | null
}

const INFO_ROWS: { key: keyof ProductInfoFields; label: string }[] = [
  { key: 'capacityWeight', label: '내용물의 용량 또는 중량' },
  { key: 'ingredients', label: '전성분' },
  { key: 'expiryInfo', label: '사용기한(또는 개봉 후 사용기간)' },
  { key: 'usageMethod', label: '사용방법' },
  { key: 'manufacturer', label: '제조업자' },
  { key: 'responsibleSeller', label: '책임판매업자' },
  { key: 'precautions', label: '사용할 때의 주의사항' },
  { key: 'qualityStandard', label: '품질보증기준' },
]

export default function ProductInfoNotice({ info, className = 'mx-4 mb-5' }: { info: ProductInfoFields; className?: string }) {
  return (
    <div className={`${className} border border-rule rounded-control p-4`}>
      <p className="text-[12.5px] font-bold text-ink mb-2.5">상품정보고시</p>
      <dl className="text-[12px] text-ink-soft leading-relaxed">
        {INFO_ROWS.map(({ key, label }) => (
          <div key={key} className="flex gap-2 py-1 border-b border-rule last:border-0">
            <dt className="w-[132px] shrink-0 text-ink-faint">{label}</dt>
            <dd className="flex-1 whitespace-pre-line">{info[key] || '미기재'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
