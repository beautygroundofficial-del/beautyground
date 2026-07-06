import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Live } from '../lib/types'

// 소비자 앱: 진행중(live)·예정(scheduled) 라이브 목록. 홈 라이브 띠 / 라이브 목록 공용.
export function useShopLives() {
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('lives')
        .select('*')
        .in('status', ['live', 'scheduled'])
        .order('scheduled_at', { ascending: true, nullsFirst: false })
      if (!active) return
      setLives((data ?? []) as Live[])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [])

  return { lives, loading }
}
