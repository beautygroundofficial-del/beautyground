import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export const DEFAULT_MARQUEE_ITEMS = [
  '🎁 회원가입하면 다양한 혜택이 준비되어 있어요',
  '💛 뷰티그라운드 셀렉트 신상품을 만나보세요',
]

// 홈 화면 공지 마퀴 문구(싱글턴 1행). 값이 없으면 기본 문구로 대체.
export function useHomeSettings() {
  const [marqueeItems, setMarqueeItems] = useState<string[]>(DEFAULT_MARQUEE_ITEMS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('home_settings')
        .select('marquee_items')
        .eq('id', 1)
        .maybeSingle()
      if (!active) return
      if (data?.marquee_items && data.marquee_items.length > 0) {
        setMarqueeItems(data.marquee_items)
      }
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return { marqueeItems, loading }
}
