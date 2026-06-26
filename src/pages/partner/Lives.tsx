import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Live } from '../../lib/types'
import { formatDateTime } from '../../lib/format'
import Button from '../../components/common/Button'

const cardStyle = { borderColor: '#e5e0d8', borderWidth: '0.5px' }

const statusMeta: Record<Live['status'], { label: string; className: string }> = {
  scheduled: { label: '예정', className: 'bg-gold/10 text-gold' },
  live: { label: 'LIVE', className: 'bg-red-100 text-red-600' },
  ended: { label: '종료', className: 'bg-cream-3 text-text-sub' },
}

export default function PartnerLives() {
  const [loading, setLoading] = useState<boolean>(true)
  const [pending, setPending] = useState<boolean>(false)
  const [lives, setLives] = useState<Live[]>([])

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
        .from('lives')
        .select('*')
        .eq('partner_id', partner.id)
        .order('scheduled_at', { ascending: false, nullsFirst: false })

      if (!active) return
      setLives((data as Live[]) ?? [])
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
        <h1 className="text-[22px] font-bold text-text">라이브관리</h1>
        {!pending && (
          <Link to="/partner/live/new">
            <Button variant="gold" size="sm" label="라이브 예약" />
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
            승인이 완료되면 라이브를 예약할 수 있습니다.
          </p>
        </div>
      ) : loading ? (
        <div
          className="bg-white rounded-md border p-8 text-center text-[14px] text-text-sub"
          style={cardStyle}
        >
          불러오는 중…
        </div>
      ) : lives.length === 0 ? (
        <div
          className="bg-white rounded-md border p-8 text-center text-[14px] text-text-sub"
          style={cardStyle}
        >
          예약된 라이브가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {lives.map((live) => {
            const status = statusMeta[live.status]
            return (
              <Link key={live.id} to={`/partner/live/${live.id}`} className="block">
                <div
                  className="bg-white rounded-md border p-4 flex items-center gap-4 hover:shadow-focus transition"
                  style={cardStyle}
                >
                  {live.thumbnail_url ? (
                    <img
                      src={live.thumbnail_url}
                      alt={live.title}
                      className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-cream flex items-center justify-center text-[24px] flex-shrink-0">
                      📺
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-text truncate">
                      {live.title}
                    </p>
                    <p className="text-[13px] text-text-sub mt-1">
                      {formatDateTime(live.scheduled_at)}
                    </p>
                  </div>

                  <span
                    className={`inline-block px-2 py-0.5 rounded-pill text-[12px] font-medium flex-shrink-0 ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
