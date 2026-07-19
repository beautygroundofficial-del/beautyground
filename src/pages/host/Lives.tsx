import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconVideo } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyHost } from '../../lib/host'
import type { Live } from '../../lib/types'

type StatusFilter = Live['status'] | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'scheduled', label: '예정' },
  { value: 'live', label: '진행중' },
  { value: 'ended', label: '완료' },
]

const STATUS_MAP: Record<Live['status'], { label: string; bg: string; text: string }> = {
  scheduled: { label: '예정', bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: 'LIVE', bg: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
  ended:     { label: '완료', bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
}

function formatScheduled(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function HostLives() {
  const [loading, setLoading] = useState(true)
  const [lives, setLives] = useState<Live[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    let active = true
    const load = async () => {
      const host = await getMyHost()
      if (!active) return
      if (!host) { setLoading(false); return }
      const { data } = await supabase
        .from('lives')
        .select('*')
        .eq('host_id', host.id)
        .order('scheduled_at', { ascending: false, nullsFirst: false })
      if (!active) return
      setLives((data as Live[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const visible = filter === 'all' ? lives : lives.filter((l) => l.status === filter)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-full text-[12px] font-medium transition-colors ${
              filter === f.value ? 'bg-[#b8924a] text-white' : 'bg-white border border-[#e5e0d8] text-[#555]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[14px] border border-[#e5e0d8]">
          <IconVideo size={32} className="text-[#e5e0d8] mx-auto mb-3" />
          <p className="text-[14px] text-[#9a9080]">진행한 방송이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((live) => {
            const badge = STATUS_MAP[live.status]
            return (
              <Link
                key={live.id}
                to={`/host/live/${live.id}`}
                className="block bg-white rounded-[14px] border border-[#e5e0d8] p-5 hover:border-[#b8924a] transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[14px] font-semibold text-[#111] leading-tight">{live.title}</p>
                  <span className={`ml-2 shrink-0 text-[11px] font-medium px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-[12px] text-[#9a9080]">{formatScheduled(live.scheduled_at)}</p>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
