import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import AppFrame from '../components/layout/AppFrame'
import AppFooter from '../components/layout/AppFooter'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopCategory from '../components/category/DesktopCategory'
import BrandRail from '../components/home/BrandRail'
import HeroCarousel from '../components/home/HeroCarousel'
import TrustStrip from '../components/home/TrustStrip'
import ProductRail from '../components/home/ProductRail'
import { useViewMode } from '../lib/viewMode'
import { useShopBrands } from '../hooks/useShopBrands'
import { useHeroBanners } from '../hooks/useHeroBanners'
import { useSaleProducts } from '../hooks/useSaleProducts'
import { useHomeProductSections } from '../hooks/useHomeProductSections'
import { CATEGORIES } from '../constants'

// 2026-09-02 — 홈을 커뮤니티로 넘기면서, 기존 홈에 있던 상품 영역(배너·할인특가·추천·신상품)을
// 지우지 않고 이 '쇼핑' 탭으로 그대로 옮겨왔다(대표님 지시). 상품을 찾는 사람은 여기로 온다.

// 2026-09-14: 대분류(뷰티/펫/밀키트/생활용품) 2단 아코디언(af59b01, 2026-09-13)을 되돌림 —
// 뷰티가 기본으로 펼쳐지며 그 아래 상품 레일(할인특가·추천상품·신상품)이 스크롤 없이는 안
// 보이는 문제 발생, 대표님 지시로 원래 평면 카테고리 목록으로 복원.
export default function AppCategory() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const { brands, loading: brandsLoading } = useShopBrands()
  const { banners, loading: bannerLoading } = useHeroBanners()
  const { products: saleProducts, loading: saleLoading } = useSaleProducts()
  const { products, recommended, seasonLabel, loading: prodLoading } = useHomeProductSections()
  const goProduct = (id: string) => navigate(`/app/product/${id}`)

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopCategory
          banners={banners}
          categories={CATEGORIES.map((c) => c.label)}
          recommended={recommended}
          seasonLabel={seasonLabel}
          products={products}
          prodLoading={prodLoading}
          saleProducts={saleProducts}
          saleLoading={saleLoading}
          onProductClick={goProduct}
        />
      </>
    )
  }

  return (
    <AppFrame>
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <AppHeader />

      {/* 홈에서 옮겨온 프로모션 배너 */}
      <HeroCarousel banners={banners} loading={bannerLoading} />
      <TrustStrip />

      <div className="px-4 pt-6 pb-3">
        <h1 className="text-[18px] font-bold text-ink">카테고리</h1>
        <p className="text-[13px] text-ink-soft mt-1">원하는 카테고리를 선택하세요</p>
      </div>

      {/* 이모지·카테고리별 색 제거 — 잉크 한 색으로 통일, 세로 여백은 목록 한 줄 높이로 압축 */}
      <div className="px-4 border-y border-rule divide-y divide-rule">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => navigate(`/app/category/${cat.id}`)}
            className="flex items-center justify-between gap-4 py-4 text-left focus:outline-none focus-visible:shadow-ring w-full"
            aria-label={`${cat.label} 카테고리`}
          >
            <div>
              <p className="text-[15px] font-bold text-ink">{cat.label}</p>
              <p className="text-[12.5px] text-ink-soft mt-0.5">
                {cat.id === 'skincare' && '에센스, 크림, 세럼, 토너'}
                {cat.id === 'makeup' && '파운데이션, 립, 아이, 쉐딩'}
                {cat.id === 'perfume' && '오 드 퍼퓸, 오 드 뚜왈렛, 바디미스트'}
                {cat.id === 'hair' && '샴푸, 트리트먼트, 헤어오일'}
                {cat.id === 'body' && '바디워시, 바디로션, 핸드크림'}
                {cat.id === 'device' && '고주파, 페이스·바디 디바이스'}
              </p>
            </div>
            <span className="text-ink-faint text-lg shrink-0" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      {/* 브랜드 텍스트 레일 — /live·홈과 동일 컴포넌트 (2026-08-12 대표님 지시로 카테고리에도 노출) */}
      <div className="pt-2">
        <BrandRail brands={brands} loading={brandsLoading} />
      </div>

      {/* 홈에서 옮겨온 상품 레일 3종 */}
      {saleProducts.length > 0 && (
        <ProductRail id="shop-sale" title="할인 특가" products={saleProducts} loading={saleLoading} onProductClick={goProduct} />
      )}
      <ProductRail
        id="shop-recommended"
        title={seasonLabel ? `추천 상품 · ${seasonLabel} 시즌` : '추천 상품'}
        products={recommended}
        loading={prodLoading}
        onProductClick={goProduct}
      />
      <div className="pb-8">
        <ProductRail id="shop-products" title="신상품" products={products} loading={prodLoading} onProductClick={goProduct} />
      </div>

      <AppFooter />
    </AppFrame>
  )
}
