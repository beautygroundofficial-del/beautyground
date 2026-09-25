import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import PartnersGate from '../../components/partners/PartnersGate'
import { supabase } from '../../lib/supabase'
import { registerAffiliate, updateAffiliate, type Affiliate } from '../../lib/affiliate'

const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

// 개인정보·계좌 등록/수정 — 파트너스 회원가입 직후 처음 들어오면 "등록", 이후에는 같은 화면에서 "수정".
// 등록이 끝나야 개인 파트너스 페이지(/app/partners/home)로 넘어간다.
export default function AppPartnersInfo() {
  return (
    <PartnersGate title="개인정보·계좌" requireInfo={false}>
      {({ affiliate, reload }) => <InfoForm affiliate={affiliate} reload={reload} />}
    </PartnersGate>
  )
}

function InfoForm({ affiliate, reload }: { affiliate: Affiliate | null; reload: () => Promise<void> }) {
  const navigate = useNavigate()
  const isNew = !affiliate
  const [name, setName] = useState(affiliate?.name ?? '')
  const [phone, setPhone] = useState(affiliate?.phone ?? '')
  const [email, setEmail] = useState(affiliate?.email ?? '')
  const [bankName, setBankName] = useState(affiliate?.bank_name ?? '')
  const [bankAccount, setBankAccount] = useState(affiliate?.bank_account ?? '')
  const [bankHolder, setBankHolder] = useState(affiliate?.bank_holder ?? '')
  const [channel, setChannel] = useState(affiliate?.channel ?? '')
  const [agree, setAgree] = useState(!isNew)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 신규: 계정에 이미 있는 이름·이메일·전화는 미리 채운다(입력 부담 최소화)
  useEffect(() => {
    if (!isNew) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user
      if (!u) return
      const meta = u.user_metadata as { name?: string; full_name?: string } | undefined
      setName((v) => v || meta?.name || meta?.full_name || '')
      setEmail((v) => v || u.email || '')
      setPhone((v) => v || (u.phone ? u.phone.replace(/^\+82/, '0') : ''))
    })
  }, [isNew])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(''); setSaved('')
    if (name.trim().length < 2) { setError('이름을 입력해 주세요.'); return }
    if (!/^01[0-9]{8,9}$/.test(phone.replace(/\D/g, ''))) { setError('휴대폰 번호를 확인해 주세요.'); return }
    if (!bankName.trim() || !bankAccount.trim() || !bankHolder.trim()) { setError('정산받을 계좌 정보를 모두 입력해 주세요.'); return }
    if (isNew && !agree) { setError('안내 사항에 동의해 주세요.'); return }
    setSubmitting(true)
    const payload = {
      name: name.trim(), phone: phone.replace(/\D/g, ''), email: email.trim() || null,
      bank_name: bankName.trim(), bank_account: bankAccount.replace(/\s/g, ''), bank_holder: bankHolder.trim(),
      channel: channel.trim() || null,
    }
    if (isNew) {
      const res = await registerAffiliate(payload)
      setSubmitting(false)
      if (!res.ok) { setError(res.message); return }
      await reload()
      navigate('/app/partners/home', { replace: true })
      return
    }
    const err = await updateAffiliate(affiliate.id, payload)
    setSubmitting(false)
    if (err) { setError(err); return }
    await reload()
    setSaved('저장했어요')
  }

  return (
    <AppFrame>
      <BackHeader title={isNew ? '개인정보·계좌 등록' : '개인정보·계좌 수정'} onBack={() => navigate(isNew ? '/app/partners' : '/app/partners/home')} />
      <form onSubmit={submit} noValidate className="px-5 pt-5 pb-10 space-y-5">
        {isNew ? (
          <p className="text-[13px] text-ink-soft leading-relaxed">
            파트너스 회원가입이 끝났어요. 수수료를 받을 정보를 등록하면 개인 파트너스 페이지가 열려요.
          </p>
        ) : (
          <div className="rounded-control bg-quiet px-4 py-3 text-[12.5px] text-ink-soft">
            파트너 코드 <b className="text-ink">{affiliate.code}</b> · 상태 {affiliate.status === 'active' ? '정상' : '정지'}
          </div>
        )}

        <div><label className="block text-[13px] font-bold text-ink mb-1.5">이름</label><input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="실명" /></div>
        <div><label className="block text-[13px] font-bold text-ink mb-1.5">휴대폰</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="010-0000-0000" inputMode="tel" /></div>
        <div><label className="block text-[13px] font-bold text-ink mb-1.5">이메일 <span className="font-normal text-ink-faint">(정산 안내용, 선택)</span></label><input value={email} onChange={(e) => setEmail(e.target.value)} className={field} inputMode="email" /></div>

        <div className="pt-1">
          <p className="text-[13px] font-bold text-ink mb-2">정산 계좌</p>
          <div className="space-y-2.5">
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={field} placeholder="은행 (예: 국민은행)" />
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={field} placeholder="계좌번호 (숫자만)" inputMode="numeric" />
            <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} className={field} placeholder="예금주" />
          </div>
          <p className="text-[12px] text-ink-faint mt-2">예금주는 가입자 본인이어야 해요.</p>
        </div>

        <div><label className="block text-[13px] font-bold text-ink mb-1.5">주로 어디에 올리시나요? <span className="font-normal text-ink-faint">(선택)</span></label><input value={channel} onChange={(e) => setChannel(e.target.value)} className={field} placeholder="예: 인스타그램, 카카오톡 단체방, 블로그" /></div>

        {isNew && (
          <label className="flex items-start gap-2.5 text-[12.5px] text-ink-soft leading-relaxed">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>링크를 공유해 소개하는 방식이며, 다른 파트너를 모집하거나 하위 판매에 대한 수당은 없어요. 수수료는 구매 확정 기준으로 매월 정산되고, 관련 세법에 따라 세금이 공제될 수 있어요. 취소·환불된 주문은 정산에서 제외돼요. 이에 동의합니다.</span>
          </label>
        )}

        {error && <p className="text-[13px] text-signal-red" role="alert">{error}</p>}
        {saved && <p className="text-[13px] text-accent-deep" role="status">{saved}</p>}

        <button type="submit" disabled={submitting}
          className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring">
          {submitting ? '저장 중…' : isNew ? '등록하고 내 파트너스 페이지 열기' : '저장'}
        </button>
      </form>
    </AppFrame>
  )
}
