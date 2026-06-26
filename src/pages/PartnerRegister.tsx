import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GNB from '../components/layout/GNB'
import Footer from '../components/layout/Footer'
import Button from '../components/common/Button'
import { supabase } from '../lib/supabase'

interface FormData {
  brand_name: string
  owner_name: string
  biz_number: string
  email: string
  phone: string
  category: string[]
  message: string
  agreed: boolean
}

const CATEGORIES = ['스킨케어', '메이크업', '향수', '헤어·바디', '이너뷰티', '뷰티 디바이스', '기타']

const GUIDE_ITEMS = [
  '롯데·신세계·현대 백화점 공식 파트너 브랜드에 한해 입점 신청이 가능합니다.',
  '입점 심사는 신청 후 영업일 기준 5~7일 내 완료됩니다.',
  '공식 BA 출연이 필수이며, 사전 교육 후 라이브를 진행합니다.',
]

const INITIAL_FORM: FormData = {
  brand_name: '',
  owner_name: '',
  biz_number: '',
  email: '',
  phone: '',
  category: [],
  message: '',
  agreed: false,
}

export default function PartnerRegister() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const toggleCategory = (value: string) => {
    setForm((prev) => ({
      ...prev,
      category: prev.category.includes(value)
        ? prev.category.filter((c) => c !== value)
        : [...prev.category, value],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.agreed || submitting) return

    setSubmitting(true)
    setError(null)

    // agreed 는 DB 컬럼이 아니므로 제외하고 전송
    const { agreed, ...payload } = form
    void agreed
    const { error: insertError } = await supabase
      .from('partner_applications')
      .insert(payload)

    if (insertError) {
      setSubmitting(false)
      setError('신청 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }

    navigate('/partner/apply/complete')
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

          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white rounded-md p-6 md:p-10 border"
            style={{ borderColor: '#e5e0d8', borderWidth: '0.5px' }}
          >
            <div className="space-y-4">
              {/* 브랜드명 */}
              <div>
                <label htmlFor="brand_name" className="block text-[13px] font-medium text-text mb-1.5">
                  브랜드명 <span className="text-[#FF4757]" aria-label="필수">*</span>
                </label>
                <input
                  id="brand_name"
                  name="brand_name"
                  type="text"
                  placeholder="브랜드명을 입력하세요"
                  value={form.brand_name}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                />
              </div>

              {/* 대표자명 / 사업자등록번호 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="owner_name" className="block text-[13px] font-medium text-text mb-1.5">
                    대표자명 <span className="text-[#FF4757]" aria-label="필수">*</span>
                  </label>
                  <input
                    id="owner_name"
                    name="owner_name"
                    type="text"
                    placeholder="홍길동"
                    value={form.owner_name}
                    onChange={handleChange}
                    required
                    aria-required="true"
                    className="w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition"
                  />
                </div>
                <div>
                  <label htmlFor="biz_number" className="block text-[13px] font-medium text-text mb-1.5">
                    사업자등록번호 <span className="text-[#FF4757]" aria-label="필수">*</span>
                  </label>
                  <input
                    id="biz_number"
                    name="biz_number"
                    type="text"
                    placeholder="000-00-00000"
                    value={form.biz_number}
                    onChange={handleChange}
                    required
                    aria-required="true"
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

              {/* 상품 카테고리 (복수 선택) */}
              <div>
                <span className="block text-[13px] font-medium text-text mb-1.5">
                  주요 상품 카테고리 <span className="text-text-hint font-normal">(복수 선택 가능)</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const selected = form.category.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCategory(c)}
                        aria-pressed={selected}
                        className={[
                          'rounded-pill text-[13px] px-4 py-2 border transition-colors',
                          selected
                            ? 'bg-gold text-white border-gold'
                            : 'bg-white text-text-sub border-cream-2 hover:border-gold',
                        ].join(' ')}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>
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

              {error && (
                <p className="text-[13px] text-[#FF4757]" role="alert">
                  {error}
                </p>
              )}

              {/* 버튼 */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="cancel"
                  size="md"
                  label="초기화"
                  onClick={() => setForm(INITIAL_FORM)}
                  disabled={submitting}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="gold"
                  size="md"
                  label={submitting ? '신청 접수 중…' : '입점 신청하기'}
                  disabled={!form.agreed || submitting}
                  className="flex-1"
                />
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
