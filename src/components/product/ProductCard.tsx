import type { ProductCard as ProductCardType } from '../../types'
import { DEPT_COLOR } from '../../constants'

export default function ProductCard({ brand, name, price, originalPrice, deptName, deptKey, thumbIcon, thumbColor }: ProductCardType) {
  const deptStyle = DEPT_COLOR[deptKey]

  return (
    <div className="bg-white rounded-md overflow-hidden border border-cream-2">
      <div
        className="h-[110px] flex items-center justify-center text-4xl"
        style={{ backgroundColor: thumbColor }}
        aria-hidden="true"
      >
        {thumbIcon}
      </div>
      <div className="p-3">
        <p className="text-[11px] text-text-sub font-medium">{brand}</p>
        <p className="text-[13px] font-semibold text-text mt-0.5 line-clamp-2 leading-tight">{name}</p>
        <div className="mt-1.5">
          <span className="text-[14px] font-bold text-text">
            {price.toLocaleString('ko-KR')}원
          </span>
          {originalPrice && (
            <span className="text-text-hint text-[11px] line-through ml-1.5">
              {originalPrice.toLocaleString('ko-KR')}원
            </span>
          )}
        </div>
        <div className="mt-2">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-pill"
            style={{ backgroundColor: deptStyle.bg, color: deptStyle.text }}
          >
            {deptName}
          </span>
        </div>
      </div>
    </div>
  )
}
