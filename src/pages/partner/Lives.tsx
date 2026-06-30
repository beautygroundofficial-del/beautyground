import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconPlus, IconVideo, IconPencil, IconTrash } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Live } from '../../lib/types'

type StatusFilter = Live['status'] | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'scheduled', label: '예정' },
  { value: 'live', label: '진행중' },
  { value: 'ended', label: '완료' },
]

const STATUS_MAP: Record<Live['status'], { label: string; bg: string; text: string; dot?: boolean }> = {
  scheduled: { label: '예정',  bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: 'LIVE', bg: 'bg-[#FBEAF0]', text: 'text-[#993556]', dot: true },
  ended:     { label: '완료',  bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
}

function formatScheduled(iso: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function PartnerLives() {
  const [loading, setLoading] = useState(true)
  const [noPartner, setNoPartner] = useState(false)
  const [lives, setLives] = useState<Live[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [confirmDel, setConfirmDel] = useState<Live | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!confirmDel) return
    setDeleting(true)
    const { error } = await supabase.from('lives').delete().eq('id', confirmDel.id)
    if (!error) setLives(prev => prev.filter(l => l.id !== confirmDel.id))
    setDeleting(false)
    setConfirmDel(null)
  }

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
        <div className="flex gap-1 bg-white border border-[#e5e0d8] rounded-lg p-1">
          {STATUS_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-1.5 rounded text-[13px] transition-colors ${
                filter === value ? 'bg-[#b8924a] text-white font-semibold' : 'text-[#555] hover:text-[#111]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link
          to="/partner/live/new"
          className="flex items-center gap-2 bg-[#b8924a] hover:bg-[#a07c3b] text-white px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors whitespace-nowrap"
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
            const productCount = (live.product_ids ?? []).length
            return (
              <div key={live.id} className="bg-white border border-[#e5e0d8] rounded-xl overflow-hidden">
                {/* 썸네일 */}
                <div className="aspect-video bg-[#0e0c08] flex items-center justify-center overflow-hidden">
                  {live.thumbnail_url
                    ? <img src={live.thumbnail_url} alt={live.title} className="w-full h-full object-cover" />
                    : <IconVideo size={28} className="text-[#444]" />}
                </div>

                <div className="p-4">
                  {/* 제목 + 뱃지 */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[14px] font-bold text-[#111] leading-tight flex-1">{live.title}</p>
                    <span className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                      {badge.dot && <span className="w-1.5 h-1.5 rounded-full bg-[#993556] animate-pulse" />}
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#9a9080] mb-3">{formatScheduled(live.scheduled_at)}</p>

                  {/* 상품 썸네일 */}
                  {productCount > 0 && (
                    <div className="flex gap-2 mb-3">
                      {(live.product_ids ?? []).slice(0, 3).map((_, i) => (
                        <div key={i} className="w-10 h-10 bg-[#f7f4ef] rounded-lg flex items-center justify-center text-[10px] text-[#bbb]">
                          상품
                        </div>
                      ))}
                      {productCount > 3 && (
                        <div className="w-10 h-10 bg-[#f7f4ef] rounded-lg flex items-center justify-center text-[11px] text-[#9a9080]">
                          +{productCount - 3}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex gap-2">
                    {live.status === 'scheduled' && (
                      <Link
                        to={`/partner/live/${live.id}`}
                        className="flex-1 text-center bg-[#b8924a] hover:bg-[#a07c3b] text-white text-[12px] font-semibold py-2 rounded-lg transition-colors"
                      >
                        방송 입장
                      </Link>
                    )}
                    {live.status === 'live' && (
                      <Link
                        to={`/partner/live/${live.id}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-[12px] font-semibold py-2 rounded-lg transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        방송 진행 중
                      </Link>
                    )}
                    {live.status === 'ended' && (
                      <Link
                        to={`/partner/live/${live.id}`}
                        className="flex-1 text-center border border-[#e5e0d8] text-[#555] text-[12px] py-2 rounded-lg hover:border-[#b8924a] hover:text-[#b8924a] transition-colors"
                      >
                        결과 보기
                      </Link>
                    )}
                  </div>

                  {/* 수정 / 삭제 */}
                  <div className="flex gap-2 mt-2">
                    {live.status === 'scheduled' && (
                      <Link
                        to={`/partner/live/${live.id}/edit`}
                        className="flex-1 flex items-center justify-center gap-1 text-[12px] text-[#555] border border-[#e5e0d8] py-1.5 rounded-lg hover:border-[#b8924a] hover:text-[#b8924a] transition-colors"
                      >
                        <IconPencil size={13} />수정
                      </Link>
                    )}
                    <button
                      onClick={() => setConfirmDel(live)}
                      className="flex-1 flex items-center justify-center gap-1 text-[12px] text-red-500 border border-[#f0d6d6] py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <IconTrash size={13} />삭제
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-[14px] p-6 max-w-sm w-full">
            <p className="text-[15px] font-bold text-[#111] mb-1">라이브를 삭제할까요?</p>
            <p className="text-[13px] text-[#9a9080] mb-5">
              "{confirmDel.title}" 라이브가 영구 삭제됩니다.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDel(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-[#e5e0d8] text-[#555] rounded-lg text-[13px] hover:bg-[#f7f4ef] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors"
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
