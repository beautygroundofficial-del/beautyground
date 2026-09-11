import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner } from '../../lib/types'

// 브랜드 셀러센터 — 판매자(사업자) 정보 (2026-09-11)
// update_my_partner_company_info RPC(supabase/brand_company_info.sql)로만 저장한다 — 브랜드명·입점상태·
// 수수료율은 계약사항이라 여기서 수정 대상이 아니고(화면에는 읽기전용으로만 보여준다), RPC 자체가
// 그 컬럼들을 건드리지 않는다.

interface FormState {
  biz_no: string
  ceo_name: string
  biz_address: string
  contact_phone: string
  bank_name: string
  bank_account: string
  bank_holder: string
}

const emptyForm: FormState = {
  biz_no: '', ceo_name: '', biz_address: '', contact_phone: '', bank_name: '', bank_account: '', bank_holder: '',
}

const card = 'bg-white rounded-[14px] border border-[#e5e0d8]'
const field =
  'w-full bg-white border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[14px] text-[#111] placeholder:text-[#c3bcae] focus:outline-none focus:border-[#b8924a] transition'
const labelCls = 'block text-[12px] font-semibold text-[#6b6355] mb-1.5'

const STATUS_LABEL: Record<Partner['status'], string> = {
  active: '이용중',
  pending: '승인 대기',
  suspended: '정지됨',
}

export default function BrandCompany() {
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getMyPartner()
      if (!active) return
      setPartner(p)
      if (p) {
        setForm({
          biz_no: p.biz_no ?? '',
          ceo_name: p.ceo_name ?? '',
          biz_address: p.biz_address ?? '',
          contact_phone: p.contact_phone ?? '',
          bank_name: p.bank_name ?? '',
          bank_account: p.bank_account ?? '',
          bank_holder: p.bank_holder ?? '',
        })
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const save = async () => {
    setSaving(true); setMsg(''); setOk('')
    try {
      const { error } = await supabase.rpc('update_my_partner_company_info', {
        p_biz_no: form.biz_no,
        p_ceo_name: form.ceo_name,
        p_biz_address: form.biz_address,
        p_contact_phone: form.contact_phone,
        p_bank_name: form.bank_name,
        p_bank_account: form.bank_account,
        p_bank_holder: form.bank_holder,
      })
      if (error) { setMsg(error.message); return }
      setOk('저장되었습니다.')
    } catch {
      setMsg('저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><p className="text-[14px] text-[#9a9080]">불러오는 중...</p></div>
  }

  if (!partner) {
    return (
      <div className={`max-w-md mx-auto mt-16 ${card} p-10 text-center`}>
        <p className="text-[16px] font-semibold text-[#111] mb-2">브랜드 계정을 찾을 수 없습니다</p>
        <p className="text-[14px] text-[#9a9080]">뷰티그라운드 담당자에게 문의해 주세요.</p>
      </div>
    )
  }

  return (
    <>
      {/* 읽기 전용 — 계약사항이라 셀프 수정 불가 */}
      <div className={`${card} p-6 mb-6`}>
        <h2 className="text-[15px] font-bold text-[#111] mb-4">계약 정보</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <p className={labelCls}>브랜드명</p>
            <p className="text-[14px] text-[#111]">{partner.brand_name}</p>
          </div>
          <div>
            <p className={labelCls}>입점 상태</p>
            <p className="text-[14px] text-[#111]">{STATUS_LABEL[partner.status] ?? partner.status}</p>
          </div>
          <div>
            <p className={labelCls}>수수료율</p>
            <p className="text-[14px] text-[#111]">{partner.commission_rate}%</p>
          </div>
        </div>
        <p className="mt-3 text-[11.5px] text-[#b3aa9a]">
          계약사항은 이 화면에서 직접 고칠 수 없습니다. 변경이 필요하면 뷰티그라운드 담당자에게 문의해 주세요.
        </p>
      </div>

      {/* 사업자정보·정산계좌 — 셀프 수정 */}
      <div className={`${card} p-6`}>
        <h2 className="text-[15px] font-bold text-[#111] mb-1">사업자·정산 정보</h2>
        <p className="text-[12.5px] text-[#9a9080] mb-4 leading-relaxed">
          정산금을 받을 계좌와 사업자 정보를 최신 상태로 유지해 주세요.
        </p>

        {msg && <p className="mb-3 text-[13px] text-[#a32118]">{msg}</p>}
        {ok && <p className="mb-3 text-[13px] text-[#2f7d5b]">{ok}</p>}

        <div className="grid gap-3.5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>사업자등록번호</label>
              <input value={form.biz_no} onChange={(e) => setForm({ ...form, biz_no: e.target.value })}
                className={field} placeholder="000-00-00000" />
            </div>
            <div>
              <label className={labelCls}>대표자명</label>
              <input value={form.ceo_name} onChange={(e) => setForm({ ...form, ceo_name: e.target.value })}
                className={field} placeholder="대표자 성함" />
            </div>
          </div>
          <div>
            <label className={labelCls}>사업장 주소</label>
            <input value={form.biz_address} onChange={(e) => setForm({ ...form, biz_address: e.target.value })}
              className={field} placeholder="사업장 주소" />
          </div>
          <div>
            <label className={labelCls}>담당자 연락처</label>
            <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              className={field} placeholder="010-0000-0000" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>은행명</label>
              <input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className={field} placeholder="은행명" />
            </div>
            <div>
              <label className={labelCls}>계좌번호</label>
              <input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                className={field} placeholder="계좌번호" />
            </div>
            <div>
              <label className={labelCls}>예금주</label>
              <input value={form.bank_holder} onChange={(e) => setForm({ ...form, bank_holder: e.target.value })}
                className={field} placeholder="예금주명" />
            </div>
          </div>
          <div className="pt-1">
            <button onClick={() => void save()} disabled={saving}
              className="rounded-lg bg-[#b8924a] text-white font-semibold text-[14px] px-6 py-2.5 disabled:opacity-50 transition">
              {saving ? '저장 중…' : '저장하기'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
