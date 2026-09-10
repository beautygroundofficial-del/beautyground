import { useNavigate } from 'react-router-dom'
import DesktopHeader from '../layout/DesktopHeader'
import DesktopFooter from '../layout/DesktopFooter'
import PromoBar from './PromoBar'
import MissionBanner from './MissionBanner'
import TodayQuestion from '../community/TodayQuestion'
import PhoneVerifyBanner from '../community/PhoneVerifyBanner'
import DiaryHomeFeed from './DiaryHomeFeed'
import BoardHomeFeed from './BoardHomeFeed'
import type { HeroBanner } from '../../hooks/useHeroBanners'
import type { ShopProduct } from '../../hooks/useShopProducts'

interface Props {
  banners: HeroBanner[]
  categories: string[]
  recommended: ShopProduct[]
  seasonLabel: string | null
  products: ShopProduct[]
  prodLoading: boolean
  saleProducts: ShopProduct[]
  saleLoading: boolean
  onProductClick: (id: string) => void
}

// PC 홈 — 2026-09-02 커뮤니티로 전환.
// 대표님 지시: "홈을 누르면 제품 페이지가 있으면 안 된다. 주인공은 커뮤니티다."
// 기존 상품 화면(히어로 배너·특가세일·추천·신상품)은 지우지 않고
// components/category/DesktopShopBody.tsx 로 통째로 옮겨 '쇼핑'에서 보여준다.
//
// props 는 호출부(AppHome·관리자 미리보기) 호환을 위해 그대로 받되 상품 값은 쓰지 않는다.
export default function DesktopHome(_: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-paper min-h-screen">
      <PromoBar />
      <DesktopHeader />

      {/* 커뮤니티는 세로로 읽는 흐름이라, PC에서도 넓게 펼치지 않고
          읽기 좋은 폭(680px)으로 가운데 모은다. */}
      <div className="max-w-[680px] mx-auto px-6 py-10">
        <MissionBanner />

        {/* 전화번호 인증 배너 — 모바일(HomeBody.tsx)과 같은 컴포넌트, 같은 이유로 여기도 넣는다(2026-09-09).
            ⚠️ 홈은 모바일·PC 컴포넌트가 나뉘어 있어 한쪽만 고치면 반쪽만 바뀐다(2026-09-02 사고). */}
        <div className="pb-4">
          <PhoneVerifyBanner />
        </div>

        {/* 오늘의 질문 — 모바일과 같은 컴포넌트를 쓴다. */}
        <div className="pb-5">
          <TodayQuestion />
        </div>

        <button
          onClick={() => navigate('/app/diary/write')}
          className="w-full rounded-card bg-ink text-paper px-6 py-5 text-left focus:outline-none focus-visible:shadow-ring"
        >
          <span className="block text-[18px] font-bold leading-tight">오늘 어떤 하루였나요?</span>
          <span className="block text-[13.5px] opacity-75 mt-1.5">사소한 하루도 누군가에겐 위로가 됩니다</span>
        </button>

        {/* 속 이야기 — 모바일(HomeBody.tsx)과 같은 컴포넌트. 한쪽만 고치지 말 것. */}
        <BoardHomeFeed />

        <DiaryHomeFeed />
      </div>

      <DesktopFooter />
    </div>
  )
}
