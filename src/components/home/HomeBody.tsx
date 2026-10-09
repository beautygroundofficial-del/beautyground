import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { BoardCategory } from '../../lib/board'
import { IconPencil } from '@tabler/icons-react'
import AppHeader from '../layout/AppHeader'
import MarqueeBar from './MarqueeBar'
import TodayQuestion from '../community/TodayQuestion'
import BoardHomeFeed from './BoardHomeFeed'
import BoardCategoryGrid from './BoardCategoryGrid'
import FeaturedDailyStory from './FeaturedDailyStory'
import type { HeroBanner } from '../../hooks/useHeroBanners'
import type { ShopProduct } from '../../hooks/useShopProducts'
import type { ShopBrand } from '../../hooks/useShopBrands'

interface HomeBodyProps {
  marqueeItems: string[]
  banners: HeroBanner[]
  bannerLoading?: boolean
  recommended: ShopProduct[]
  seasonLabel: string | null
  products: ShopProduct[]
  prodLoading: boolean
  saleProducts: ShopProduct[]
  saleLoading: boolean
  brands: ShopBrand[]
  brandsLoading: boolean
  onProductClick: (id: string) => void
  // 호출부가 이 컴포넌트 바로 위에 PromoBar를 렌더링했는지 — AppHeader의 스크롤 고정 위치를 그만큼 내려 붙인다.
  promoBarAbove?: boolean
}

// 홈 화면 본문.
//
// 2026-09-02 전환 — 대표님 지시 "홈을 누르면 제품 페이지가 있으면 안 된다. 주인공은 커뮤니티다."
// 배너·할인특가·추천·신상품 등 상품 영역은 지우지 않고 전부 '쇼핑' 탭(/app/category)으로 옮겼다.
// 홈에는 오늘 할 일(미션)과 사람들의 이야기만 남긴다.
//
// props 는 호출부(AppHome·관리자 미리보기) 호환을 위해 그대로 받되 상품 관련 값은 쓰지 않는다.
export default function HomeBody({ marqueeItems, promoBarAbove = false }: HomeBodyProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [category, setCategory] = useState<BoardCategory | null>(null)

  return (
    <>
      <MarqueeBar items={marqueeItems} />
      <AppHeader promoBarAbove={promoBarAbove} />

      <section className="mx-5 mt-2 border-b border-rule pb-3" aria-label="뷰티그라운드 이용 안내">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[19px] font-bold tracking-[-0.03em] text-ink">우리의 일상이 모이는 곳</h1>
          <button type="button" onClick={() => navigate('/app/friends')} className="min-h-11 shrink-0 text-[12px] font-semibold text-ink focus-visible:shadow-ring">내 친구 →</button>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-soft">편하게 읽고, 마음이 닿으면 함께 이야기해요.</p>
      </section>

      {/* 홈은 발견과 짧은 미리보기, 전체 목록은 이야기 화면에서 제공한다. */}
      <div id="home-topics" className="scroll-mt-28">
        <BoardCategoryGrid selectedCategory={category} onSelect={setCategory} compact />
      </div>
      {/* 대표 일기와 최신 주제 글은 서로 다른 목록이므로 중복 노출하지 않는다. */}
      <div id="home-days" className="scroll-mt-28"><FeaturedDailyStory /></div>
      <BoardHomeFeed category={category} compact />

      {/* 오늘의 이야기 쓰기 */}
      <section className="mx-5 my-4 rounded-card border border-rule bg-quiet/40" aria-label="이야기 참여">
        <button
          onClick={() => navigate('/app/diary/write')}
          className="flex w-full items-center gap-3 rounded-card p-4 text-left transition-colors hover:bg-rule/50 focus:outline-none focus-visible:shadow-ring"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper" aria-hidden="true"><IconPencil size={20} stroke={1.6} /></span>
          <span className="min-w-0">
            <span className="block text-[16px] font-bold leading-relaxed text-ink">오늘 어떤 하루였나요?</span>
            <span className="block text-[13px] leading-relaxed text-ink-soft mt-1">짧게라도 좋아요. 이야기 쓰기 →</span>
          </span>
        </button>
        <details key={location.search} open={new URLSearchParams(location.search).has('answer') || location.hash === '#home-question'} id="home-question" className="border-t border-rule scroll-mt-28">
          <summary className="cursor-pointer px-4 py-3 text-[14px] font-semibold text-ink focus-visible:shadow-ring">오늘의 질문 · 한 줄 나누기</summary>
          <div className="px-4 pb-4"><TodayQuestion /></div>
        </details>
        <button type="button" onClick={() => navigate('/app/missions')} className="min-h-11 w-full border-t border-rule px-4 text-left text-[13px] text-ink-soft focus-visible:shadow-ring">함께하는 활동 둘러보기 →</button>
      </section>
    </>
  )
}
