import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ShopBrand } from '../../hooks/useShopBrands'

interface BrandRailProps {
  brands: ShopBrand[]
  loading?: boolean
}

// 2026-08-12 대표님 지시: 파스텔 박스+이니셜 제거, 브랜드명 텍스트만 나열.
// 2026-08-13 대표님 지시: 가로 스크롤(한 줄 넘침) 대신 줄바꿈으로 전체 브랜드명이 한눈에 보이게 변경.
// 2026-09-15 대표님 지시: 입점 브랜드가 늘면서 줄바꿈 목록이 다 펼쳐져 그 아래 할인특가·추천상품이
// 스크롤 없이는 안 보이는 문제 발생 — 기본 2줄만 보이게 접고 "전체보기"로 펼치도록 변경.
const COLLAPSED_ROWS_HEIGHT = 76 // 2줄 높이(px) 대략치, 브랜드명 길이 편차 고려해 넉넉히

export default function BrandRail({ brands, loading }: BrandRailProps) {
  const [expanded, setExpanded] = useState(false)
  if (!loading && brands.length === 0) return null

  return (
    <section className="pt-8" aria-labelledby="home-brand-rail">
      <div className="mb-3 px-4 flex items-center justify-between">
        <h2 id="home-brand-rail" className="text-[17px] font-bold tracking-[-0.02em] text-ink">
          브랜드
        </h2>
        {!loading && brands.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[12.5px] text-ink-soft focus:outline-none focus-visible:shadow-ring"
          >
            {expanded ? '접기 ⌃' : `전체보기 (${brands.length}) ⌄`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-x-5 gap-y-3 px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-16 rounded-control bg-quiet animate-pulse" />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-wrap gap-x-5 gap-y-3 px-4 pb-1 overflow-hidden transition-[max-height] duration-300"
          style={{ maxHeight: expanded ? 2000 : COLLAPSED_ROWS_HEIGHT }}
        >
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
      )}
    </section>
  )
}
