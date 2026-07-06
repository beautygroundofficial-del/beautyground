import type { ShopProduct } from '../../hooks/useShopProducts'

// 소비자 상품 카드 — 정보 3개만: 썸네일 / 상품명 1줄 / 가격 1줄
export default function ShopProductCard({ product }: { product: ShopProduct }) {
  const sell = product.sale_price ?? product.price
  const hasSale = product.sale_price != null && product.sale_price < product.price
  const rate = hasSale ? Math.round((1 - product.sale_price! / product.price) * 100) : 0
  const soldOut = product.status === 'sold_out'

  return (
    <div>
      {/* 1) 썸네일 */}
      <div className="relative aspect-square rounded-lg overflow-hidden bg-cream-3">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl" aria-hidden="true">
            💄
          </div>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">품절</span>
          </div>
        )}
      </div>

      {/* 2) 상품명 1줄 */}
      <p className="text-sm text-text mt-1.5 line-clamp-1">{product.name}</p>

      {/* 3) 가격 1줄 (할인율 골드 + 판매가 bold, 취소선은 모바일 생략) */}
      <div className="mt-0.5 flex items-baseline gap-1.5">
        {hasSale && <span className="text-sm font-bold text-gold">{rate}%</span>}
        <span className="text-sm font-bold text-text">{sell.toLocaleString('ko-KR')}원</span>
      </div>
    </div>
  )
}

// 로딩 스켈레톤 (레이아웃 흔들림 방지)
export function ShopProductCardSkeleton() {
  return (
    <div>
      <div className="aspect-square rounded-lg bg-cream-2 animate-pulse" />
      <div className="h-3 bg-cream-2 rounded animate-pulse mt-2 w-3/4" />
      <div className="h-3 bg-cream-2 rounded animate-pulse mt-1.5 w-1/3" />
    </div>
  )
}
