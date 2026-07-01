import { useState } from 'react'
import { Link } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'
import { supabase } from '../../lib/supabase'
import {
  PRIVACY_CONSENT_TITLE,
  PRIVACY_CONSENT_BODY,
  PARTNER_TERMS_TITLE,
  PARTNER_TERMS_BODY,
} from '../../lib/partnerTerms'

interface FormState {
  brandName: string
  ownerName: string
  bizNumber: string
  email: string
  password: string
  passwordConfirm: string
  phone: string
}

const INITIAL: FormState = {
  brandName: '',
  ownerName: '',
  bizNumber: '',
  email: '',
  password: '',
  passwordConfirm: '',
  phone: '',
}

type FieldErrors = Partial<Record<keyof FormState | 'agree', string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 8자 이상 + 영문 + 숫자 + 특수문자
const PASSWORD_RE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

const field =
  'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

// 약관 전문 모달
function TermsModal({
  title,
  body,
  onClose,
}: {
  title: string
  body: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-white rounded-md w-full max-w-[560px] max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#e5e0d8' }}
        >
          <h3 className="text-[16px] font-bold text-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-text-hint hover:text-text text-[20px] leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">
          <p className="text-[13px] text-text-sub leading-relaxed whitespace-pre-line">
            {body}
          </p>
        </div>
        <div className="px-6 py-4 border-t" style={{ borderColor: '#e5e0d8' }}>
          <Button variant="gold" size="md" label="확인" onClick={onClose} className="w-full" />
        </div>
      </div>
    </div>
  )
}

