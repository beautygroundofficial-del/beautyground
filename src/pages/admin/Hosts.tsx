import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Host } from '../../lib/types'
import { formatDateTime } from '../../lib/format'
import Button from '../../components/common/Button'

type StatusFilter = Host['status'] | 'all'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '가입대기' },
  { value: 'active', label: '활동중' },
  { value: 'suspended', label: '정지됨' },
]

const statusBadge: Record<Host['status'], { label: string; className: string }> = {
  pending: { label: '가입대기', className: 'bg-amber-100 text-amber-700' },
  active: { label: '활동중', className: 'bg-green-100 text-green-700' },
  suspended: { label: '정지됨', className: 'bg-gray-100 text-gray-500' },
}

export default function AdminHosts() {
  const [hosts, setHosts] = useState<Host[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('hosts').select('*').order('created_at', { ascending: false })
    setHosts((data ?? []) as Host[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const updateLocal = (id: string, status: Host['status']) => {
    setHosts((prev) => prev.map((h) => (h.id === id ? { ...h, status } : h)))
  }

  const changeStatus = async (host: Host, status: Host['status']) => {
    setBusyId(host.id)
    setError('')
    const { error: updErr } = await supabase.from('hosts').update({ status }).eq('id', host.id)
    if (updErr) {
      setError(`처리 실패: ${updErr.message}`)
      setBusyId(null)
      return
    }
    updateLocal(host.id, status)
    setBusyId(null)
  }

  const visible = filter === 'all' ? hosts : hosts.filter((h) => h.status === filter)

  return (
    <>
      <header className="h-[60px] bg-white border-b border-[#eee] flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-[#111]">진행자 관리</p>
      </header>

      <main className="max-w-[1100px] p-8">
        <h1 className="text-[22px] font-bold text-text mb-4">진행자 관리</h1>

        <div className="flex items-center gap-2 mb-5 flex-wrap">
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-text-hint">불러오는 중…</div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-text-hint">해당하는 진행자가 없습니다.</div>
        ) : (
          <div className="bg-white rounded-md border overflow-x-auto" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-cream-2 text-text-sub">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">가입일</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">이름</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">연락처</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">이메일</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((host) => {
                  const badge = statusBadge[host.status]
                  return (
                    <tr key={host.id} className="border-b border-cream-2 last:border-b-0">
                      <td className="px-4 py-3 text-text-sub whitespace-nowrap">{formatDateTime(host.created_at)}</td>
                      <td className="px-4 py-3 text-text font-medium">{host.name}</td>
                      <td className="px-4 py-3 text-text-sub whitespace-nowrap">{host.phone ?? '-'}</td>
                      <td className="px-4 py-3 text-text-sub">{host.email ?? '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {host.status !== 'active' && (
                            <Button
                              variant="gold" size="sm" label="승인/활성화"
                              disabled={busyId === host.id}
                              onClick={() => void changeStatus(host, 'active')}
                            />
                          )}
                          {host.status !== 'suspended' && (
                            <Button
                              variant="cancel" size="sm" label="정지"
                              disabled={busyId === host.id}
                              onClick={() => void changeStatus(host, 'suspended')}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
