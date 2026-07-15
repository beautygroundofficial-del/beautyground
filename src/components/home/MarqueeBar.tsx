// 홈 상단 공지 마퀴 — 관리자 화면(home_settings.marquee_items)에서 편집
export default function MarqueeBar({ items }: { items: string[] }) {
  if (items.length === 0) return null
  const loop = [...items, ...items]

  return (
    <div className="h-[34px] bg-white border-b border-cream-2 overflow-hidden flex items-center">
      <div className="flex gap-10 whitespace-nowrap px-4 animate-marquee">
        {loop.map((text, i) => (
          <span key={i} className="text-[12.5px] font-semibold text-text">
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
