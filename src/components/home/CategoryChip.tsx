import type { CategoryChip as CategoryChipType } from '../../types'

interface CategoryChipProps extends CategoryChipType {
  onClick?: (id: string) => void
}

export default function CategoryChip({ id, label, icon, bg, color, onClick }: CategoryChipProps) {
  return (
    <button
      onClick={() => onClick?.(id)}
      className="flex flex-col items-center gap-1.5 focus:outline-none focus:shadow-focus rounded-md"
      aria-label={`${label} 카테고리`}
    >
      <div
        className="w-[54px] h-[54px] rounded-[16px] flex items-center justify-center text-2xl transition-transform hover:scale-105 active:scale-95"
        style={{ backgroundColor: bg }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <span className="text-[11px] font-medium" style={{ color }}>
        {label}
      </span>
    </button>
  )
}
