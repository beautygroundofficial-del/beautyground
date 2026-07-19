import { useState } from 'react'
import { Link } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'
import { supabase } from '../../lib/supabase'

interface FormState {
  name: string
  phone: string
  email: string
  password: string
  passwordConfirm: string
}

const INITIAL: FormState = { name: '', phone: '', email: '', password: '', passwordConfirm: '' }

type FieldErrors = Partial<Record<keyof FormState | 'agree', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

const field =
  'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

export default function HostRegister() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!form.name.trim()) e.name = '이름을 입력하세요.'
    if (!form.phone.trim()) e.phone = '연락처를 입력하세요.'
    if (!form.email.trim()) e.email = '이메일을 입력하세요.'
    else if (!EMAIL_RE.test(form.email.trim())) e.email = '올바른 이메일 형식이 아닙니다.'
    if (!form.password) e.password = '비밀번호를 입력하세요.'
    else if (!PASSWORD_RE.test(form.password))
      e.password = '8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다.'
    if (!form.passwordConfirm) e.passwordConfirm = '비밀번호를 다시 입력하세요.'
    else if (form.password !== form.passwordConfirm)
      e.passwordConfirm = '비밀번호가 일치하지 않습니다.'
    if (!agree) e.agree = '개인정보 수집·이용에 동의해야 합니다.'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFormError(null)

    const v = validate()
    if (Object.keys(v).length > 0) { setErrors(v); return }
    setErrors({})
    setSubmitting(true)

    const email = form.email.trim()

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
    })

    if (signUpError) {
      const msg = signUpError.message?.toLowerCase() ?? ''
      const already = msg.includes('already') || msg.includes('registered') || msg.includes('exists')
      setSubmitting(false)
      setFormError(
        already
          ? '이미 등록된 이메일입니다. 로그인을 이용해 주세요.'
          : `회원가입 중 오류가 발생했습니다. (${signUpError.message})`
      )
      return
    }

    if (signUpData.user && signUpData.user.identities?.length === 0) {
      setSubmitting(false)
      setFormError('이미 등록된 이메일입니다. 로그인을 이용해 주세요.')
      return
    }

    // 파트너와 달리 신청 테이블 없이 hosts 에 바로 pending 으로 insert
    const { error: insertError } = await supabase.from('hosts').insert([
      {
        user_id: signUpData.user?.id ?? null,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email,
        status: 'pending',
      },
    ])

    if (insertError) {
      setSubmitting(false)
      setFormError(`가입 신청 저장 중 오류가 발생했습니다. (${insertError.message})`)
      return
    }

    setSubmitting(false)
    setDone(true)
  }

  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[420px] mx-auto px-4 sm:px-6">
          {done ? (
            <div
              className="bg-white rounded-md p-8 md:p-10 text-center border shadow-[0_4px_24px_rgba(0,0,0,0.05)]"
              style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
            >
              <div className="text-5xl mb-5" aria-hidden="true">✅</div>
              <h1 className="font-serif text-[22px] md:text-[26px] font-bold text-text mb-3">
                가입 신청이 접수되었습니다
              </h1>
              <p className="text-[14px] text-text-sub leading-relaxed">
                승인 후 로그인하실 수 있습니다.<br />
                결과는 입력하신 이메일로 안내드립니다.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
                <Link
                  to="/"
                  className="inline-block bg-gold text-white rounded-pill text-[14px] px-6 py-3 font-medium hover:bg-gold-light transition-colors"
                >
                  홈으로
                </Link>
                <Link
                  to="/host/login"
                  className="inline-block bg-cream-3 text-text-sub rounded-pill text-[14px] px-6 py-3 font-medium hover:bg-cream-2 transition-colors"
                >
                  로그인
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="font-serif text-[28px] md:text-[32px] font-bold text-gold">
                  뷰티그라운드
                </h1>
                <p className="text-text-sub text-[14px] mt-2">진행자 회원가입</p>
              </div>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="bg-white rounded-md p-6 md:p-8 border shadow-[0_4px_24px_rgba(0,0,0,0.05)]"
                style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
              >
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-[13px] font-medium text-text mb-1.5">
                      이름 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="name" name="name" type="text"
                      value={form.name} onChange={handleChange}
                      placeholder="홍길동" className={field}
                    />
                    {errors.name && <p className="mt-1 text-[12px] text-[#FF4757]">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-[13px] font-medium text-text mb-1.5">
                      연락처 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="phone" name="phone" type="tel"
                      value={form.phone} onChange={handleChange}
                      placeholder="010-0000-0000" className={field}
                    />
                    {errors.phone && <p className="mt-1 text-[12px] text-[#FF4757]">{errors.phone}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                      이메일 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="email" name="email" type="email"
                      value={form.email} onChange={handleChange}
                      placeholder="example@email.com" className={field}
                    />
                    {errors.email && <p className="mt-1 text-[12px] text-[#FF4757]">{errors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-[13px] font-medium text-text mb-1.5">
                      비밀번호 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="password" name="password" type="password"
                      value={form.password} onChange={handleChange}
                      placeholder="8자 이상, 영문+숫자+특수문자" className={field}
                    />
                    {errors.password && <p className="mt-1 text-[12px] text-[#FF4757]">{errors.password}</p>}
                  </div>

                  <div>
                    <label htmlFor="passwordConfirm" className="block text-[13px] font-medium text-text mb-1.5">
                      비밀번호 확인 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="passwordConfirm" name="passwordConfirm" type="password"
                      value={form.passwordConfirm} onChange={handleChange}
                      placeholder="비밀번호 재입력" className={field}
                    />
                    {errors.passwordConfirm && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.passwordConfirm}</p>
                    )}
                  </div>

                  <label className="flex items-start gap-2.5 cursor-pointer bg-cream rounded-md p-4" style={{ border: '0.5px solid #e5e0d8' }}>
                    <input
                      type="checkbox"
                      checked={agree}
                      onChange={(e) => { setAgree(e.target.checked); setErrors((p) => ({ ...p, agree: undefined })) }}
                      className="w-4 h-4 accent-gold mt-0.5"
                    />
                    <span className="text-[13px] text-text-sub">
                      <span className="text-[#FF4757]">[필수]</span> 개인정보 수집·이용에 동의합니다. (방송·정산 처리 목적)
                    </span>
                  </label>
                  {errors.agree && <p className="text-[12px] text-[#FF4757]">{errors.agree}</p>}

                  {formError && (
                    <p className="text-[13px] text-[#FF4757]" role="alert">{formError}</p>
                  )}

                  <Button
                    type="submit" variant="gold" size="md"
                    label={submitting ? '신청 중…' : '회원가입'}
                    disabled={submitting} className="w-full"
                  />

                  <p className="text-center text-[13px] text-text-sub pt-1">
                    이미 계정이 있으신가요?{' '}
                    <Link to="/host/login" className="text-gold hover:underline">로그인</Link>
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
