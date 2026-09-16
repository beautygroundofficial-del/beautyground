import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import Button from '../../components/common/Button'

const inputCls =
  'w-full border border-rule rounded-control px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors bg-paper'

// 브랜드(파트너) 관리 — 파트너센터 UI는 삭제됐지만 브랜드 식별/수수료율은 여전히 여기서 관리한다.
// 계정 연결 3가지 경로: ①이메일 "연결"(admin_link_partner_account) ②셀프가입 링크(/brand/register/:id)
// ③브랜드가 /brand/login 이메일 인증으로 직접 시작 → /brand/onboarding에서 pending 파트너 생성 → 여기서 "승인".
// pending은 승인 전까지 셀러센터에서 "수출 소개"만 열린다(2026-09-12 승인 버튼 추가).
export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [rateEdits, setRateEdits] = useState<Record<string, string>>({})
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [exportCopiedId, setExportCopiedId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase.from('partners').select('*').order('brand_name')
    if (err) { setError(`목록 조회 실패: ${err.message}`); setLoading(false); return }
    // 승인 대기(셀프 가입) 브랜드를 맨 위로 — 관리자가 승인 요청을 놓치지 않게
    const rows = (data ?? []) as Partner[]
    rows.sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || a.brand_name.localeCompare(b.brand_name, 'ko'))
    setPartners(rows)
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const saveRate = async (partner: Partner) => {
    const raw = rateEdits[partner.id]
    if (raw === undefined) return
    const rate = Number(raw)
    if (Number.isNaN(rate) || rate < 0) { setError('수수료율은 0 이상의 숫자로 입력해 주세요.'); return }
    setBusyId(partner.id)
    setError('')
    const { error: err } = await supabase.from('partners').update({ commission_rate: rate }).eq('id', partner.id)
    setBusyId(null)
    if (err) { setError(`수수료율 저장 실패: ${err.message}`); return }
    setPartners((prev) => prev.map((p) => (p.id === partner.id ? { ...p, commission_rate: rate } : p)))
    setRateEdits((prev) => { const next = { ...prev }; delete next[partner.id]; return next })
  }

  // 백화점 입점 여부 — VVIP 할인율 산정 기준(20% 백화점 / 30% 온라인 전용, supabase/vvip_members.sql)
  const toggleDeptStore = async (partner: Partner) => {
    setBusyId(partner.id)
    setError('')
    const next = !partner.is_dept_store_brand
    const { error: err } = await supabase.from('partners').update({ is_dept_store_brand: next }).eq('id', partner.id)
    setBusyId(null)
    if (err) { setError(`백화점 입점 여부 저장 실패: ${err.message}`); return }
    setPartners((prev) => prev.map((p) => (p.id === partner.id ? { ...p, is_dept_store_brand: next } : p)))
  }

  const changeStatus = async (partner: Partner, status: Partner['status']) => {
    setBusyId(partner.id)
    setError('')
    const { error: err } = await supabase.from('partners').update({ status }).eq('id', partner.id)
    setBusyId(null)
    if (err) { setError(`상태 변경 실패: ${err.message}`); return }
    setPartners((prev) => prev.map((p) => (p.id === partner.id ? { ...p, status } : p)))
  }

  const linkAccount = async (partner: Partner) => {
    const email = emailEdits[partner.id]?.trim()
    if (!email) { setError('연결할 계정의 이메일을 입력해 주세요.'); return }
    setBusyId(partner.id)
    setError('')
    const { data, error: err } = await supabase.rpc('admin_link_partner_account', {
      p_partner_id: partner.id,
      p_email: email,
    })
    setBusyId(null)
    if (err) { setError(`계정 연결 실패: ${err.message}`); return }
    setPartners((prev) => prev.map((p) => (p.id === partner.id ? (data as Partner) : p)))
    setEmailEdits((prev) => { const next = { ...prev }; delete next[partner.id]; return next })
  }

  // 이메일 선연결 대신 쓸 수 있는 셀프가입 링크(견본, 2026-08-15) — 백화점 담당자용 방식과 동일:
  // 브랜드가 링크를 열면 자기 로고(BI)를 확인하고 이메일·비밀번호만 입력해 스스로 가입.
  const copyRegisterLink = (partner: Partner) => {
    void navigator.clipboard.writeText(`${window.location.origin}/brand/register/${partner.id}`)
    setCopiedId(partner.id)
    setTimeout(() => setCopiedId((id) => (id === partner.id ? null : id)), 1500)
  }

  // 수출 전용 계정(대시보드/판매내역/정산내역은 안 보이고 "수출 소개"만 접근) 초대링크 생성.
  // 기존 판매 파트너 계정 연결 여부와 무관하게 언제든 새로 발급 가능(export_contacts 테이블,
  // supabase/export_contacts.sql) — 라이브 판매실적은 절대 노출되지 않는다.
  const createExportContactLink = async (partner: Partner) => {
    setBusyId(partner.id)
    setError('')
    const { data, error: err } = await supabase.rpc('create_export_contact_slot', { p_partner_id: partner.id })
    setBusyId(null)
    if (err) { setError(`수출 계정 초대링크 생성 실패: ${err.message}`); return }
    const slotId = (data as { id: string }).id
    void navigator.clipboard.writeText(`${window.location.origin}/brand/export-register/${slotId}`)
    setExportCopiedId(partner.id)
    setTimeout(() => setExportCopiedId((id) => (id === partner.id ? null : id)), 1500)
  }

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">브랜드 관리</p>
      </header>

      <main className="max-w-[1200px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">브랜드 관리</h1>
        <p className="text-[13px] text-ink-soft mb-5">
          브랜드별 수수료율을 관리하고, 브랜드 로그인 계정을 연결합니다. 계정은 Supabase 대시보드 →
          Authentication에서 먼저 만든 뒤 이메일로 연결하세요.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{error}</div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : partners.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">등록된 브랜드가 없습니다.</div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">브랜드</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">수수료율</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">백화점 입점</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">계정 연결</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">수출 전용 계정</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">수출 소개</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b border-rule last:border-b-0">
                    <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {p.export_logo_url && (
                          <img src={p.export_logo_url} alt="" className="w-6 h-6 rounded object-contain border border-rule bg-paper shrink-0" />
                        )}
                        {p.brand_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium ${
                          p.status === 'active' ? 'bg-signal-blue/10 text-signal-blue'
                            : p.status === 'pending' ? 'bg-[#fff4e0] text-[#b8924a]'
                            : 'bg-quiet text-ink-faint'
                        }`}
                      >
                        {p.status === 'active' ? '이용중' : p.status === 'pending' ? '승인 대기' : '정지됨'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0} step="0.1"
                          value={rateEdits[p.id] ?? String(p.commission_rate)}
                          onChange={(e) => setRateEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          className={`${inputCls} w-20`}
                        />
                        <span className="text-ink-faint">%</span>
                        <Button variant="inkOutline" size="sm" label="저장" disabled={busyId === p.id} onClick={() => void saveRate(p)} />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void toggleDeptStore(p)}
                        disabled={busyId === p.id}
                        className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium disabled:opacity-50 ${
                          p.is_dept_store_brand ? 'bg-signal-blue/10 text-signal-blue' : 'bg-quiet text-ink-faint'
                        }`}
                        title="VVIP 할인율 기준: 백화점 입점 20% / 온라인 전용 30%"
                      >
                        {p.is_dept_store_brand ? '백화점 입점' : '온라인 전용'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.user_id ? (
                        <span className="text-signal-blue text-[12px] font-medium">연결됨</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="email" placeholder="brand@company.com"
                            value={emailEdits[p.id] ?? ''}
                            onChange={(e) => setEmailEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className={`${inputCls} w-44`}
                          />
                          <Button variant="accent" size="sm" label="연결" disabled={busyId === p.id} onClick={() => void linkAccount(p)} />
                        </div>
                      )}
                      {!p.user_id && (
                        <button
                          type="button"
                          onClick={() => copyRegisterLink(p)}
                          className="mt-1 block text-[11px] text-ink-soft hover:text-ink underline"
                        >
                          {copiedId === p.id ? '가입링크 복사됨' : '또는 셀프가입 링크 복사'}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void createExportContactLink(p)}
                        disabled={busyId === p.id}
                        className="text-[11px] text-ink-soft hover:text-ink underline disabled:opacity-40"
                        title="대시보드·판매내역·정산내역은 안 보이고 수출 소개만 접근 가능한 별도 계정"
                      >
                        {exportCopiedId === p.id ? '초대링크 복사됨' : '수출 계정 초대링크 생성'}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[260px] text-ink-soft">
                      {p.export_pitch || p.export_certifications.length > 0 || p.export_countries || p.export_moq_notes ? (
                        <div
                          className="truncate"
                          title={[
                            p.export_pitch,
                            p.export_certifications.length > 0 ? `인증: ${p.export_certifications.join(', ')}` : null,
                            p.export_countries ? `수출국가: ${p.export_countries}` : null,
                            p.export_moq_notes ? `MOQ: ${p.export_moq_notes}` : null,
                          ].filter(Boolean).join(' / ')}
                        >
                          {p.export_pitch || '(소개글 없음)'}
                        </div>
                      ) : '-'}
                      {p.export_certifications.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {p.export_certifications.map((c) => (
                            <span key={c} className="inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] bg-quiet text-ink-faint">{c}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          {/* 셀프 가입(/brand/onboarding) 브랜드 승인 — active가 되면 셀러센터 전체 메뉴가 열리고
                              바이어 카탈로그·미니페이지에도 공개된다. 승인 전엔 "수출 소개"만 편집 가능. */}
                          <Button variant="accent" size="sm" label="승인" disabled={busyId === p.id} onClick={() => void changeStatus(p, 'active')} />
                          <Button variant="inkOutline" size="sm" label="정지" disabled={busyId === p.id} onClick={() => void changeStatus(p, 'suspended')} />
                        </div>
                      ) : p.status !== 'suspended' ? (
                        <Button variant="inkOutline" size="sm" label="정지" disabled={busyId === p.id} onClick={() => void changeStatus(p, 'suspended')} />
                      ) : (
                        <Button variant="accent" size="sm" label="재활성화" disabled={busyId === p.id} onClick={() => void changeStatus(p, 'active')} />
                      )}
                    </td>
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
