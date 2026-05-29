import type { LiveCard as LiveCardType } from '../../types'
import Badge from '../common/Badge'

export default function LiveCard({ brand, deptName, deptKey, productName, price, viewers, isLive, thumbColor }: LiveCardType) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-md p-3 border border-cream-2">
      <div
        className="relative w-[88px] h-[88px] rounded-md flex-shrink-0 flex items-center justify-center text-3xl overflow-hidden"
        style={{ backgroundColor: thumbColor }}
        aria-hidden="true"
      >
        💄
        {isLive && (
          <div className="absolute top-1.5 left-1.5">
            <Badge type="live" label="LIVE" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Badge type="dept" label={deptName} deptKey={deptKey} />
        </div>
        <p className="font-semibold text-[13px] text-text truncate">{brand}</p>
        <p className="text-text-sub text-[12px] truncate mt-0.5">{productName}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-gold font-bold text-[13px]">
            {price.toLocaleString('ko-KR')}원
          </span>
          <span className="text-text-hint text-[11px] flex items-center gap-1">
            <span aria-hidden="true">👁</span>
            {viewers.toLocaleString()}명 시청
          </span>
        </div>
      </div>
    </div>
  )
}
