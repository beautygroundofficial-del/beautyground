import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import Button from '../../components/common/Button'

const cardStyle = { borderColor: '#e5e0d8', borderWidth: '0.5px' }
const inputClass =
  'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

interface ProductOption {
  id: string
  name: string
}

export default function LiveForm() {
  const navigate = useNavigate()

  const [loading, setLoading] = useState<boolean>(true)
  const [pending, setPending] = useState<boolean>(false)
  const [partnerId, setPartnerId] = useState<string>('')
  const [products, setProducts] = useState<ProductOption[]>([])

  const [title, setTitle] = useState<string>('')
  const [scheduledLocal, setScheduledLocal] = useState<string>('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let active = true

    const load = async () => {
      const partner = await getMyPartner()
      if (!active) return

      if (!partner) {
        setPending(true)
        setLoading(false)
        return
      }

      setPartnerId(partner.id)

      const { data } = await supabase
        .from('products')
        .select('id,name')
        .eq('partner_id', partner.id)

      if (!active) return
      setProducts((data as ProductOption[]) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [])

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setError('')
    setSubmitting(true)

    const payload = {
      partner_id: partnerId,
      title,
      scheduled_at: new Date(scheduledLocal).toISOString(),
      thumbnail_url: thumbnailUrl || null,
      product_ids: selectedIds,
      status: 'scheduled' as const,
    }

    const { error: insertError } = await supabase.from('lives').insert(payload)

    if (insertError) {
      setError('라이브 저장에 실패했습니다. 다시 시도해 주세요.')
      setSubmitting(false)
      return
    }

    navigate('/partner/live')
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold text-text mb-6">라이브 예약</h1>

      {pending ? (
        <div
          className="bg-white rounded-md border p-8 text-center"
          style={cardStyle}
        >
          <p className="text-[15px] font-medium text-text">
            입점 승인 대기 중입니다
          </p>
          <p className="text-[13px] text-text-sub mt-2">
            승인이 완료되면 라이브를 예약할 수 있습니다.
          </p>
        </div>
      ) : loading ? (
        <div
          className="bg-white rounded-md border p-8 text-center text-[14px] text-text-sub"
          style={cardStyle}
        >
          불러오는 중…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-md border p-6 space-y-5" style={cardStyle}>
            <div>
              <label className="block text-[13px] font-medium text-text mb-2">
                라이브 제목 <span className="text-gold">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="라이브 제목을 입력하세요"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text mb-2">
                방송 일시 <span className="text-gold">*</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-text mb-2">
                썸네일 URL
              </label>
              <input
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://…"
                className={inputClass}
              />
            </div>
          </div>

          <div className="bg-white rounded-md border p-6" style={cardStyle}>
            <label className="block text-[13px] font-medium text-text mb-3">
              판매 상품
            </label>

            {products.length === 0 ? (
              <p className="text-[13px] text-text-sub">
                먼저 상품을 등록해 주세요{' '}
                <Link
                  to="/partner/products/new"
                  className="text-gold font-medium hover:underline"
                >
                  상품 등록하기
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {products.map((product) => {
                  const active = selectedIds.includes(product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      className={`inline-block px-3 py-2 rounded-pill text-[13px] border transition ${
                        active
                          ? 'bg-gold/10 border-gold text-gold font-medium'
                          : 'bg-white border-cream-2 text-text-sub hover:border-gold'
                      }`}
                    >
                      {active ? '✓ ' : ''}
                      {product.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="text-[13px] text-red-600 font-medium">{error}</p>
          )}

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="gold"
              size="md"
              label={submitting ? '저장 중…' : '라이브 예약'}
              disabled={submitting}
            />
            <Button
              type="button"
              variant="cancel"
              size="md"
              label="취소"
              onClick={() => navigate('/partner/live')}
              disabled={submitting}
            />
          </div>
        </form>
      )}
    </div>
  )
}
