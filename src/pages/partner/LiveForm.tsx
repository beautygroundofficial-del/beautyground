import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconCalendar, IconPackage } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'

const inputCls =
  'w-full border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:border-[#b8924a] transition-colors bg-white'

interface ProductOption {
  id: string
  name: string
}

export default function LiveForm() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])

  const [title, setTitle] = useState('')
  const [scheduledLocal, setScheduledLocal] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const partner = await getMyPartner()
      if (!active) return
      if (!partner) { setPending(true); setLoading(false); return }

      setPartnerId(partner.id)
      const { data } = await supabase.from('products').select('id,name').eq('partner_id', partner.id)
      if (!active) return
      setProducts((data as ProductOption[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')

    if (!title.trim()) { setError('라이브 제목을 입력해 주세요.'); return }
    if (!scheduledLocal) { setError('방송 일시를 입력해 주세요.'); return }

    setSubmitting(true)
    const { error: err } = await supabase.from('lives').insert({
      partner_id: partnerId,
      title: title.trim(),
      scheduled_at: new Date(scheduledLocal).toISOString(),
      thumbnail_url: thumbnailUrl || null,
      product_ids: selectedIds,
      status: 'scheduled',
    })

    if (err) { setError('라이브 저장에 실패했습니다. 다시 시도해 주세요.'); setSubmitting(false); return }
    navigate('/partner/live')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (pending) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-2">입점 승인 대기 중입니다</p>
        <p className="text-[14px] text-[#9a9080]">승인이 완료되면 라이브를 예약할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 space-y-5">
        <h3 className="text-[13px] font-bold text-[#111]">기본 정보</h3>

        <div>
          <label className="block text-[12px] font-semibold text-[#555] mb-1.5">라이브 제목 *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="라이브 제목을 입력하세요"
            className={inputCls}
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#555] mb-1.5">
            <IconCalendar size={13} />방송 일시 *
          </label>
          <input
            type="datetime-local"
            value={scheduledLocal}
            onChange={e => setScheduledLocal(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#555] mb-1.5">썸네일 URL</label>
          <input
            type="text"
            value={thumbnailUrl}
            onChange={e => setThumbnailUrl(e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
          {thumbnailUrl && (
            <img src={thumbnailUrl} alt="썸네일" className="mt-2 w-40 h-24 object-cover rounded-lg border border-[#e5e0d8]" />
          )}
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-[#111] mb-4">
          <IconPackage size={14} />판매 상품
        </h3>

        {products.length === 0 ? (
          <p className="text-[13px] text-[#9a9080]">
            먼저 상품을 등록해 주세요.{' '}
            <Link to="/partner/products/new" className="text-[#b8924a] font-medium hover:underline">
              상품 등록하기
            </Link>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {products.map(product => {
              const selected = selectedIds.includes(product.id)
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product.id)}
                  className={`px-3.5 py-2 rounded-lg text-[13px] border transition-colors ${
                    selected
                      ? 'bg-[#b8924a] border-[#b8924a] text-white font-medium'
                      : 'bg-white border-[#e5e0d8] text-[#555] hover:border-[#b8924a]'
                  }`}
                >
                  {selected ? '✓ ' : ''}{product.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/partner/live')}
          className="px-6 py-2.5 border border-[#e5e0d8] text-[#555] rounded-lg text-[13px] hover:bg-[#f7f4ef] transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors"
        >
          {submitting ? '저장 중...' : '라이브 예약'}
        </button>
      </div>
    </form>
  )
}
