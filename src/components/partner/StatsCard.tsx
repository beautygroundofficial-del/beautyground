import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react'

interface StatsCardProps {
  label: string
  value: string | number
  unit?: string
  change?: number
  color?: string
}

export default function StatsCard({ label, value, unit, change, color }: StatsCardProps) {
  const isUp = change !== undefined && change > 0
  const isDown = change !== undefined && change < 0

  return (
    <div
      className="bg-white border border-[#e5e0d8] rounded-[14px] p-6"
      style={color ? { borderTop: `3px solid ${color}` } : undefined}
    >
      <p className="text-[12px] text-[#9a9080] mb-2">{label}</p>
      <div className="flex items-end gap-1">
        <p className="font-serif text-[28px] font-bold text-[#111] leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {unit && <span className="text-[13px] text-[#9a9080] mb-0.5">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-[12px] font-medium ${isUp ? 'text-[#1D9E75]' : isDown ? 'text-[#D85A30]' : 'text-[#9a9080]'}`}>
          {isUp && <IconTrendingUp size={14} />}
          {isDown && <IconTrendingDown size={14} />}
          <span>전월 대비 {isUp ? '+' : ''}{change}%</span>
        </div>
      )}
    </div>
  )
}
