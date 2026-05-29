import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import { CATEGORIES } from '../constants'

export default function AppCategory() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-cream-4 pb-20">
      <AppHeader />

      <div className="px-4 pt-5 pb-3">
        <h1 className="text-[18px] font-bold text-text">카테고리</h1>
        <p className="text-[13px] text-text-sub mt-1">원하는 카테고리를 선택하세요</p>
      </div>

      <div className="px-4 flex flex-col gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => navigate(`/app/category/${cat.id}`)}
            className="flex items-center gap-4 bg-white rounded-md p-4 border border-cream-2 text-left hover:border-gold/30 transition-colors focus:outline-none focus:shadow-focus w-full"
            aria-label={`${cat.label} 카테고리`}
          >
            <div
              className="w-14 h-14 rounded-[16px] flex items-center justify-center text-3xl flex-shrink-0"
              style={{ backgroundColor: cat.bg }}
              aria-hidden="true"
            >
              {cat.icon}
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-bold" style={{ color: cat.color }}>{cat.label}</p>
              <p className="text-[12px] text-text-sub mt-0.5">
                {cat.id === 'skincare' && '에센스, 크림, 세럼, 토너'}
                {cat.id === 'makeup' && '파운데이션, 립, 아이, 쉐딩'}
                {cat.id === 'perfume' && '오 드 퍼퓸, 오 드 뚜왈렛, 바디미스트'}
                {cat.id === 'hair' && '샴푸, 트리트먼트, 헤어오일'}
                {cat.id === 'body' && '바디워시, 바디로션, 핸드크림'}
              </p>
            </div>
            <span className="text-text-hint text-lg" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
