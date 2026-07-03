import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PRODUCT_CATEGORIES } from '../lib/types'

// 소비자 목록 카테고리 탭용: 판매중(on_sale) 상품이 1개 이상 있는 실제 category 값만 반환.
// PRODUCT_CATEGORIES 순서를 유지하고, 상품 0개인 카테고리는 제외한다.
export function useShopCategories() {
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const results = await Promise.all(
        PRODUCT_CATEGORIES.map(async (cat) => {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'on_sale')
            .eq('category', cat)
          return { cat, count: count ?? 0 }
        })
      )
      if (cancelled) return
      setCategories(results.filter((r) => r.count > 0).map((r) => r.cat))
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { categories, loading }
}
