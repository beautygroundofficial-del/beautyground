export default function AppHeader() {
  return (
    <header className="bg-white flex items-center justify-between px-4 py-3 border-b border-cream-2 sticky top-0 z-50">
      <span className="font-serif text-[20px] font-bold text-gold">뷰티관</span>
      <div className="flex items-center gap-4">
        <button className="relative" aria-label="알림">
          <span className="text-xl" aria-hidden="true">🔔</span>
          <span className="absolute top-0 right-0 w-2 h-2 bg-[#FF4757] rounded-full" aria-hidden="true" />
        </button>
        <button aria-label="장바구니">
          <span className="text-xl" aria-hidden="true">🛒</span>
        </button>
      </div>
    </header>
  )
}
