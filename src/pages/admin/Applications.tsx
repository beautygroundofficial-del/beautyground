import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { PartnerApplication } from '../../lib/types'
import { formatDateTime } from '../../lib/format'
import Button from '../../components/common/Button'

type AppStatus = PartnerApplication['status']

const statusBadge: Record<AppStatus, { label: string; className: string }> = {
  pending: { label: '심사중', className: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인', className: 'bg-green-100 text-green-700' },
  rejected: { label: '반려', className: 'bg-gray-100 text-gray-500' },
}

export default function AdminApplications() {
  const [apps, setApps] = useState<PartnerApplication[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('partner_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (!active) return
      setApps((data ?? []) as PartnerApplication[])
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const updateLocal = (id: string, status: AppStatus) => {
    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    )
  }

  const approve = async (app: PartnerApplication) => {
    setBusyId(app.id)
    setError('')

    const { error: updErr } = await supabase
      .from('partner_applications')
      .update({ status: 'approved' })
      .eq('id', app.id)

    if (updErr) {
      setError(`승인 처리 실패: ${updErr.message}`)
      setBusyId(null)
      return
    }

    if (app.user_id) {
      const { error: upErr } = await supabase
        .from('partners')
        .upsert(
          { user_id: app.user_id, brand_name: app.brand_name },
          { onConflict: 'user_id', ignoreDuplicates: true }
        )
      if (upErr) {
        setError(
          `신청은 승인되었으나 파트너 등록에 실패했습니다: ${upErr.message}`
        )
      }
    } else {
      setError(
        '신청은 승인되었습니다. (user_id 가 없어 파트너 자동 등록은 건너뛰었습니다.)'
      )
    }

    updateLocal(app.id, 'approved')
    setBusyId(null)
  }

  const reject = async (app: PartnerApplication) => {
    setBusyId(app.id)
    setError('')

    const { error: updErr } = await supabase
      .from('partner_applications')
      .update({ status: 'rejected' })
      .eq('id', app.id)

    if (updErr) {
      setError(`반려 처리 실패: ${updErr.message}`)
      setBusyId(null)
      return
    }

    updateLocal(app.id, 'rejected')
    setBusyId(null)
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="h-16 bg-white border-b border-cream-2 flex items-center px-6 justify-between">
        <Link to="/" className="font-serif text-[18px] font-bold text-gold">
          뷰티그라운드 관리자
        </Link>
      </header>

      <main className="max-w-[1100px] mx-auto p-6">
        <h1 className="text-[22px] font-bold text-text mb-4">파트너 신청 관리</h1>

        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[13px] rounded-md px-4 py-3 mb-5 leading-relaxed">
          ※ 승인/반려는 RLS 정책상 service_role 또는 별도 정책이 필요할 수
          있습니다. 동작하지 않으면 Supabase SQL Editor에서 수동 승인하세요.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-text-hint">
            불러오는 중…
          </div>
        ) : apps.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-text-hint">
            접수된 파트너 신청이 없습니다.
          </div>
        ) : (
          <div
            className="bg-white rounded-md border overflow-x-auto"
            style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
          >
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-cream-2 text-text-sub">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">신청일</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">브랜드명</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">담당자</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">연락처</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">카테고리</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const badge = statusBadge[app.status]
                  return (
                    <tr
                      key={app.id}
                      className="border-b border-cream-2 last:border-b-0"
                    >
                      <td className="px-4 py-3 text-text-sub whitespace-nowrap">
                        {formatDateTime(app.created_at)}
                      </td>
                      <td className="px-4 py-3 text-text font-medium">
                        {app.brand_name}
                      </td>
                      <td className="px-4 py-3 text-text-sub">
                        {app.rep_name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-text-sub whitespace-nowrap">
                        {app.phone}
                      </td>
                      <td className="px-4 py-3 text-text-sub">
                        {app.category ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {app.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="gold"
                              size="sm"
                              label="승인"
                              disabled={busyId === app.id}
                              onClick={() => void approve(app)}
                            />
                            <Button
                              variant="cancel"
                              size="sm"
                              label="반려"
                              disabled={busyId === app.id}
                              onClick={() => void reject(app)}
                            />
                          </div>
                        ) : (
                          <span className="text-text-hint">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
