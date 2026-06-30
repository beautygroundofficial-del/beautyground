import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconPlus, IconVideo } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Live } from '../../lib/types'

type StatusFilter = Live['status'] | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'scheduled', label: '예정' },
  { value: 'live', label: 'LIVE' },
  { value: 'ended', label: '완료' },
]

const STATUS_MAP: Record<Live['status'], { label: string; bg: string; text: string }> = {
  scheduled: { label: '예정',  bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: 'LIVE', bg: 'bg-red-100',    text: 'text-red-600' },
  ended:     { label: '완료',  bg: 'bg-[#f0f0f0]', text: 'text-[#666]' },
}

function formatScheduled(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function PartnerLives() {
  const [loading, setLoading] = useState(true)
  const [noPartner, setNoPartner] = useState(false)
  const [lives, setLives] = useState<Live[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    let active = true
    const load = async () => {
      const partner = await getMyPartner()
      if (!active) return
      if (!partner) { setNoPartner(true); setLoading(false); return }

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
    return () => { active = false }
  }, [])

  const visible = filter === 'all' ? lives : lives.filter(l => l.status === filter)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (noPartner) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-2">입점 승인 대기 중입니다</p>
        <p className="text-[14px] text-[#9a9080]">승인이 완료되면 라이브를 예약할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg text-[13px] border transition-colors ${
                filter === value
                  ? 'bg-[#b8924a] text-white border-[#b8924a]'
                  : 'bg-white text-[#555] border-[#e5e0d8] hover:border-[#b8924a]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link
          to="/partner/live/new"
          className="flex items-center gap-2 bg-[#b8924a] hover:bg-[#a07c3b] text-white px-5 py-2 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap"
        >
          <IconPlus size={15} />
          라이브 예약
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[14px] border border-[#e5e0d8]">
          <IconVideo size={40} className="text-[#e5e0d8] mx-auto mb-3" />
          <p className="text-[14px] text-[#9a9080] mb-4">
            {filter !== 'all' ? '해당 상태의 라이브가 없습니다' : '예약된 라이브가 없습니다'}
          </p>
          {filter === 'all' && (
            <Link
              to="/partner/live/new"
              className="inline-flex items-center gap-2 bg-[#b8924a] text-white px-6 py-2.5 rounded-lg text-[13px] font-semibold"
            >
              <IconPlus size={15} />
              라이브 예약하기
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(live => {
            const badge = STATUS_MAP[live.status]
            return (
              <Link key={live.id} to={`/partner/live/${live.id}`} className="block group">
                <div className="bg-white border border-[#e5e0d8] rounded-xl overflow-hidden hover:border-[#b8924a] transition-colors">
                  <div className="aspect-video bg-[#0e0c08] flex items-center justify-center overflow-hidden">
                    {live.thumbnail_url
                      ? <img src={live.thumbnail_url} alt={live.title} className="w-full h-full object-cover" />
                      : <IconVideo size={28} className="text-[#444]" />}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-[13px] font-semibold text-[#111] leading-tight flex-1">{live.title}</p>
                      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#9a9080]">{formatScheduled(live.scheduled_at)}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
