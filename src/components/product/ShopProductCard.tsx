import type { ShopProduct } from '../../hooks/useShopProducts'

// 소비자 실상품 카드 (대표이미지 정사각 lazy / 브랜드 / 상품명 2줄 / 할인율+판매가+정가)
export default function ShopProductCard({ product }: { product: ShopProduct }) {
  const sell = product.sale_price ?? product.price
  const hasSale = product.sale_price != null && product.sale_price < product.price
  const rate = hasSale ? Math.round((1 - product.sale_price! / product.price) * 100) : 0

  return (
    <div className="bg-white rounded-md overflow-hidden border border-cream-2">
      <div className="aspect-square bg-cream-3 overflow-hidden">
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
      </div>
      <div className="p-2.5">
        {product.brand_name && (
          <p className="text-[11px] text-text-sub font-medium truncate">{product.brand_name}</p>
        )}
        <p className="text-[13px] font-semibold text-text mt-0.5 line-clamp-2 leading-tight min-h-[34px]">
          {product.name}
        </p>
        <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
          {hasSale && <span className="text-[13px] font-bold text-gold">{rate}%</span>}
          <span className="text-[14px] font-bold text-text">{sell.toLocaleString('ko-KR')}원</span>
          {hasSale && (
            <span className="text-[11px] text-text-hint line-through">
              {product.price.toLocaleString('ko-KR')}원
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// 로딩 스켈레톤 (레이아웃 흔들림 방지)
export function ShopProductCardSkeleton() {
  return (
    <div className="bg-white rounded-md overflow-hidden border border-cream-2">
      <div className="aspect-square bg-cream-2 animate-pulse" />
      <div className="p-2.5 space-y-2">
        <div className="h-2.5 bg-cream-2 rounded animate-pulse w-1/2" />
        <div className="h-3 bg-cream-2 rounded animate-pulse" />
        <div className="h-3 bg-cream-2 rounded animate-pulse w-1/3" />
      </div>
    </div>
  )
}
