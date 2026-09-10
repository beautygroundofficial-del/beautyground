import { useNavigate } from 'react-router-dom'
import AppHeader from '../layout/AppHeader'
import MarqueeBar from './MarqueeBar'
import MissionBanner from './MissionBanner'
import TodayQuestion from '../community/TodayQuestion'
import PhoneVerifyBanner from '../community/PhoneVerifyBanner'
import DiaryHomeFeed from './DiaryHomeFeed'
import BoardHomeFeed from './BoardHomeFeed'
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
}

// 홈 화면 본문.
//
// 2026-09-02 전환 — 대표님 지시 "홈을 누르면 제품 페이지가 있으면 안 된다. 주인공은 커뮤니티다."
// 배너·할인특가·추천·신상품 등 상품 영역은 지우지 않고 전부 '쇼핑' 탭(/app/category)으로 옮겼다.
// 홈에는 오늘 할 일(미션)과 사람들의 이야기만 남긴다.
//
// props 는 호출부(AppHome·관리자 미리보기) 호환을 위해 그대로 받되 상품 관련 값은 쓰지 않는다.
export default function HomeBody({ marqueeItems }: HomeBodyProps) {
  const navigate = useNavigate()

  return (
    <>
      <MarqueeBar items={marqueeItems} />
      <AppHeader />

      {/* 오늘 할 수 있는 일 — 관리자가 미션을 켜야 나타난다 */}
      <MissionBanner />

      {/* 전화번호 인증 배너 — 로그인했고 아직 인증 안 한 사람에게만, 딱 이 자리에서만 보인다.
          안 눌러도 아무것도 안 막힌다(포인트만 안 쌓인다). 2026-09-09 */}
      <div className="px-5 pt-4">
        <PhoneVerifyBanner />
      </div>

      {/* 오늘의 질문 — 한 줄만 답하면 되는 자리. 오늘 걸린 질문이 없으면 스스로 감춘다 */}
      <div className="px-5 pt-4">
        <TodayQuestion />
      </div>

      {/* 오늘의 이야기 쓰기 */}
      <section className="px-5 pt-5">
        <button
          onClick={() => navigate('/app/diary')}
          className="w-full rounded-card bg-ink text-paper px-5 py-4 text-left focus:outline-none focus-visible:shadow-ring"
        >
          <span className="block text-[15px] font-bold leading-tight">오늘 어떤 하루였나요?</span>
          <span className="block text-[12.5px] opacity-75 mt-1">사소한 하루도 누군가에겐 위로가 됩니다</span>
        </button>
      </section>

      {/* 속 이야기 — 주제별로 속마음을 꺼내놓는 곳. 최신 3개만 얇게(2026-09-10) */}
      <BoardHomeFeed />

      {/* 사람들의 이야기 — 홈의 주인공 */}
      <DiaryHomeFeed />
    </>
  )
}
