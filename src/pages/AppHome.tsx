import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/layout/BottomNav'
import HomeBody from '../components/home/HomeBody'
import { useShopProducts } from '../hooks/useShopProducts'
import { useShopCategories } from '../hooks/useShopCategories'
import { useShopLives } from '../hooks/useShopLives'
import { useHeroBanners } from '../hooks/useHeroBanners'
import { useHomeSettings } from '../hooks/useHomeSettings'
import { useCategoryThumbnails } from '../hooks/useCategoryThumbnails'

export default function AppHome() {
  const navigate = useNavigate()
  const { products, loading: prodLoading } = useShopProducts({ sort: 'latest', pageSize: 10 })
  const { categories } = useShopCategories()
  const { lives } = useShopLives()
  const { banners } = useHeroBanners()
  const { marqueeItems } = useHomeSettings()
  const { thumbnails: categoryThumbnails } = useCategoryThumbnails()

  return (
    // PC에서도 모바일 앱처럼 가운데 고정 폭 프레임 + 바깥 여백/배경 (med-ligne 참고)
    <div className="min-h-screen bg-cream-2 md:py-6">
      <div className="max-w-[480px] mx-auto bg-cream-4 min-h-screen md:min-h-0 md:rounded-lg md:overflow-hidden md:shadow-[0_12px_28px_-16px_rgba(23,19,16,.35)] pb-24">
        <HomeBody
          marqueeItems={marqueeItems}
          banners={banners}
          lives={lives}
          categories={categories}
          categoryThumbnails={categoryThumbnails}
          products={products}
          prodLoading={prodLoading}
          onProductClick={(id) => navigate(`/app/product/${id}`)}
          onCategoryClick={(cat) =>
            navigate(cat ? `/app/category/all?cat=${encodeURIComponent(cat)}` : '/app/category/all')
          }
        />
        <BottomNav />
      </div>
    </div>
  )
}
