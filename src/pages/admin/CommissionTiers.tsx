import { useEffect, useState } from 'react'
import { IconTrash, IconPencil } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { CommissionTier } from '../../lib/types'
import { won } from '../../lib/format'
import Button from '../../components/common/Button'

const inputCls =
  'w-full border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:border-[#b8924a] transition-colors bg-white'

interface FormState {
  id: string | null
  name: string
  minSales: string
  commissionRate: string
}

const EMPTY_FORM: FormState = { id: null, name: '', minSales: '', commissionRate: '' }

export default function AdminCommissionTiers() {
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDel, setConfirmDel] = useState<CommissionTier | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('commission_tiers').select('*').order('min_sales', { ascending: true })
    setTiers((data ?? []) as CommissionTier[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const startEdit = (tier: CommissionTier) => {
    setForm({
      id: tier.id,
      name: tier.name,
      minSales: String(tier.min_sales),
      commissionRate: String(tier.commission_rate),
    })
  }

  const resetForm = () => setForm(EMPTY_FORM)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) { setError('등급명을 입력해 주세요.'); return }
    if (form.minSales.trim() === '' || Number(form.minSales) < 0) { setError('기준 매출을 입력해 주세요.'); return }
    if (form.commissionRate.trim() === '' || Number(form.commissionRate) < 0 || Number(form.commissionRate) > 100) {
      setError('수수료율은 0~100 사이로 입력해 주세요.')
      return
    }

    setSubmitting(true)
    const payload = {
      name: form.name.trim(),
      min_sales: Number(form.minSales),
      commission_rate: Number(form.commissionRate),
    }

    const { error: err } = form.id
      ? await supabase.from('commission_tiers').update(payload).eq('id', form.id)
      : await supabase.from('commission_tiers').insert(payload)

    if (err) {
      setError(`저장 실패: ${err.message}`)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    resetForm()
    void load()
  }

  const handleDelete = async () => {
    if (!confirmDel) return
    await supabase.from('commission_tiers').delete().eq('id', confirmDel.id)
    setConfirmDel(null)
    void load()
  }

  return (
    <>
      <header className="h-[60px] bg-white border-b border-[#eee] flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-[#111]">수수료 등급 관리</p>
      </header>

      <main className="max-w-[900px] p-8">
        <h1 className="text-[22px] font-bold text-text mb-2">수수료 등급 관리</h1>
        <p className="text-[13px] text-text-sub mb-6">
          진행자의 월 매출이 기준 매출 이상이면 해당 등급의 수수료율이 적용됩니다. 매출이 가장 높은 조건을
          만족하는 등급이 자동 선택됩니다.
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end"
        >
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">등급명</label>
            <input
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="예: 브론즈" className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">기준 매출 (원, 이상)</label>
            <input
              type="number" min={0}
              value={form.minSales} onChange={(e) => setForm((p) => ({ ...p, minSales: e.target.value }))}
              placeholder="0" className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">수수료율 (%)</label>
            <input
              type="number" min={0} max={100} step="0.1"
              value={form.commissionRate} onChange={(e) => setForm((p) => ({ ...p, commissionRate: e.target.value }))}
              placeholder="예: 5" className={inputCls}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit" variant="gold" size="sm"
              label={submitting ? '저장 중...' : form.id ? '수정' : '추가'}
              disabled={submitting}
            />
            {form.id && (
              <Button type="button" variant="cancel" size="sm" label="취소" onClick={resetForm} />
            )}
          </div>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-text-hint">불러오는 중…</div>
        ) : tiers.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-text-hint">등록된 등급이 없습니다. 위에서 추가해 주세요.</div>
        ) : (
          <div className="bg-white rounded-md border overflow-x-auto" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-cream-2 text-text-sub">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">등급명</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">기준 매출</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">수수료율</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr key={tier.id} className="border-b border-cream-2 last:border-b-0">
                    <td className="px-4 py-3 text-text font-medium">{tier.name}</td>
                    <td className="px-4 py-3 text-text-sub whitespace-nowrap">{won(tier.min_sales)} 이상</td>
                    <td className="px-4 py-3 text-text-sub whitespace-nowrap">{tier.commission_rate}%</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button onClick={() => startEdit(tier)} className="text-[#9a9080] hover:text-[#b8924a]" aria-label="수정">
                          <IconPencil size={16} />
                        </button>
                        <button onClick={() => setConfirmDel(tier)} className="text-[#9a9080] hover:text-red-500" aria-label="삭제">
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirmDel(null)}>
          <div className="bg-white rounded-md w-full max-w-[400px] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-text mb-2">'{confirmDel.name}' 등급을 삭제할까요?</p>
            <p className="text-[13px] text-text-sub mb-6 leading-relaxed">
              이미 생성된 과거 정산 내역은 등급명·수수료율이 스냅샷으로 저장돼 있어 영향을 받지 않습니다.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="cancel" size="sm" label="취소" onClick={() => setConfirmDel(null)} />
              <Button variant="gold" size="sm" label="삭제" onClick={() => void handleDelete()} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
