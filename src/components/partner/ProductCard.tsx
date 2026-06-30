import { Link } from 'react-router-dom'
import { IconPencil, IconEye, IconEyeOff, IconTrash } from '@tabler/icons-react'
import type { Product } from '../../lib/types'

const STATUS: Record<Product['status'], { label: string; bg: string; text: string }> = {
  on_sale: { label: '판매중', bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
  sold_out: { label: '품절',  bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  hidden:   { label: '숨김',  bg: 'bg-[#f0f0f0]', text: 'text-[#666]' },
}

interface Props {
  product: Product
  onDelete: (id: string) => void
  onToggleHide: (product: Product) => void
}

export default function PartnerProductCard({ product, onDelete, onToggleHide }: Props) {
  const badge = STATUS[product.status]
  const sellPrice = product.sale_price ?? product.price
  const hasDiscount = product.sale_price != null && product.sale_price < product.price
  const discountRate = hasDiscount
    ? Math.round((1 - product.sale_price! / product.price) * 100)
    : null

  return (
    <div className="bg-white border border-[#e5e0d8] rounded-xl flex flex-col">
      <div className="aspect-square bg-[#f7f4ef] rounded-t-xl overflow-hidden flex items-center justify-center text-[12px] text-[#bbb]">
        {product.thumbnail_url
          ? <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
          : '이미지 없음'}
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[13px] font-semibold text-[#111] leading-tight flex-1 line-clamp-2">{product.name}</p>
          <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>

        {product.category && (
          <p className="text-[11px] text-[#9a9080] mb-2">{product.category}</p>
        )}

        <div className="flex items-baseline gap-1.5 mt-auto">
          <p className="text-[14px] font-bold text-[#111]">{sellPrice.toLocaleString()}원</p>
          {discountRate && <span className="text-[11px] text-[#b8924a] font-semibold">{discountRate}%</span>}
        </div>
        {hasDiscount && (
          <p className="text-[11px] text-[#bbb] line-through">{product.price.toLocaleString()}원</p>
        )}
        <p className="text-[11px] text-[#9a9080] mt-1">재고 {product.stock.toLocaleString()}개</p>

        <div className="flex gap-1.5 mt-3 pt-3 border-t border-[#eee]">
          <Link
            to={`/partner/products/${product.id}/edit`}
            className="flex-1 flex items-center justify-center gap-1 text-[11px] text-[#555] border border-[#e5e0d8] rounded-lg py-1.5 hover:border-[#b8924a] hover:text-[#b8924a] transition-colors"
          >
            <IconPencil size={12} />수정
          </Link>
          <button
            onClick={() => onToggleHide(product)}
            title={product.status === 'hidden' ? '공개' : '숨김'}
            className="flex items-center justify-center px-2.5 border border-[#e5e0d8] rounded-lg hover:border-[#9a9080] transition-colors"
          >
            {product.status === 'hidden' ? <IconEye size={13} /> : <IconEyeOff size={13} />}
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="flex items-center justify-center px-2.5 border border-[#e5e0d8] rounded-lg text-red-400 hover:border-red-300 transition-colors"
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