export default function PartnerRegister() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [modal, setModal] = useState<'privacy' | 'terms' | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const allAgreed = agreePrivacy && agreeTerms

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const toggleAll = (checked: boolean) => {
    setAgreePrivacy(checked)
    setAgreeTerms(checked)
    if (checked) setErrors((prev) => ({ ...prev, agree: undefined }))
  }

  const validate = (): FieldErrors => {
    const e: FieldErrors = {}
    if (!form.brandName.trim()) e.brandName = '브랜드/회사명을 입력하세요.'
    if (!form.ownerName.trim()) e.ownerName = '대표자명을 입력하세요.'
    if (!form.bizNumber.trim()) e.bizNumber = '사업자등록번호를 입력하세요.'
    if (!form.email.trim()) e.email = '이메일을 입력하세요.'
    else if (!EMAIL_RE.test(form.email.trim())) e.email = '올바른 이메일 형식이 아닙니다.'
    if (!form.password) e.password = '비밀번호를 입력하세요.'
    else if (!PASSWORD_RE.test(form.password))
      e.password = '8자 이상, 영문·숫자·특수문자를 모두 포함해야 합니다.'
    if (!form.passwordConfirm) e.passwordConfirm = '비밀번호를 다시 입력하세요.'
    else if (form.password !== form.passwordConfirm)
      e.passwordConfirm = '비밀번호가 일치하지 않습니다.'
    if (!form.phone.trim()) e.phone = '연락처를 입력하세요.'
    if (!allAgreed) e.agree = '필수 약관에 모두 동의해야 합니다.'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setFormError(null)

    const v = validate()
    if (Object.keys(v).length > 0) {
      setErrors(v)
      return
    }
    setErrors({})
    setSubmitting(true)

    const email = form.email.trim()

    // (a) Supabase Auth 계정 생성
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
    })

    if (signUpError) {
      console.error('[partner-register] signUp error:', signUpError)
      const msg = signUpError.message?.toLowerCase() ?? ''
      const already =
        msg.includes('already') || msg.includes('registered') || msg.includes('exists')
      setSubmitting(false)
      setFormError(
        already
          ? '이미 등록된 이메일입니다. 로그인을 이용해 주세요.'
          : `회원가입 중 오류가 발생했습니다. (${signUpError.message})`
      )
      return
    }

    // 이메일 확인이 켜진 경우, 기존 가입 이메일이면 identities 가 빈 배열로 돌아옴
    if (signUpData.user && signUpData.user.identities?.length === 0) {
      setSubmitting(false)
      setFormError('이미 등록된 이메일입니다. 로그인을 이용해 주세요.')
      return
    }

    // (b) partner_applications 신청 레코드 INSERT (실제 컬럼명 기준)
    const payload = {
      brand_name: form.brandName.trim(),
      owner_name: form.ownerName.trim(),
      biz_number: form.bizNumber.trim(),
      email,
      phone: form.phone.trim(),
      status: 'pending',
      user_id: signUpData.user?.id ?? null,
    }

    const { error: insertError } = await supabase
      .from('partner_applications')
      .insert([payload])

    if (insertError) {
      console.error('[partner-register] partner_applications insert error:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code,
      })
      setSubmitting(false)
      setFormError(`입점 신청 저장 중 오류가 발생했습니다. (${insertError.message})`)
      return
    }

    setSubmitting(false)
    setDone(true)
  }

  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[480px] mx-auto px-4 sm:px-6">
          {done ? (
            <div
              className="bg-white rounded-md p-8 md:p-10 text-center border shadow-[0_4px_24px_rgba(0,0,0,0.05)]"
              style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
            >
              <div className="text-5xl mb-5" aria-hidden="true">✅</div>
              <h1 className="font-serif text-[22px] md:text-[26px] font-bold text-text mb-3">
                입점 신청이 접수되었습니다
              </h1>
              <p className="text-[14px] text-text-sub leading-relaxed">
                심사 후 안내드리겠습니다.<br />
                결과는 입력하신 이메일로 전달됩니다.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
                <Link
                  to="/"
                  className="inline-block bg-gold text-white rounded-pill text-[14px] px-6 py-3 font-medium hover:bg-gold-light transition-colors"
                >
                  홈으로
                </Link>
                <Link
                  to="/partner/login"
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
                <p className="text-text-sub text-[14px] mt-2">파트너 회원가입</p>
              </div>

              <form
                onSubmit={handleSubmit}
                noValidate
                className="bg-white rounded-md p-6 md:p-8 border shadow-[0_4px_24px_rgba(0,0,0,0.05)]"
                style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
              >
                <div className="space-y-4">
                  {/* 브랜드/회사명 */}
                  <div>
                    <label htmlFor="brandName" className="block text-[13px] font-medium text-text mb-1.5">
                      브랜드/회사명 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="brandName"
                      name="brandName"
                      type="text"
                      value={form.brandName}
                      onChange={handleChange}
                      placeholder="예: 설화수"
                      className={field}
                    />
                    {errors.brandName && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.brandName}</p>
                    )}
                  </div>

                  {/* 대표자명 */}
                  <div>
                    <label htmlFor="ownerName" className="block text-[13px] font-medium text-text mb-1.5">
                      대표자명 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="ownerName"
                      name="ownerName"
                      type="text"
                      value={form.ownerName}
                      onChange={handleChange}
                      placeholder="홍길동"
                      className={field}
                    />
                    {errors.ownerName && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.ownerName}</p>
                    )}
                  </div>

                  {/* 사업자등록번호 */}
                  <div>
                    <label htmlFor="bizNumber" className="block text-[13px] font-medium text-text mb-1.5">
                      사업자등록번호 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="bizNumber"
                      name="bizNumber"
                      type="text"
                      value={form.bizNumber}
                      onChange={handleChange}
                      placeholder="000-00-00000"
                      className={field}
                    />
                    {errors.bizNumber && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.bizNumber}</p>
                    )}
                  </div>

                  {/* 이메일 */}
                  <div>
                    <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                      이메일 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="example@brand.co.kr"
                      className={field}
                    />
                    {errors.email && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.email}</p>
                    )}
                  </div>

                  {/* 비밀번호 */}
                  <div>
                    <label htmlFor="password" className="block text-[13px] font-medium text-text mb-1.5">
                      비밀번호 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="8자 이상, 영문+숫자+특수문자"
                      className={field}
                    />
                    {errors.password && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.password}</p>
                    )}
                  </div>

                  {/* 비밀번호 확인 */}
                  <div>
                    <label htmlFor="passwordConfirm" className="block text-[13px] font-medium text-text mb-1.5">
                      비밀번호 확인 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="passwordConfirm"
                      name="passwordConfirm"
                      type="password"
                      value={form.passwordConfirm}
                      onChange={handleChange}
                      placeholder="비밀번호 재입력"
                      className={field}
                    />
                    {errors.passwordConfirm && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.passwordConfirm}</p>
                    )}
                  </div>

                  {/* 연락처 */}
                  <div>
                    <label htmlFor="phone" className="block text-[13px] font-medium text-text mb-1.5">
                      연락처 <span className="text-[#FF4757]">*</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="010-0000-0000"
                      className={field}
                    />
                    {errors.phone && (
                      <p className="mt-1 text-[12px] text-[#FF4757]">{errors.phone}</p>
                    )}
                  </div>

                  {/* 약관 동의 */}
                  <div
                    className="bg-cream rounded-md p-4 mt-2 space-y-3"
                    style={{ border: '0.5px solid #e5e0d8' }}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer pb-2 border-b" style={{ borderColor: '#e5e0d8' }}>
                      <input
                        type="checkbox"
                        checked={allAgreed}
                        onChange={(e) => toggleAll(e.target.checked)}
                        className="w-4 h-4 accent-gold"
                      />
                      <span className="text-[13px] font-semibold text-text">전체 동의</span>
                    </label>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreePrivacy}
                          onChange={(e) => {
                            setAgreePrivacy(e.target.checked)
                            setErrors((prev) => ({ ...prev, agree: undefined }))
                          }}
                          className="w-4 h-4 accent-gold"
                        />
                        <span className="text-[13px] text-text-sub">
                          <span className="text-[#FF4757]">[필수]</span> {PRIVACY_CONSENT_TITLE}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setModal('privacy')}
                        className="text-[12px] text-gold hover:underline flex-shrink-0"
                      >
                        전문 보기
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agreeTerms}
                          onChange={(e) => {
                            setAgreeTerms(e.target.checked)
                            setErrors((prev) => ({ ...prev, agree: undefined }))
                          }}
                          className="w-4 h-4 accent-gold"
                        />
                        <span className="text-[13px] text-text-sub">
                          <span className="text-[#FF4757]">[필수]</span> {PARTNER_TERMS_TITLE}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setModal('terms')}
                        className="text-[12px] text-gold hover:underline flex-shrink-0"
                      >
                        전문 보기
                      </button>
                    </div>

                    {errors.agree && (
                      <p className="text-[12px] text-[#FF4757]">{errors.agree}</p>
                    )}
                  </div>

                  {formError && (
                    <p className="text-[13px] text-[#FF4757]" role="alert">
                      {formError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="gold"
                    size="md"
                    label={submitting ? '신청 중…' : '회원가입'}
                    disabled={submitting}
                    className="w-full"
                  />

                  <p className="text-center text-[13px] text-text-sub pt-1">
                    이미 계정이 있으신가요?{' '}
                    <Link to="/partner/login" className="text-gold hover:underline">
                      로그인
                    </Link>
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </main>
      <Footer />

      {modal === 'privacy' && (
        <TermsModal
          title={PRIVACY_CONSENT_TITLE}
          body={PRIVACY_CONSENT_BODY}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'terms' && (
        <TermsModal
          title={PARTNER_TERMS_TITLE}
          body={PARTNER_TERMS_BODY}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
