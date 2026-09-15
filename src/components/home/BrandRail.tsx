import { Link } from 'react-router-dom'
import type { ShopBrand } from '../../hooks/useShopBrands'

interface BrandRailProps {
  brands: ShopBrand[]
  loading?: boolean
}

// 2026-08-12 대표님 지시: 파스텔 박스+이니셜 제거, 브랜드명 텍스트만 나열.
// 2026-08-13 대표님 지시: 가로 스크롤(한 줄 넘침) 대신 줄바꿈으로 전체 브랜드명이 한눈에 보이게 변경.
// 2026-09-15 대표님 지시: 제목·펼침 버튼은 AppCategory의 "브랜드" 아코디언 버튼이 맡고,
// 이 컴포넌트는 눌렀을 때 나오는 목록만 그린다(순수 리스트 컴포넌트로 단순화).
export default function BrandRail({ brands, loading }: BrandRailProps) {
  if (!loading && brands.length === 0) return null

  if (loading) {
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-3 px-4 pb-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 w-16 rounded-control bg-quiet animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-3 px-4 pb-4">
      {brands.map((brand) => (
        <Link
          key={brand.id}
          to={`/app/brand/${brand.id}`}
          className="text-[14px] font-bold text-ink focus:outline-none focus-visible:shadow-ring"
        >
          {brand.name}
        </Link>
      ))}
    </div>
  )
}
