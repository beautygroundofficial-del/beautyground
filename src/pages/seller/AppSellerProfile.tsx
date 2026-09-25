import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import SellerGate from '../../components/seller/SellerGate'
import { updateAffiliate, type Affiliate } from '../../lib/affiliate'

const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

// 내 정보 · 정산 계좌 수정. 셀러 코드·상태는 못 바꾼다(DB 트리거로도 막힘).
export default function AppSellerProfile() {
  return (
    <SellerGate title="내 정보">
      {({ affiliate, reload }) => (affiliate ? <ProfileForm affiliate={affiliate} reload={reload} /> : null)}
    </SellerGate>
  )
}

function ProfileForm({ affiliate, reload }: { affiliate: Affiliate; reload: () => Promise<void> }) {
  const navigate = useNavigate()
  const [name, setName] = useState(affiliate.name)
  const [phone, setPhone] = useState(affiliate.phone ?? '')
  const [email, setEmail] = useState(affiliate.email ?? '')
  const [bankName, setBankName] = useState(affiliate.bank_name ?? '')
  const [bankAccount, setBankAccount] = useState(affiliate.bank_account ?? '')
  const [bankHolder, setBankHolder] = useState(affiliate.bank_holder ?? '')
  const [channel, setChannel] = useState(affiliate.channel ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setMsg('')
    if (name.trim().length < 2) { setMsg('이름을 입력해 주세요.'); return }
    setSaving(true)
    const err = await updateAffiliate(affiliate.id, {
      name: name.trim(), phone: phone.replace(/\D/g, '') || null, email: email.trim() || null,
      bank_name: bankName.trim() || null, bank_account: bankAccount.replace(/\s/g, '') || null, bank_holder: bankHolder.trim() || null,
      channel: channel.trim() || null,
    })
    setSaving(false)
    if (err) { setMsg(err); return }
    await reload()
    setMsg('저장했어요')
  }

  return (
    <AppFrame>
      <BackHeader title="내 정보" onBack={() => navigate('/app/seller')} />
      <form onSubmit={save} noValidate className="px-5 pt-5 pb-10 space-y-4">
        <div className="rounded-control bg-quiet px-4 py-3 text-[12.5px] text-ink-soft">
          셀러 코드 <b className="text-ink">{affiliate.code}</b> · 상태 {affiliate.status === 'active' ? '정상' : '정지'}
        </div>
        <div><label className="block text-[13px] font-bold text-ink mb-1.5">이름</label><input value={name} onChange={(e) => setName(e.target.value)} className={field} /></div>
        <div><label className="block text-[13px] font-bold text-ink mb-1.5">휴대폰</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} inputMode="tel" /></div>
        <div><label className="block text-[13px] font-bold text-ink mb-1.5">이메일</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={field} inputMode="email" /></div>
        <div className="pt-1">
          <p className="text-[13px] font-bold text-ink mb-2">정산 계좌</p>
          <div className="space-y-2.5">
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={field} placeholder="은행" />
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={field} placeholder="계좌번호" inputMode="numeric" />
            <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} className={field} placeholder="예금주" />
          </div>
        </div>
        <div><label className="block text-[13px] font-bold text-ink mb-1.5">주로 올리는 곳</label><input value={channel} onChange={(e) => setChannel(e.target.value)} className={field} /></div>
        {msg && <p className={`text-[13px] ${msg === '저장했어요' ? 'text-accent-deep' : 'text-signal-red'}`} role="status">{msg}</p>}
        <button type="submit" disabled={saving} className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-60">{saving ? '저장 중…' : '저장'}</button>
      </form>
    </AppFrame>
  )
}
