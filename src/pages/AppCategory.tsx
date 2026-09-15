import { useState } from 'react'
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
const CATEGORY_COLLAPSED_COUNT = 3

export default function AppCategory() {
  const navigate = useNavigate()
  const [categoryExpanded, setCategoryExpanded] = useState(false)
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

      {/* 홈에서 옮겨온 상품 레일 3종 — 2026-09-15 대표님 지시로 카테고리·브랜드 목록보다 먼저 보이게
          순서 변경(다 펼쳐진 목록 때문에 할인특가·추천상품이 스크롤 없이는 안 보이는 문제) */}
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
      <ProductRail id="shop-products" title="신상품" products={products} loading={prodLoading} onProductClick={goProduct} />

      {/* 카테고리 목록 — 2026-09-15: 상품 레일 뒤로 순서 이동 + 기본 3개만 보이게 접힘(대표님 지시,
          6개 전부 펼쳐지면 그 아래 브랜드·상품이 스크롤 없이는 안 보이는 문제와 같은 유형) */}
      <section className="pt-8" aria-labelledby="shop-category-list">
        <div className="mb-3 px-4 flex items-center justify-between">
          <h2 id="shop-category-list" className="text-[17px] font-bold tracking-[-0.02em] text-ink">카테고리</h2>
          <button
            onClick={() => setCategoryExpanded((v) => !v)}
            className="text-[12.5px] text-ink-soft focus:outline-none focus-visible:shadow-ring"
          >
            {categoryExpanded ? '접기 ⌃' : `전체보기 (${CATEGORIES.length}) ⌄`}
          </button>
        </div>
        <div className="px-4 border-y border-rule divide-y divide-rule">
          {(categoryExpanded ? CATEGORIES : CATEGORIES.slice(0, CATEGORY_COLLAPSED_COUNT)).map((cat) => (
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
      </section>

      {/* 브랜드 텍스트 레일 — /live·홈과 동일 컴포넌트 (2026-08-12 대표님 지시로 카테고리에도 노출).
          2026-09-15: 상품 레일 뒤로 순서 이동 + 기본 2줄 접힘(BrandRail 자체에서 처리) */}
      <div className="pt-2 pb-8">
        <BrandRail brands={brands} loading={brandsLoading} />
      </div>

      <AppFooter />
    </AppFrame>
  )
}
