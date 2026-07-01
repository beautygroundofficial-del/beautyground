import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconArrowLeft, IconPencil } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { Product } from '../../lib/types'

const STATUS: Record<Product['status'], { label: string; bg: string; text: string }> = {
  on_sale: { label: '판매중', bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
  sold_out: { label: '품절',  bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  hidden:   { label: '숨김',  bg: 'bg-[#f0f0f0]', text: 'text-[#666]' },
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!id) { setLoading(false); return }
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      setProduct((data as Product | null) ?? null)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-3">상품을 찾을 수 없습니다</p>
        <Link to="/partner/products" className="text-[13px] text-[#b8924a] font-medium hover:underline">
          상품 목록으로
        </Link>
      </div>
    )
  }

  const badge = STATUS[product.status]
  // 대표 이미지 갤러리 (없으면 thumbnail_url 로 폴백)
  const gallery =
    product.gallery_images && product.gallery_images.length > 0
      ? product.gallery_images
      : product.thumbnail_url
      ? [product.thumbnail_url]
      : []
  const sellPrice = product.sale_price ?? product.price
  const hasDiscount = product.sale_price != null && product.sale_price < product.price
  const discountRate = hasDiscount
    ? Math.round((1 - product.sale_price! / product.price) * 100)
    : null

  return (
    <div className="max-w-[720px] mx-auto px-4">
      {/* 브레드크럼 */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          to="/partner/products"
          className="flex items-center gap-1.5 text-[13px] text-[#9a9080] hover:text-[#111] transition-colors"
        >
          <IconArrowLeft size={15} />
          상품 목록
        </Link>
        <Link
          to={`/partner/products/${product.id}/edit`}
          className="flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#b8924a] hover:bg-[#a07c3b] px-4 py-2 rounded-lg transition-colors"
        >
          <IconPencil size={14} />
          수정하기
        </Link>
      </div>

      {/* 상품 헤더 */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] overflow-hidden mb-6">
        {gallery.length > 0 && (
          <div>
            {/* 큰 메인 이미지 */}
            <div className="aspect-square max-h-[400px] overflow-hidden flex items-center justify-center bg-[#f7f4ef]">
              <img
                src={gallery[Math.min(active, gallery.length - 1)]}
                alt={product.name}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  if (product.thumbnail_url && img.src !== product.thumbnail_url) {
                    img.src = product.thumbnail_url
                  }
                }}
              />
            </div>

            {/* 썸네일 줄 (2장 이상일 때) */}
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3 border-t border-[#eee]">
                {gallery.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === active ? 'border-[#b8924a]' : 'border-[#e5e0d8] hover:border-[#b8924a]/60'
                    }`}
                    aria-label={`${i + 1}번째 이미지`}
                  >
                    <img
                      src={url}
                      alt={`${product.name} ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-[20px] font-bold text-[#111] leading-snug flex-1">{product.name}</h1>
            <span className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>

          {product.category && (
            <p className="text-[12px] text-[#9a9080] mb-4">{product.category}</p>
          )}

          <div className="flex items-baseline gap-2 mb-4">
            <p className="text-[24px] font-bold text-[#111]">{sellPrice.toLocaleString()}원</p>
            {discountRate && (
              <span className="text-[13px] font-semibold text-[#b8924a]">{discountRate}%</span>
            )}
            {hasDiscount && (
              <span className="text-[14px] text-[#bbb] line-through">{product.price.toLocaleString()}원</span>
            )}
          </div>

          <div className="flex gap-6 text-[13px] text-[#555] border-t border-[#eee] pt-4">
            <span>재고 <strong className="text-[#111]">{product.stock.toLocaleString()}개</strong></span>
          </div>

          {product.description && (
            <p className="mt-4 text-[13px] text-[#555] leading-relaxed whitespace-pre-wrap">
              {product.description}
            </p>
          )}
        </div>
      </div>

      {/* 상세 이미지 (지연로딩) */}
      {(product.detail_images?.length ?? 0) > 0 && (
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#eee]">
            <h2 className="text-[13px] font-bold text-[#111]">
              상세 이미지 ({product.detail_images!.length}장)
            </h2>
          </div>
          <div>
            {product.detail_images!.map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`상세 이미지 ${i + 1}`}
                loading="lazy"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
