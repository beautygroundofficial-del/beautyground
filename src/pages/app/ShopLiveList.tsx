import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Live } from '../../lib/types'
import AppHeader from '../../components/layout/AppHeader'
import BottomNav from '../../components/layout/BottomNav'

export default function ShopLiveList() {
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('lives')
        .select('*')
        .in('status', ['live', 'scheduled'])
        .order('scheduled_at', { ascending: true, nullsFirst: false })
      if (!active) return
      setLives((data ?? []) as Live[])
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-cream-4 pb-20">
      <AppHeader />

      <main className="px-4 py-5">
        <h1 className="text-[20px] font-bold text-text mb-4">라이브</h1>

        {loading ? (
          <div className="py-20 text-center text-[14px] text-text-hint">
            불러오는 중…
          </div>
        ) : lives.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-text-hint">
            진행 중이거나 예정된 라이브가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {lives.map((live) => (
              <Link
                key={live.id}
                to={`/app/live/${live.id}`}
                className="block bg-white rounded-md border overflow-hidden transition hover:shadow-focus"
                style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
              >
                <div className="relative">
                  {live.thumbnail_url ? (
                    <img
                      src={live.thumbnail_url}
                      alt={live.title}
                      className="w-full h-[160px] object-cover"
                    />
                  ) : (
                    <div className="w-full h-[160px] bg-cream-3 flex items-center justify-center text-[44px]">
                      💄
                    </div>
                  )}

                  <div className="absolute top-3 left-3">
                    {live.status === 'live' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-pill bg-[#FF4757] text-white text-[12px] font-bold px-3 py-1">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        LIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-pill bg-black/50 text-white text-[12px] font-medium px-3 py-1">
                        예정
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-4 py-3">
                  <p className="text-[15px] font-medium text-text line-clamp-2">
                    {live.title}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
