import { useNavigate } from 'react-router-dom'
import { useShopCategories } from '../../hooks/useShopCategories'

// 고객 상세/구매 페이지 상단 고정 카테고리 바.
// BackHeader(sticky top-0, h-14) 아래에 sticky top-14 로 붙어 스크롤해도 따라온다.
// 우리 실제 판매 카테고리(useShopCategories)를 노출하고, 클릭 시 해당 카테고리 목록으로 이동.
export default function CategoryTabBar({ active }: { active?: string | null }) {
  const navigate = useNavigate()
  const { categories } = useShopCategories()

  const go = (cat: string | null) =>
    navigate(cat ? `/app/category/all?cat=${encodeURIComponent(cat)}` : '/app/category/all')

  const chip = (label: string, isActive: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors border ${
        isActive
          ? 'bg-gold text-white border-gold'
          : 'bg-white text-text-sub border-cream-2 hover:border-gold/60 hover:text-text'
      }`}
    >
      {label}
    </button>
  )

  return (
    <nav className="sticky top-14 z-40 bg-white/95 backdrop-blur border-b border-cream-2">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-3 py-2.5">
        {chip('전체', active == null, () => go(null))}
        {categories.map((cat) => chip(cat, active === cat, () => go(cat)))}
      </div>
    </nav>
  )
}
