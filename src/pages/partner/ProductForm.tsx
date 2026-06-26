import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Product } from '../../lib/types'
import { PRODUCT_CATEGORIES } from '../../lib/types'
import Button from '../../components/common/Button'

const cardStyle = { borderColor: '#e5e0d8', borderWidth: '0.5px' }

const inputClass =
  'w-full bg-white border border-cream-2 rounded-md px-4 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

type Status = Product['status']

export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [loading, setLoading] = useState<boolean>(isEdit)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const [name, setName] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [salePrice, setSalePrice] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [stock, setStock] = useState<string>('0')
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [status, setStatus] = useState<Status>('on_sale')

  useEffect(() => {
    if (!isEdit) return
    let active = true

    const load = async () => {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      if (!active) return

      if (data) {
        const product = data as Product
        setName(product.name)
        setPrice(String(product.price))
        setSalePrice(product.sale_price != null ? String(product.sale_price) : '')
        setCategory(product.category ?? '')
        setStock(String(product.stock))
        setThumbnailUrl(product.thumbnail_url ?? '')
        setDescription(product.description ?? '')
        setStatus(product.status)
      }
      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [id, isEdit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('상품명을 입력해 주세요.')
      return
    }
    const priceNum = Number(price)
    if (!price || Number.isNaN(priceNum) || priceNum < 0) {
      setError('정가를 0 이상 숫자로 입력해 주세요.')
      return
    }
    const stockNum = Number(stock)
    if (Number.isNaN(stockNum) || stockNum < 0) {
      setError('재고를 0 이상 숫자로 입력해 주세요.')
      return
    }

    const payload = {
      name: name.trim(),
      price: priceNum,
      sale_price: salePrice ? Number(salePrice) : null,
      category: category || null,
      thumbnail_url: thumbnailUrl || null,
      description: description || null,
      stock: stockNum,
      status,
    }

    setSubmitting(true)

    if (isEdit) {
      const { error: updateError } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)

      if (updateError) {
        setError(updateError.message)
        setSubmitting(false)
        return
      }
    } else {
      const partner = await getMyPartner()
      if (!partner) {
        setError('입점 승인된 파트너만 상품을 등록할 수 있습니다.')
        setSubmitting(false)
        return
      }

      const { error: insertError } = await supabase
        .from('products')
        .insert({ ...payload, partner_id: partner.id })

      if (insertError) {
        setError(insertError.message)
        setSubmitting(false)
        return
      }
    }

    navigate('/partner/products')
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold text-text mb-6">
        {isEdit ? '상품 수정' : '상품 등록'}
      </h1>

      {loading ? (
        <div
          className="bg-white rounded-md border p-8 text-center text-[14px] text-text-sub max-w-[640px]"
          style={cardStyle}
        >
          불러오는 중…
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-md border p-6 space-y-4 max-w-[640px]"
          style={cardStyle}
        >
          <div>
            <label className="block text-[13px] font-medium text-text mb-2">
              상품명 <span className="text-gold">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="상품명을 입력하세요"
              className={inputClass}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-text mb-2">
                정가 <span className="text-gold">*</span>
              </label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-text mb-2">
                판매가
              </label>
              <input
                type="number"
                min={0}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="할인가 (선택)"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-text mb-2">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">선택 안 함</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-text mb-2">
                재고
              </label>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
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

          <div>
            <label className="block text-[13px] font-medium text-text mb-2">
              상품 설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="상품 설명을 입력하세요"
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-text mb-2">
              판매 상태
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className={inputClass}
            >
              <option value="on_sale">판매중</option>
              <option value="sold_out">품절</option>
              <option value="hidden">숨김</option>
            </select>
          </div>

          {error && (
            <p className="text-[13px] text-red-500 bg-red-50 rounded-md px-4 py-3">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="gold"
              size="md"
              label={submitting ? '저장 중…' : '저장'}
              disabled={submitting}
            />
            <Button
              type="button"
              variant="cancel"
              size="md"
              label="취소"
              onClick={() => navigate('/partner/products')}
            />
          </div>
        </form>
      )}
    </div>
  )
}
