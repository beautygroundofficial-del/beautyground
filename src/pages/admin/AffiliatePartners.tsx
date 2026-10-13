import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { adminAffiliateSignupStats, type Affiliate, type AffiliateSignupStat } from '../../lib/affiliate'
import Button from '../../components/common/Button'

// 파트너스(개인 제휴 판매자) 목록 — affiliates 테이블은 affiliates_admin_all 정책으로
// 관리자가 전체 select/update 가능(affiliates.sql). 상태 변경만 여기서 직접 처리하고,
// 정산은 별도 화면(/admin/affiliate-settlements)에서 다룬다.
export default function AdminAffiliatePartners() {
  const [rows, setRows] = useState<Affiliate[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  // 파트너 링크로 가입한 사람과 가입 뒤 행동(관리자 집계, supabase/affiliate_signup_attribution.sql)
  const [stats, setStats] = useState<AffiliateSignupStat[]>([])
  const [statsError, setStatsError] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('affiliates').select('*').order('created_at', { ascending: false })
    if (err) { setError(`목록 조회 실패: ${err.message}`); setLoading(false); return }
    setRows((data ?? []) as Affiliate[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { void adminAffiliateSignupStats().then((r) => { setStats(r.rows); setStatsError(r.error) }) }, [])

  const toggleStatus = async (row: Affiliate) => {
    const next = row.status === 'active' ? 'suspended' : 'active'
    setBusyId(row.id)
    setError('')
    const { error: err } = await supabase.from('affiliates').update({ status: next }).eq('id', row.id)
    setBusyId(null)
    if (err) { setError(`상태 변경 실패: ${err.message}`); return }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)))
  }

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">파트너스 관리</p>
      </header>

      <main className="max-w-[1100px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-1">파트너스 관리</h1>
        <p className="text-[13px] text-ink-soft mb-6">앱 제품 링크로 판매하는 개인 제휴 판매자(쿠팡파트너스식) 목록입니다.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{error}</div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">가입한 파트너스가 없습니다.</div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">코드</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">이름</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">연락처</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">주로 공유하는 곳</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">가입일</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3 text-ink font-mono whitespace-nowrap">{row.code}</td>
                    <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{row.phone ?? row.email ?? '-'}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{row.channel ?? '-'}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{new Date(row.created_at).toLocaleDateString('ko-KR')}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium ${row.status === 'active' ? 'bg-signal-blue/10 text-signal-blue' : 'bg-quiet text-ink-soft'}`}>
                        {row.status === 'active' ? '활동 중' : '정지'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Button
                        variant="inkOutline" size="sm"
                        label={busyId === row.id ? '처리 중...' : row.status === 'active' ? '정지' : '재활성화'}
                        disabled={busyId === row.id}
                        onClick={() => void toggleStatus(row)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="text-[17px] font-bold text-ink mt-10 mb-1">파트너 링크로 들어온 가입자</h2>
        <p className="text-[13px] text-ink-soft mb-4">
          파트너 링크를 거쳐 가입한 사람이 가입 뒤 커뮤니티에 남는지 보는 집계입니다(측정 전용 — 가입·활동 보상은 없습니다).
          비율은 가입한 지 7일/30일이 지난 사람만 기준으로 하고, "다시 접속"은 마지막 접속 시각 기준입니다.
        </p>
        {statsError ? (
          <div className="bg-quiet text-ink-soft text-[13px] rounded-md px-4 py-3">집계를 불러오지 못했어요: {statsError}</div>
        ) : stats.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-ink-faint">아직 집계할 파트너가 없습니다.</div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">코드</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">이름</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">가입자</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">최근 30일 가입</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">7일 안에 글·댓글</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">7일 뒤 다시 접속</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">30일 안에 글·댓글</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">30일 뒤 다시 접속</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((r) => (
                  <tr key={r.affiliate_id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3 text-ink font-mono whitespace-nowrap">{r.code}</td>
                    <td className="px-4 py-3 text-ink whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3 text-ink font-semibold tabular-nums">{r.signups}명</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums">{r.signups_30d}명</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums whitespace-nowrap">{ratio(r.wrote_7d, r.mature_7d)}</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums whitespace-nowrap">{ratio(r.returned_7d, r.mature_7d)}</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums whitespace-nowrap">{ratio(r.wrote_30d, r.mature_30d)}</td>
                    <td className="px-4 py-3 text-ink-soft tabular-nums whitespace-nowrap">{ratio(r.returned_30d, r.mature_30d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}

// 비율 표시 — 기간이 아직 안 된 파트너(분모 0)는 "기간 전"
function ratio(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 100)}% (${n}/${d})` : '기간 전'
}
