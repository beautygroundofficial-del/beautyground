import AppHeader from '../layout/AppHeader'
import HeroCarousel from './HeroCarousel'
import MarqueeBar from './MarqueeBar'
import TrustStrip from './TrustStrip'
import ProductRail from './ProductRail'
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
  // 브랜드 레일은 카테고리 페이지로 이전(2026-08-12 대표님 지시) — 호출부 호환을 위해 props만 유지
  brands: ShopBrand[]
  brandsLoading: boolean
  onProductClick: (id: string) => void
  // 호출부가 이 컴포넌트 바로 위에 PromoBar를 렌더링했는지 — AppHeader의 스크롤 고정 위치를 그만큼 내려 붙인다.
  promoBarAbove?: boolean
}

// 홈 화면 본문(마퀴~상품그리드) — 실제 /app/home과 관리자 미리보기가 공유하는 프레젠테이션 컴포넌트.
// 데이터는 항상 부모(AppHome 또는 관리자 화면)가 내려준다(직접 fetch 하지 않음).
// 2026-08-12: 목업(live-commerce-new) 홈 배치 이식 — 카테고리 칩 섹션 제거, 할인 특가를
// 최상단으로, 그 아래 브랜드 레일 신규 추가(대표님 지시).
export default function HomeBody({
  marqueeItems,
  banners,
  bannerLoading,
  recommended,
  seasonLabel,
  products,
  prodLoading,
  saleProducts,
  saleLoading,
  onProductClick,
  promoBarAbove = false,
}: HomeBodyProps) {
  return (
    <>
      <MarqueeBar items={marqueeItems} />
      <AppHeader promoBarAbove={promoBarAbove} />
      <HeroCarousel banners={banners} loading={bannerLoading} />
      <TrustStrip />

      {/* 추천 상품·신상품·할인은 같은 가로 스크롤 레일 컴포넌트를 써서 썸네일 비율과
          좌우 버튼 탐색이 항상 일치한다. */}
      {saleProducts.length > 0 && (
        <ProductRail
          id="home-sale"
          title="할인 특가"
          products={saleProducts}
          loading={saleLoading}
          onProductClick={onProductClick}
        />
      )}
      <ProductRail
        id="home-recommended"
        title={seasonLabel ? `추천 상품 · ${seasonLabel} 시즌` : '추천 상품'}
        products={recommended}
        loading={prodLoading}
        onProductClick={onProductClick}
      />
      <ProductRail
        id="home-products"
        title="신상품"
        products={products}
        loading={prodLoading}
        onProductClick={onProductClick}
      />
    </>
  )
}
