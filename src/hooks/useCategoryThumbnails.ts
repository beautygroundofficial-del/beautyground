import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface CategoryThumbnail {
  category: string
  imageUrl: string | null
  sortOrder: number
}

interface Row {
  category: string
  image_url: string | null
  sort_order: number
  products: { thumbnail_url: string | null } | null
}

// 홈 카테고리 아이콘 그리드용 대표 이미지. product_id 지정 시 상품 썸네일, 아니면 image_url 직접 사용.
export function useCategoryThumbnails() {
  const [thumbnails, setThumbnails] = useState<CategoryThumbnail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('category_thumbnails')
        .select('category,image_url,sort_order,products(thumbnail_url)')
        .order('sort_order', { ascending: true })
      if (!active) return
      const rows = (data ?? []) as unknown as Row[]
      setThumbnails(
        rows.map((r) => ({
          category: r.category,
          imageUrl: r.products?.thumbnail_url ?? r.image_url,
          sortOrder: r.sort_order,
        }))
      )
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return { thumbnails, loading }
}
