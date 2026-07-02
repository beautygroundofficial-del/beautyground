import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type ShopSort = 'latest' | 'price_asc' | 'price_desc'

export interface ShopProduct {
  id: string
  name: string
  price: number
  sale_price: number | null
  thumbnail_url: string | null
  category: string | null
  brand_name: string | null
}

interface Options {
  category?: string
  sort?: ShopSort
  pageSize?: number
}

interface ProductRow {
  id: string
  name: string
  price: number
  sale_price: number | null
  thumbnail_url: string | null
  category: string | null
  partner_id: string | null
}

// 소비자 앱: 판매중(on_sale) 상품 목록. 브랜드명은 partner_brands 뷰에서 매핑.
export function useShopProducts({ category, sort = 'latest', pageSize = 20 }: Options = {}) {
  const [products, setProducts] = useState<ShopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const fetchPage = useCallback(
    async (pageIndex: number, replace: boolean) => {
      setLoading(true)
      setError(null)

      let q = supabase
        .from('products')
        .select('id,name,price,sale_price,thumbnail_url,category,partner_id')
        .eq('status', 'on_sale')

      if (category) q = q.eq('category', category)
      if (sort === 'price_asc') q = q.order('price', { ascending: true })
      else if (sort === 'price_desc') q = q.order('price', { ascending: false })
      else q = q.order('created_at', { ascending: false })

      const from = pageIndex * pageSize
      q = q.range(from, from + pageSize - 1)

      const { data, error: err } = await q
      if (err) {
        setError('상품을 불러오지 못했습니다.')
        setLoading(false)
        return
      }

      const rows = (data ?? []) as ProductRow[]

      // 브랜드명 매핑 (뷰가 없거나 실패해도 상품은 노출)
      const ids = [...new Set(rows.map((r) => r.partner_id).filter((v): v is string => !!v))]
      const brandMap = new Map<string, string>()
      if (ids.length > 0) {
        const { data: brands } = await supabase
          .from('partner_brands')
          .select('id,brand_name')
          .in('id', ids)
        for (const b of (brands ?? []) as { id: string; brand_name: string }[]) {
          brandMap.set(b.id, b.brand_name)
        }
      }

      const mapped: ShopProduct[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        price: r.price,
        sale_price: r.sale_price,
        thumbnail_url: r.thumbnail_url,
        category: r.category,
        brand_name: r.partner_id ? brandMap.get(r.partner_id) ?? null : null,
      }))

      setHasMore(rows.length === pageSize)
      setProducts((prev) => (replace ? mapped : [...prev, ...mapped]))
      setLoading(false)
    },
    [category, sort, pageSize]
  )

  // 카테고리/정렬 변경 시 첫 페이지부터 다시 로드
  useEffect(() => {
    setPage(0)
    fetchPage(0, true)
  }, [fetchPage])

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPage(next, false)
  }

  return { products, loading, error, hasMore, loadMore }
}
