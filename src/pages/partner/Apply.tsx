import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import GNB from '../../components/layout/GNB'
import Footer from '../../components/layout/Footer'
import Button from '../../components/common/Button'
import { supabase } from '../../lib/supabase'
import { PRODUCT_CATEGORIES } from '../../lib/types'

interface FormData {
  brand_name: string
  company_name: string
  biz_number: string
  rep_name: string
  phone: string
  email: string
  category: string
  description: string
  agreed: boolean
}

const GUIDE_ITEMS = [
  '롯데·신세계·현대 백화점 공식 파트너 브랜드에 한해 입점 신청이 가능합니다.',
  '입점 심사는 신청 후 영업일 기준 3~5일 내 완료됩니다.',
  '공식 BA 출연이 필수이며, 사전 교육 후 라이브를 진행합니다.',
]

const INITIAL_FORM: FormData = {
  brand_name: '',
  company_name: '',
  biz_number: '',
  rep_name: '',
  phone: '',
  email: '',
  category: '',
  description: '',
  agreed: false,
}

export default function PartnerApply() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.agreed || submitting) return

    setSubmitting(true)
    setError(null)

    // 로그인 상태면 user_id 자동 포함
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { agreed, ...rest } = form
    void agreed
    const payload = { ...rest, user_id: user?.id ?? null }

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

  const field =
    'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

  return (
    <>
      <GNB />
      <main className="py-16 md:py-24" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="max-w-[760px] mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-gold text-[13px] font-medium tracking-widest uppercase mb-3 block">
              PARTNER APPLY
            </span>
            <h1 className="font-serif text-[32px] md:text-[38px] font-bold text-text">입점 신청</h1>
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
              <div>
                <label htmlFor="brand_name" className="block text-[13px] font-medium text-text mb-1.5">
                  브랜드명 <span className="text-[#FF4757]">*</span>
                </label>
                <input id="brand_name" name="brand_name" type="text" required value={form.brand_name} onChange={handleChange} placeholder="브랜드명을 입력하세요" className={field} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="company_name" className="block text-[13px] font-medium text-text mb-1.5">
                    회사명
                  </label>
                  <input id="company_name" name="company_name" type="text" value={form.company_name} onChange={handleChange} placeholder="(주)뷰티컴퍼니" className={field} />
                </div>
                <div>
                  <label htmlFor="biz_number" className="block text-[13px] font-medium text-text mb-1.5">
                    사업자등록번호
                  </label>
                  <input id="biz_number" name="biz_number" type="text" value={form.biz_number} onChange={handleChange} placeholder="000-00-00000" className={field} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rep_name" className="block text-[13px] font-medium text-text mb-1.5">
                    대표자명
                  </label>
                  <input id="rep_name" name="rep_name" type="text" value={form.rep_name} onChange={handleChange} placeholder="홍길동" className={field} />
                </div>
                <div>
                  <label htmlFor="category" className="block text-[13px] font-medium text-text mb-1.5">
                    주요 상품 카테고리
                  </label>
                  <select id="category" name="category" value={form.category} onChange={handleChange} className={field}>
                    <option value="">카테고리를 선택하세요</option>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-[13px] font-medium text-text mb-1.5">
                    연락처 <span className="text-[#FF4757]">*</span>
                  </label>
                  <input id="phone" name="phone" type="tel" required value={form.phone} onChange={handleChange} placeholder="010-0000-0000" className={field} />
                </div>
                <div>
                  <label htmlFor="email" className="block text-[13px] font-medium text-text mb-1.5">
                    이메일 <span className="text-[#FF4757]">*</span>
                  </label>
                  <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} placeholder="brand@company.com" className={field} />
                </div>
              </div>

              <div>
                <label htmlFor="description" className="block text-[13px] font-medium text-text mb-1.5">
                  브랜드 소개
                </label>
                <textarea id="description" name="description" rows={4} value={form.description} onChange={handleChange} placeholder="브랜드 소개, 주요 상품, 라이브 희망 일정 등을 자유롭게 입력해 주세요" className={`${field} resize-none`} />
              </div>

              <div className="bg-cream rounded-md p-5 border-l-[3px]" style={{ borderLeftColor: '#b8924a' }}>
                <p className="text-[14px] font-semibold text-text mb-1">입점 안내</p>
                <ul className="text-[13px] text-text-sub space-y-1.5">
                  {GUIDE_ITEMS.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="agreed" checked={form.agreed} onChange={handleChange} className="mt-1 w-4 h-4 accent-gold" />
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

              <div className="flex gap-3 pt-2">
                <Button variant="cancel" size="md" label="초기화" onClick={() => setForm(INITIAL_FORM)} disabled={submitting} className="flex-1" />
                <Button type="submit" variant="gold" size="md" label={submitting ? '신청 접수 중…' : '입점 신청하기'} disabled={!form.agreed || submitting} className="flex-1" />
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  )
}
