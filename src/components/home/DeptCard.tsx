import type { DeptCard as DeptCardType } from '../../types'
import Badge from '../common/Badge'

interface DeptCardProps extends Omit<DeptCardType, 'key'> {
  className?: string
}

const DEPT_EMOJI: Record<string, string> = {
  lotte: '🏪',
  shinsegae: '🏬',
  hyundai: '🏢',
}

export default function DeptCard({ name, brandCount, isVip, bgColor, textColor, accentColor, className = '' }: DeptCardProps) {
  const deptKey = name.includes('롯데') ? 'lotte' : name.includes('신세계') ? 'shinsegae' : 'hyundai'
  const emoji = DEPT_EMOJI[deptKey] ?? '🏪'

  return (
    <button
      className={`relative flex flex-col justify-between rounded-md p-4 min-h-[96px] w-full text-left transition-opacity hover:opacity-90 active:opacity-80 focus:outline-none focus:shadow-focus ${className}`}
      style={{ backgroundColor: bgColor }}
      aria-label={`${name} 입장`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl" aria-hidden="true">{emoji}</span>
        <div className="flex items-center gap-1.5">
          {isVip && <Badge type="vip" label="VIP" />}
          <span className="text-[11px] font-medium" style={{ color: accentColor }}>
            {brandCount}개 브랜드
          </span>
        </div>
      </div>
      <p className="text-[14px] font-bold leading-tight mt-2" style={{ color: textColor }}>
        {name}
      </p>
    </button>
  )
}
