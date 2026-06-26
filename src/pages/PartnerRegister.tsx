import { useState } from 'react'
import { Link } from 'react-router-dom'
import GNB from '../components/layout/GNB'
import Footer from '../components/layout/Footer'
import Button from '../components/common/Button'

interface FormData {
  department: string
  brand: string
  name: string
  position: string
  phone: string
  email: string
  category: string
  message: string
  agreed: boolean
}

const DEPARTMENTS = ['롯데백화점', '신세계백화점', '현대백화점', '갤러리아', 'AK플라자', '기타']

const CATEGORIES = ['스킨케어', '메이크업', '향수', '헤어·바디', '이너뷰티', '뷰티 디바이스', '기타']

const GUIDE_ITEMS = [
  '롯데·신세계·현대 백화점 공식 파트너 브랜드에 한해 입점 신청이 가능합니다.',
  '입점 심사는 신청 후 영업일 기준 5~7일 내 완료됩니다.',
  '공식 BA 출연이 필수이며, 사전 교육 후 라이브를 진행합니다.',
]

const INITIAL_FORM: FormData = {
  department: '',
  brand: '',
  name: '',
  position: '',
  phone: '',
  email: '',
  category: '',
  message: '',
  agreed: false,
}

export default function PartnerRegister() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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

  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[760px] mx-auto px-6">
          {/* 헤더 */}
          <div className="text-center mb-12">
            <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
              PARTNER REGISTER
            </span>
            <h1 className="font-serif text-[32px] md:text-[38px] font-bold text-text">
              입점 신청
            </h1>
            <p className="text-text-sub text-[15px] mt-3">
              브랜드 정보를 등록하고 뷰티그라운드 입점 심사를 신청하세요
            </p>
          </div>

          {submitted ? (
            <div className="bg-white rounded-md p-10 text-center border" style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}>
              <div className="text-5xl mb-4" aria-hidden="true">✅</div>
              <p className="text-[18px] font-bold text-text mb-1">입점 신청이 접수되었습니다</p>
              <p className="text-[14px] text-text-sub">
                담당자가 영업일 기준 5~7일 내 심사 결과를 안내드립니다.
              </p>
              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={() => {
                    setForm(INITIAL_FORM)
                    setSubmitted(false)
                  }}
                  className="text-gold text-[14px] hover:underline"
                >
                  다시 신청하기
                </button>
                <span className="text-cream-2" aria-hidden="true">|</span>
                <Link to="/" className="text-text-sub text-[14px] hover:underline">
                  홈으로
                </Link>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white rounded-md p-6 md:p-10 border"
              style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
            >
              <div className="space-y-4">
                {/* 백화점 */}
                <div>
                  <label htmlFor="department" className="block text-[13px] font-medium text-text mb-1.5">
                    백화점 <span className="text-[#FF4757]" aria-label="필수">*</span>
                  </label>
                  <select
                    id="department"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    required
                    aria-required="true"
                    className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text focus:outline-none focus:shadow-focus transition"
                  >
                    <option value="" disabled>
                      소속 백화점을 선택하세요
                    </option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 브랜드명 */}
                <div>
                  <label htmlFor="brand" className="block text-[13px] font-medium text-text mb-1.5">
                    브랜드명 <span className="text-[#FF4757]" aria-label="필수">*</span>
                  </label>
                  <input
                    id="brand"
                    name="brand"
                    type="text"
                    placeholder="브랜드명을 입력하세요"
                    value={form.brand}
                    onChange={handleChange}
                    required
                    aria-required="true"
                    className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                  />
                </div>

                {/* 담당자명 / 직책 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-[13px] font-medium text-text mb-1.5">
                      담당자명 <span className="text-[#FF4757]" aria-label="필수">*</span>
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="홍길동"
                      value={form.name}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="position" className="block text-[13px] font-medium text-text mb-1.5">
                      직책
                    </label>
                    <input
                      id="position"
                      name="position"
                      type="text"
                      placeholder="브랜드 매니저"
                      value={form.position}
                      onChange={handleChange}
                      className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                    />
                  </div>
                </div>

                {/* 연락처 / 이메일 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-[13px] font-medium text-text mb-1.5">
                      연락처 <span className="text-[#FF4757]" aria-label="필수">*</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="010-0000-0000"
                      value={form.phone}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                      이메일 <span className="text-[#FF4757]" aria-label="필수">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="brand@company.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                      aria-required="true"
                      className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                    />
                  </div>
                </div>

                {/* 상품 카테고리 */}
                <div>
                  <label htmlFor="category" className="block text-[13px] font-medium text-text mb-1.5">
                    주요 상품 카테고리 <span className="text-[#FF4757]" aria-label="필수">*</span>
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                    aria-required="true"
                    className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text focus:outline-none focus:shadow-focus transition"
                  >
                    <option value="" disabled>
                      카테고리를 선택하세요
                    </option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 추가 안내사항 */}
                <div>
                  <label htmlFor="message" className="block text-[13px] font-medium text-text mb-1.5">
                    추가 안내사항
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="브랜드 소개, 주요 상품, 라이브 희망 일정 등을 자유롭게 입력해 주세요"
                    value={form.message}
                    onChange={handleChange}
                    className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition resize-none"
                  />
                </div>

                {/* 입점 안내 박스 */}
                <div
                  className="bg-cream rounded-md p-5 border-l-[3px]"
                  style={{ borderLeftColor: '#b8924a' }}
                >
                  <p className="text-[14px] font-semibold text-text mb-1">입점 안내</p>
                  <ul className="text-[13px] text-text-sub space-y-1.5">
                    {GUIDE_ITEMS.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                {/* 동의 */}
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
                    <Link to="/privacy" className="text-gold hover:underline">
                      개인정보처리방침
                    </Link>
                  </span>
                </label>

                {/* 버튼 */}
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="cancel"
                    size="md"
                    label="초기화"
                    onClick={() => setForm(INITIAL_FORM)}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    variant="gold"
                    size="md"
                    label="입점 신청하기"
                    disabled={!form.agreed}
                    className="flex-1"
                  />
                </div>
              </div>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
