import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Live } from '../../lib/types'
import AppHeader from '../../components/layout/AppHeader'
import AppFrame from '../../components/layout/AppFrame'
import LiveStatusBadge from '../../components/live/LiveStatusBadge'

export default function ShopLiveList() {
  const [lives, setLives] = useState<Live[]>([])
  const [replays, setReplays] = useState<Live[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const [{ data }, { data: endedData }] = await Promise.all([
        supabase
          .from('lives')
          .select('*')
          .in('status', ['live', 'scheduled'])
          .order('scheduled_at', { ascending: true, nullsFirst: false }),
        supabase
          .from('lives')
          .select('*')
          .eq('status', 'ended')
          .order('scheduled_at', { ascending: false, nullsFirst: false })
          .limit(12),
      ])
      if (!active) return
      setLives((data ?? []) as Live[])
      // 다시보기: 볼 영상이 있는 종료 방송만
      setReplays(((endedData ?? []) as Live[]).filter((l) => l.stream_url || l.playback_url || l.stream_uid))
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  return (
    <AppFrame>
      <AppHeader />

      <main className="px-4 py-5">
        <h1 className="text-[20px] font-bold text-text mb-4">라이브</h1>

        {loading ? (
          <div className="py-20 text-center text-[14px] text-text-hint">
            불러오는 중…
          </div>
        ) : lives.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-text-hint">
            진행 중이거나 예정된 라이브가 없습니다.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {lives.map((live) => (
              <Link
                key={live.id}
                to={`/app/live/${live.id}`}
                className="block bg-white rounded-md border overflow-hidden transition-colors hover:border-gold/40 focus:outline-none focus:shadow-focus"
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
                    <LiveStatusBadge live={live} />
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

        {/* 다시보기 — 종료된 방송 중 영상이 있는 것 */}
        {!loading && replays.length > 0 && (
          <>
            <h2 className="text-[17px] font-bold text-text mt-8 mb-4">다시보기</h2>
            <div className="grid grid-cols-2 gap-3">
              {replays.map((live) => (
                <Link
                  key={live.id}
                  to={`/app/live/${live.id}`}
                  className="block bg-white rounded-md border overflow-hidden transition-colors hover:border-gold/40 focus:outline-none focus:shadow-focus"
                  style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
                >
                  <div className="relative">
                    {live.thumbnail_url ? (
                      <img
                        src={live.thumbnail_url}
                        alt={live.title}
                        className="w-full h-[110px] object-cover"
                      />
                    ) : (
                      <div className="w-full h-[110px] bg-cream-3 flex items-center justify-center text-[32px]">
                        💄
                      </div>
                    )}
                    <span className="absolute top-2 left-2 inline-flex items-center rounded-pill bg-black/60 text-white text-[10px] font-bold px-2.5 py-0.5">
                      REPLAY
                    </span>
                  </div>
                  <div className="px-3 py-2.5">
                    <p className="text-[13px] font-medium text-text line-clamp-2">
                      {live.title}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

    </AppFrame>
  )
}
