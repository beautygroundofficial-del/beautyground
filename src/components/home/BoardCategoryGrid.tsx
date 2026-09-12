import { useNavigate } from 'react-router-dom'
import type { BoardCategory } from '../../lib/board'

// 카테고리 아이콘 그리드 — 대표님이 참고로 준 앱(소모임류) 레퍼런스의 "인기 관심분야" 그리드를
// 그대로 우리 카테고리에 대입한 것(2026-09-13). 자전거 같은 레퍼런스 내용은 가져오지 않고,
// 아이콘+텍스트 크기·간격과 "누르면 그 주제로 들어간다"는 동작, 그리고 대표님이 받은 디자인
// 명세서의 실측 수치(원형 아이콘 56pt, 라벨 12pt, 섹션 제목 16pt/상단여백 32pt)를 그대로 대입했다.
// 짧은 그리드용 라벨 + 이모지는 board.ts의 BOARD_CATEGORIES(정식 라벨·힌트)와 별개로 여기서만 쓴다.

// 명세서의 "Sub Color(브랜드 컬러)" 5색을 카테고리마다 옅게(10%) 깔아 구분한다 — 원본 아이콘
// 배경이 전부 회색 하나였던 것을 레퍼런스처럼 색으로 나눴다.
const SUB_COLORS = ['#E84FB4', '#E6C200', '#E06000', '#009BB0', '#1E9F45']

const GRID_ITEMS: { key: BoardCategory; short: string; emoji: string }[] = [
  { key: 'kids', short: '육아', emoji: '🧸' },
  { key: 'spouse', short: '부부', emoji: '💍' },
  { key: 'parents', short: '부모님', emoji: '🌷' },
  { key: 'body', short: '건강', emoji: '🏃‍♀️' },
  { key: 'menopause', short: '갱년기', emoji: '🌿' },
  { key: 'skin', short: '피부', emoji: '✨' },
  { key: 'mind', short: '마음', emoji: '💛' },
  { key: 'living', short: '살림', emoji: '🏠' },
  { key: 'eco', short: '절약', emoji: '♻️' },
  { key: 'chat', short: '잡담', emoji: '💬' },
]

export default function BoardCategoryGrid() {
  const navigate = useNavigate()
  const go = (key: BoardCategory) => navigate('/app/board', { state: { category: key } })

  return (
    <section className="px-5 pt-8">
      <h2 className="text-[16px] font-bold text-ink mb-3">관심 있는 이야기부터</h2>
      <div className="grid grid-cols-5 gap-y-4">
        {GRID_ITEMS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => go(c.key)}
            className="flex flex-col items-center gap-1.5 focus:outline-none focus-visible:shadow-ring"
          >
            <span
              className="w-14 h-14 rounded-full flex items-center justify-center text-[22px]"
              style={{ backgroundColor: `${SUB_COLORS[i % SUB_COLORS.length]}1A` }}
              aria-hidden="true"
            >
              {c.emoji}
            </span>
            <span className="text-[12px] font-medium text-ink-soft leading-none">{c.short}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
