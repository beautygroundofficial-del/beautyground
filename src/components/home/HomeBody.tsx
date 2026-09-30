import { useNavigate } from 'react-router-dom'
import { IconPencil } from '@tabler/icons-react'
import AppHeader from '../layout/AppHeader'
import MarqueeBar from './MarqueeBar'
import MissionBanner from './MissionBanner'
import TodayQuestion from '../community/TodayQuestion'
import DiaryHomeFeed from './DiaryHomeFeed'
import BoardHomeFeed from './BoardHomeFeed'
import BoardCategoryGrid from './BoardCategoryGrid'
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

  return (
    <>
      <MarqueeBar items={marqueeItems} />
      <AppHeader promoBarAbove={promoBarAbove} />

      <div className="px-5 pt-5 flex items-center justify-between gap-3">
        <p className="text-[14px] leading-relaxed text-ink-soft">오늘은 읽기만 해도 괜찮아요.</p>
        <button type="button" onClick={() => navigate('/app/friends')} className="min-h-11 shrink-0 rounded-full border border-solid border-rule px-3 text-[13px] font-bold text-ink focus-visible:shadow-ring">내 친구</button>
      </div>

      {/* 속 이야기가 하루 일기보다 반응(하트·댓글)이 훨씬 활발해 "사람들이 지금 얘기하고 있다"는
          인상을 첫 화면에서 바로 주기 위해 맨 위로 배치 (2026-09-30 대표님 지시 — 맨 아래 있으면
          아무도 안 본다). 카테고리 그리드로 고르고 바로 아래서 최신 글을 본다. */}
      <BoardCategoryGrid />
      <BoardHomeFeed />

      {/* 회원의 이야기를 먼저 만나고, 원하는 만큼 대화에 참여한다. */}
      <DiaryHomeFeed limit={3} />

      {/* 전화번호 인증 배너 제거(2026-09-16) — claim_mission()에서 전화인증 게이트를
          없애 포인트가 인증 없이도 지급되므로, "인증해야 포인트"라는 이 배너 문구가
          더는 사실이 아니게 됐다. */}

      {/* 오늘의 이야기 쓰기 */}
      <section className="px-5 pt-2 pb-2">
        <button
          onClick={() => navigate('/app/diary/write')}
          className="flex w-full items-center gap-4 rounded-card bg-quiet p-5 text-left transition-colors hover:bg-rule/50 focus:outline-none focus-visible:shadow-ring"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-paper" aria-hidden="true"><IconPencil size={20} stroke={1.6} /></span>
          <span className="min-w-0">
            <span className="block text-[16px] font-bold leading-relaxed text-ink">오늘 어떤 하루였나요?</span>
            <span className="block text-[13px] leading-relaxed text-ink-soft mt-1">사소한 하루도 누군가에겐 위로가 됩니다</span>
          </span>
        </button>
      </section>

      <div className="px-5 pt-6">
        <TodayQuestion />
      </div>

      <MissionBanner />
    </>
  )
}
