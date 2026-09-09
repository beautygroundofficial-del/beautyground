import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// 전화번호 인증 배너 — 가입이 아니라 "포인트를 처음 받으려 할 때" 보여준다(2026-09-09).
//
// 대표님 지시: "회원가입은 복잡할 필요 없고, 커뮤니티 어뷰징(다중계정으로 포인트만
// 반복 수령) 방지를 위해 서비스 사용 시점에 전화번호를 추가하면 된다."
//
// 글쓰기·공감·댓글 자체는 이 배너와 무관하게 항상 가능하다 — 안 눌러도 그만이고,
// 그러면 그냥 포인트만 안 쌓인다(supabase/phone_verification.sql 의 claim_mission 참고).
// 로그인 안 한 손님에게는 아예 안 보인다.
export default function PhoneVerifyBanner() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setLoggedIn(!!session)
      if (!session) { setVerified(true); return } // 비로그인은 배너 자체를 안 보여준다
      const { data } = await supabase.rpc('get_my_phone_verified')
      setVerified(!!data)
    })
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  if (!loggedIn || verified !== false) return null

  const call = async (action: 'phone-request' | 'phone-verify', extra: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, reason: '로그인이 필요합니다.' }
    const r = await fetch('/api/auth-naver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action, ...extra }),
    })
    return r.json().catch(() => ({ ok: false, reason: '요청에 실패했습니다.' }))
  }

  const requestCode = async () => {
    const digits = phone.replace(/\D/g, '')
    if (!/^01[0-9]\d{7,8}$/.test(digits)) { setError('휴대전화번호를 확인해 주세요.'); return }
    setSending(true); setError('')
    const res = await call('phone-request', { phone: digits })
    setSending(false)
    if (!res.ok) { setError(res.reason || '인증문자 발송에 실패했습니다.'); return }
    if (res.alreadyVerified) { setVerified(true); setOpen(false); return }
    setStep('code')
    setCooldown(60)
  }

  const verifyCode = async () => {
    const digits = phone.replace(/\D/g, '')
    if (!/^\d{6}$/.test(code)) { setError('인증번호 6자리를 입력해 주세요.'); return }
    setSending(true); setError('')
    const res = await call('phone-verify', { phone: digits, code })
    setSending(false)
    if (!res.ok) { setError(res.reason || '인증번호가 올바르지 않습니다.'); return }
    setVerified(true)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between rounded-control bg-quiet px-4 py-3 text-left focus:outline-none focus-visible:shadow-ring"
      >
        <span className="text-[13px] text-ink-soft">
          <span className="font-bold text-ink">전화번호 인증</span>하고 포인트 받기
        </span>
        <span className="text-[12px] text-ink-faint">1분이면 돼요 ›</span>
      </button>
    )
  }

  return (
    <div className="rounded-control bg-quiet px-4 py-4">
      {step === 'phone' ? (
        <>
          <p className="text-[13px] font-bold text-ink mb-2">전화번호 인증</p>
          <p className="text-[12px] text-ink-faint mb-3">한 번만 하면 돼요. 다른 사람 계정과 겹치는 번호는 인증이 안 돼요.</p>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              inputMode="numeric"
              className="flex-1 rounded-control bg-paper border border-rule px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring"
            />
            <button
              type="button"
              onClick={() => void requestCode()}
              disabled={sending}
              className="shrink-0 rounded-control bg-ink text-paper font-bold text-[13px] px-4 disabled:opacity-50"
            >
              {sending ? '전송 중…' : '인증번호 받기'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] font-bold text-ink mb-2">인증번호 입력</p>
          <p className="text-[12px] text-ink-faint mb-3">{phone}로 보낸 6자리 번호를 입력해 주세요.</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              className="flex-1 rounded-control bg-paper border border-rule px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint tracking-[0.3em] focus:outline-none focus-visible:shadow-ring"
            />
            <button
              type="button"
              onClick={() => void verifyCode()}
              disabled={sending}
              className="shrink-0 rounded-control bg-ink text-paper font-bold text-[13px] px-4 disabled:opacity-50"
            >
              {sending ? '확인 중…' : '확인'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void requestCode()}
            disabled={cooldown > 0 || sending}
            className="mt-2 text-[12px] text-ink-faint underline disabled:no-underline disabled:opacity-50"
          >
            {cooldown > 0 ? `${cooldown}초 후 재전송 가능` : '인증번호 다시 받기'}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-[12px] text-signal-red">{error}</p>}
      <button
        type="button"
        onClick={() => { setOpen(false); setStep('phone'); setError('') }}
        className="mt-3 text-[12px] text-ink-faint underline"
      >
        나중에 할게요
      </button>
    </div>
  )
}
