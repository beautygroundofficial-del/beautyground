import type { CategoryThumbnail } from '../../hooks/useCategoryThumbnails'

interface CategoryShortcutGridProps {
  categories: string[]
  thumbnails: CategoryThumbnail[]
  onSelect: (category: string) => void
}

// 홈 화면 카테고리 원형 아이콘 그리드 (med-ligne 참고) — 상품이 있는 카테고리만 노출
export default function CategoryShortcutGrid({ categories, thumbnails, onSelect }: CategoryShortcutGridProps) {
  const imageOf = (category: string) => thumbnails.find((t) => t.category === category)?.imageUrl ?? null

  if (categories.length === 0) return null

  return (
    <section className="pt-6 px-4" aria-labelledby="home-category-grid">
      <h2 id="home-category-grid" className="sr-only">
        카테고리
      </h2>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4">
        {categories.map((category) => {
          const image = imageOf(category)
          return (
            <button
              key={category}
              onClick={() => onSelect(category)}
              className="flex flex-col items-center gap-1.5"
              aria-label={category}
            >
              <div className="w-14 h-14 rounded-full overflow-hidden bg-cream-3 flex items-center justify-center">
                {image ? (
                  <img src={image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl" aria-hidden="true">
                    💄
                  </span>
                )}
              </div>
              <span className="text-[12px] text-text truncate max-w-full">{category}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
