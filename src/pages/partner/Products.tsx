import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Product } from '../../lib/types'
import { won, comma } from '../../lib/format'
import Button from '../../components/common/Button'

const cardStyle = { borderColor: '#e5e0d8', borderWidth: '0.5px' }

const statusMeta: Record<
  Product['status'],
  { label: string; className: string }
> = {
  on_sale: { label: '판매중', className: 'bg-gold/10 text-gold' },
  sold_out: { label: '품절', className: 'bg-cream-3 text-text-sub' },
  hidden: { label: '숨김', className: 'bg-cream-3 text-text-sub' },
}

export default function PartnerProducts() {
  const [loading, setLoading] = useState<boolean>(true)
  const [pending, setPending] = useState<boolean>(false)
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    let active = true

    const load = async () => {
      const partner = await getMyPartner()
      if (!active) return

      if (!partner) {
        setPending(true)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('partner_id', partner.id)
        .order('created_at', { ascending: false })

      if (!active) return
      setProducts((data as Product[]) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold text-text">상품관리</h1>
        {!pending && (
          <Link to="/partner/products/new">
            <Button variant="gold" size="sm" label="상품 등록" />
          </Link>
        )}
      </div>

      {pending ? (
        <div
          className="bg-white rounded-md border p-8 text-center"
          style={cardStyle}
        >
          <p className="text-[15px] font-medium text-text">
            입점 승인 대기 중입니다
          </p>
          <p className="text-[13px] text-text-sub mt-2">
            승인이 완료되면 상품을 등록할 수 있습니다.
          </p>
        </div>
      ) : loading ? (
        <div
          className="bg-white rounded-md border p-8 text-center text-[14px] text-text-sub"
          style={cardStyle}
        >
          불러오는 중…
        </div>
      ) : products.length === 0 ? (
        <div
          className="bg-white rounded-md border p-8 text-center text-[14px] text-text-sub"
          style={cardStyle}
        >
          등록된 상품이 없습니다. 첫 상품을 등록해 보세요.
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const status = statusMeta[product.status]
            const hasSale =
              product.sale_price != null && product.sale_price < product.price
            return (
              <div
                key={product.id}
                className="bg-white rounded-md border p-4 flex items-center gap-4"
                style={cardStyle}
              >
                {product.thumbnail_url ? (
                  <img
                    src={product.thumbnail_url}
                    alt={product.name}
                    className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-md bg-cream flex items-center justify-center text-[22px] flex-shrink-0">
                    🛍️
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-text truncate">
                    {product.name}
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-[14px] font-semibold text-text">
                      {won(product.sale_price ?? product.price)}
                    </span>
                    {hasSale && (
                      <span className="text-[12px] text-text-hint line-through">
                        {won(product.price)}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-sub mt-1">
                    재고 {comma(product.stock)}
                  </p>
                </div>

                <span
                  className={`text-[12px] px-3 py-1 rounded-pill font-medium flex-shrink-0 ${status.className}`}
                >
                  {status.label}
                </span>

                <Link
                  to={`/partner/products/${product.id}/edit`}
                  className="flex-shrink-0"
                >
                  <Button variant="outline" size="sm" label="수정" />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
