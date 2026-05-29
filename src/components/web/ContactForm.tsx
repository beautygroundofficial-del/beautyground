import { useState } from 'react'
import Button from '../common/Button'

interface FormData {
  company: string
  name: string
  phone: string
  email: string
  message: string
  agreed: boolean
}

const PROCESS_STEPS = [
  '문의 접수',
  '담당자 확인 (1~2일)',
  '미팅 일정 조율',
  '제안서 발송',
  '계약 체결',
]

const CHECK_ITEMS = [
  '광고 캠페인 집행',
  '브랜드 협찬 및 PPL',
  '공동 마케팅 제안',
  '데이터 파트너십',
]

export default function ContactForm() {
  const [form, setForm] = useState<FormData>({
    company: '',
    name: '',
    phone: '',
    email: '',
    message: '',
    agreed: false,
  })
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.agreed) return
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-cream rounded-md p-8 text-center">
        <div className="text-4xl mb-3" aria-hidden="true">✅</div>
        <p className="text-[16px] font-bold text-text mb-1">문의가 접수되었습니다</p>
        <p className="text-[13px] text-text-sub">담당자가 1~2 영업일 내 연락드립니다.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="text-gold text-[13px] mt-4 hover:underline"
        >
          다시 문의하기
        </button>
      </div>
    )
  }

  return (
    <section className="py-20 md:py-28" id="partnership" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-14">
          <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
            PARTNERSHIP
          </span>
          <h2 className="font-serif text-[32px] md:text-[38px] font-bold text-text">
            광고 · 제휴 문의
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
          {/* 좌측: 체크리스트 + 진행과정 */}
          <div>
            <h3 className="text-[18px] font-bold text-text mb-4">협력 분야</h3>
            <div className="space-y-3 mb-8">
              {CHECK_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-[12px]" aria-hidden="true">
                    ✓
                  </span>
                  <span className="text-[14px] text-text">{item}</span>
                </div>
              ))}
            </div>

            <h3 className="text-[18px] font-bold text-text mb-4">진행 과정</h3>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-cream-2" aria-hidden="true" />
              <div className="space-y-4">
                {PROCESS_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-4 relative z-10">
                    <div className="w-7 h-7 rounded-full bg-gold text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    <span className="text-[14px] text-text">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 우측: 폼 */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {[
                { name: 'company', label: '회사명', placeholder: '(주)뷰티컴퍼니', type: 'text', required: true },
                { name: 'name', label: '담당자명', placeholder: '홍길동', type: 'text', required: true },
                { name: 'phone', label: '연락처', placeholder: '010-0000-0000', type: 'tel', required: true },
                { name: 'email', label: '이메일', placeholder: 'beauty@company.com', type: 'email', required: true },
              ].map(({ name, label, placeholder, type, required }) => (
                <div key={name}>
                  <label htmlFor={name} className="block text-[13px] font-medium text-text mb-1.5">
                    {label} {required && <span className="text-[#FF4757]" aria-label="필수">*</span>}
                  </label>
                  <input
                    id={name}
                    name={name}
                    type={type}
                    placeholder={placeholder}
                    value={form[name as keyof Omit<FormData, 'agreed' | 'message'>]}
                    onChange={handleChange}
                    required={required}
                    className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                    aria-required={required}
                  />
                </div>
              ))}
              <div>
                <label htmlFor="message" className="block text-[13px] font-medium text-text mb-1.5">
                  문의내용 <span className="text-[#FF4757]" aria-label="필수">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="문의하실 내용을 입력해 주세요"
                  value={form.message}
                  onChange={handleChange}
                  required
                  className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition resize-none"
                  aria-required="true"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="agreed"
                  checked={form.agreed}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 accent-gold"
                  aria-required="true"
                />
                <span className="text-[13px] text-text-sub">
                  개인정보 수집 및 이용에 동의합니다.{' '}
                  <a href="/privacy" className="text-gold hover:underline">
                    개인정보처리방침
                  </a>
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="cancel"
                  size="md"
                  label="닫기"
                  onClick={() => setForm({ company: '', name: '', phone: '', email: '', message: '', agreed: false })}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="gold"
                  size="md"
                  label="보내기"
                  disabled={!form.agreed}
                  className="flex-1"
                />
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
