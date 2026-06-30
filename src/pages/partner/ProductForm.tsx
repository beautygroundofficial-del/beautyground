import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconUpload, IconToggleRight, IconToggleLeft } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Product } from '../../lib/types'
import { PRODUCT_CATEGORIES } from '../../lib/types'

const inputCls =
  'w-full border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:border-[#b8924a] transition-colors bg-white'

export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState<boolean>(isEdit)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [liveEnabled, setLiveEnabled] = useState(false)

  // 파일 업로드 상태
  const [partnerId, setPartnerId] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // 상품 필드
  const [name, setName] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [salePrice, setSalePrice] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [stock, setStock] = useState<string>('0')
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [status, setStatus] = useState<Product['status']>('on_sale')

  // 파트너 id 미리 가져오기 (업로드 경로에 사용)
  useEffect(() => {
    getMyPartner().then(p => { if (p) setPartnerId(p.id) })
  }, [])

  // 수정 모드: 기존 상품 로드
  useEffect(() => {
    if (!isEdit) return
    let active = true

    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      if (!active || !data) return
      const p = data as Product
      setName(p.name)
      setPrice(String(p.price))
      setSalePrice(p.sale_price != null ? String(p.sale_price) : '')
      setCategory(p.category ?? '')
      setStock(String(p.stock))
      setThumbnailUrl(p.thumbnail_url ?? '')
      setDescription(p.description ?? '')
      setStatus(p.status)
      setLoading(false)
    })

    return () => { active = false }
  }, [id, isEdit])

  // 파일 업로드 처리
  const handleFileUpload = async (file: File) => {
    setUploadError('')

    if (!file.type.startsWith('image/')) {
      setUploadError('이미지 파일만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('이미지는 5MB 이하만 업로드할 수 있습니다.')
      return
    }

    setUploading(true)
    const folder = partnerId || 'temp'
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${folder}/${Date.now()}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(path, file)

    if (uploadErr) {
      setUploadError('업로드에 실패했습니다. 다시 시도해 주세요.')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setThumbnailUrl(data.publicUrl)
    setUploading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('상품명을 입력해 주세요.'); return }
    const priceNum = Number(price)
    if (!price || Number.isNaN(priceNum) || priceNum < 0) { setError('정가를 0 이상 숫자로 입력해 주세요.'); return }
    const stockNum = Number(stock)
    if (Number.isNaN(stockNum) || stockNum < 0) { setError('재고를 0 이상 숫자로 입력해 주세요.'); return }

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
      const { error: err } = await supabase.from('products').update(payload).eq('id', id)
      if (err) { setError(err.message); setSubmitting(false); return }
    } else {
      const partner = await getMyPartner()
      if (!partner) { setError('입점 승인된 파트너만 상품을 등록할 수 있습니다.'); setSubmitting(false); return }
      const { error: err } = await supabase.from('products').insert({ ...payload, partner_id: partner.id })
      if (err) { setError(err.message); setSubmitting(false); return }
    }

    navigate('/partner/products')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
        {/* 좌측: 이미지 + 라이브 특가 */}
        <div className="space-y-4">
          <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
            <h3 className="text-[13px] font-bold text-[#111] mb-4">상품 이미지</h3>

            {/* 숨겨진 파일 인풋 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
                e.target.value = ''
              }}
            />

            {/* 업로드 박스 (클릭 또는 드래그) */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file && !uploading) handleFileUpload(file)
              }}
              className={`w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center mb-3 overflow-hidden transition-colors select-none ${
                uploading
                  ? 'cursor-wait border-[#e5e0d8] bg-[#f7f4ef]'
                  : dragOver
                  ? 'cursor-copy border-[#b8924a] bg-[#fdf9f5]'
                  : thumbnailUrl
                  ? 'cursor-pointer border-[#e5e0d8] bg-[#f7f4ef]'
                  : 'cursor-pointer border-[#e5e0d8] bg-[#f7f4ef] hover:border-[#b8924a] hover:bg-[#fdf9f5]'
              }`}
            >
              {uploading ? (
                <p className="text-[13px] text-[#9a9080]">업로드 중...</p>
              ) : thumbnailUrl ? (
                <img src={thumbnailUrl} alt="썸네일" className="w-full h-full object-cover" />
              ) : (
                <>
                  <IconUpload size={28} className="text-[#d0c9be] mb-2" />
                  <p className="text-[13px] font-medium text-[#9a9080]">클릭 또는 드래그</p>
                  <p className="text-[11px] text-[#bbb] mt-1">대표 이미지 업로드 (5MB 이하)</p>
                </>
              )}
            </div>

            {uploadError && (
              <p className="text-[11px] text-red-500 mb-3">{uploadError}</p>
            )}

            {/* 기존 URL 직접 입력 — 유지 */}
            <label className="block text-[11px] font-semibold text-[#9a9080] mb-1.5">
              또는 이미지 URL 직접 입력
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={e => { setThumbnailUrl(e.target.value); setUploadError('') }}
              placeholder="https://... 이미지 URL"
              className={inputCls}
            />
          </div>

          <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-[#111]">라이브 전용 특가</p>
                <p className="text-[11px] text-[#9a9080] mt-0.5">라이브 예약 시 설정 가능</p>
              </div>
              <button type="button" onClick={() => setLiveEnabled(!liveEnabled)}>
                {liveEnabled
                  ? <IconToggleRight size={30} className="text-[#b8924a]" />
                  : <IconToggleLeft size={30} className="text-[#d0c9be]" />}
              </button>
            </div>
          </div>
        </div>

        {/* 우측: 상품 정보 */}
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 space-y-5">
          <h3 className="text-[13px] font-bold text-[#111]">상품 정보</h3>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">상품명 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="상품명 입력" className={inputCls} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">카테고리</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              <option value="">선택 안 함</option>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#555] mb-1.5">정가 (원) *</label>
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#555] mb-1.5">판매가 (원)</label>
              <input type="number" min={0} value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="선택" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">재고 수량</label>
            <input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className={inputCls} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">판매 상태</label>
            <select value={status} onChange={e => setStatus(e.target.value as Product['status'])} className={inputCls}>
              <option value="on_sale">판매중</option>
              <option value="sold_out">품절</option>
              <option value="hidden">숨김</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">상품 설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              placeholder="상품 설명을 입력하세요"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/partner/products')}
              className="px-6 py-2.5 border border-[#e5e0d8] text-[#555] rounded-lg text-[13px] hover:bg-[#f7f4ef] transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="flex-1 py-2.5 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors"
            >
              {submitting ? '저장 중...' : isEdit ? '수정하기' : '등록하기'}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
