import type { DeptKey } from '../../types'

interface BadgeProps {
  type: 'live' | 'dept' | 'age' | 'tag' | 'vip'
  label: string
  deptKey?: DeptKey
  className?: string
}

const DEPT_BADGE_COLORS: Record<DeptKey, string> = {
  lotte: 'bg-[#FAECE7] text-[#712B13]',
  shinsegae: 'bg-[#E1F5EE] text-[#085041]',
  hyundai: 'bg-[#EEEDFE] text-[#3C3489]',
}

export default function Badge({ type, label, deptKey, className = '' }: BadgeProps) {
  let classes = ''

  if (type === 'live') {
    classes = 'bg-[#FF4757] text-white text-[9px] font-bold px-2 py-0.5 rounded-pill tracking-wider'
  } else if (type === 'dept' && deptKey) {
    classes = `${DEPT_BADGE_COLORS[deptKey]} text-[11px] font-medium px-2.5 py-1 rounded-pill`
  } else if (type === 'vip') {
    classes = 'bg-gold text-white text-[10px] font-bold px-2.5 py-0.5 rounded-pill'
  } else if (type === 'age') {
    classes = 'bg-cream-2 text-text-sub text-[11px] font-medium px-2.5 py-1 rounded-pill'
  } else {
    classes = 'bg-cream-2 text-text-sub text-[12px] px-3 py-1 rounded-pill'
  }

  return (
    <span className={[classes, className].join(' ')} aria-label={label}>
      {label}
    </span>
  )
}
