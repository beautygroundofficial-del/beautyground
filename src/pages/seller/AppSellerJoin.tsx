import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import SellerGate from '../../components/seller/SellerGate'
import { supabase } from '../../lib/supabase'
import { registerAffiliate } from '../../lib/affiliate'

const field =
  'w-full rounded-control bg-paper border border-rule px-4 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

// 링크 셀러 가입 — 로그인된 쇼핑앱 계정에 셀러 정보(이름·연락처·정산계좌)를 붙인다. 심사 없이 즉시 활성.
export default function AppSellerJoin() {
  const navigate = useNavigate()
  return (
    <SellerGate title="링크 셀러 가입" requireJoined={false}>
      {({ affiliate, reload }) => {
        if (affiliate) { navigate('/app/seller', { replace: true }); return null }
        return <JoinForm onDone={async () => { await reload(); navigate('/app/seller', { replace: true }) }} />
      }}
    </SellerGate>
  )
}

function JoinForm({ onDone }: { onDone: () => Promise<void> }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [channel, setChannel] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 계정에 이미 있는 이름·이메일·전화는 미리 채운다(4060 고객 입력 부담 최소화)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user
      if (!u) return
      const meta = u.user_metadata as { name?: string; full_name?: string } | undefined
      setName((v) => v || meta?.name || meta?.full_name || '')
      setEmail((v) => v || u.email || '')
      setPhone((v) => v || (u.phone ? u.phone.replace(/^\+82/, '0') : ''))
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (name.trim().length < 2) { setError('이름을 입력해 주세요.'); return }
    if (!/^01[0-9]{8,9}$/.test(phone.replace(/\D/g, ''))) { setError('휴대폰 번호를 확인해 주세요.'); return }
    if (!bankName.trim() || !bankAccount.trim() || !bankHolder.trim()) { setError('정산받을 계좌 정보를 모두 입력해 주세요.'); return }
    if (!agree) { setError('안내 사항에 동의해 주세요.'); return }
    setSubmitting(true)
    const res = await registerAffiliate({
      name: name.trim(), phone: phone.replace(/\D/g, ''), email: email.trim() || null,
      bank_name: bankName.trim(), bank_account: bankAccount.replace(/\s/g, ''), bank_holder: bankHolder.trim(),
      channel: channel.trim() || null,
    })
    setSubmitting(false)
    if (!res.ok) { setError(res.message); return }
    await onDone()
  }

  return (
    <AppFrame>
      <BackHeader title="링크 셀러 가입" onBack={() => navigate('/app/mypage')} />
      <form onSubmit={submit} noValidate className="px-5 pt-5 pb-10 space-y-5">
        <p className="text-[13px] text-ink-soft leading-relaxed">
          내 링크로 구매가 일어나면 판매금액의 <b className="text-ink">5%</b>가 수수료로 쌓이고, 매월 정산해 아래 계좌로 보내드려요.
        </p>

        <div>
          <label className="block text-[13px] font-bold text-ink mb-1.5">이름</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="실명" />
        </div>
        <div>
          <label className="block text-[13px] font-bold text-ink mb-1.5">휴대폰</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="010-0000-0000" inputMode="tel" />
        </div>
        <div>
          <label className="block text-[13px] font-bold text-ink mb-1.5">이메일 <span className="font-normal text-ink-faint">(정산 안내용, 선택)</span></label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="example@email.com" inputMode="email" />
        </div>

        <div className="pt-2">
          <p className="text-[13px] font-bold text-ink mb-2">정산 계좌</p>
          <div className="space-y-2.5">
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={field} placeholder="은행 (예: 국민은행)" />
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className={field} placeholder="계좌번호 (숫자만)" inputMode="numeric" />
            <input value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} className={field} placeholder="예금주" />
          </div>
          <p className="text-[12px] text-ink-faint mt-2">예금주는 가입자 본인이어야 해요.</p>
        </div>

        <div>
          <label className="block text-[13px] font-bold text-ink mb-1.5">주로 어디에 올리시나요? <span className="font-normal text-ink-faint">(선택)</span></label>
          <input value={channel} onChange={(e) => setChannel(e.target.value)} className={field} placeholder="예: 인스타그램, 카카오톡 단체방, 블로그" />
        </div>

        <label className="flex items-start gap-2.5 text-[12.5px] text-ink-soft leading-relaxed">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
          <span>
            링크를 공유해 소개하는 방식이며, 다른 셀러를 모집하거나 하위 판매에 대한 수당은 없어요.
            수수료는 구매 확정 기준으로 매월 정산되고, 관련 세법에 따라 세금이 공제될 수 있어요.
            취소·환불된 주문은 정산에서 제외돼요. 이에 동의합니다.
          </span>
        </label>

        {error && <p className="text-[13px] text-signal-red" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-3.5 disabled:opacity-60 focus:outline-none focus-visible:shadow-ring"
        >
          {submitting ? '가입 중…' : '가입하고 링크 만들기'}
        </button>
      </form>
    </AppFrame>
  )
}
