import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconCalendar, IconPackage, IconCheck, IconTag } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Live, LiveCoupon } from '../../lib/types'

const inputCls =
  'w-full border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:border-[#b8924a] transition-colors bg-white'

interface ProductOption {
  id: string
  name: string
  thumbnail_url: string | null
  price: number
  sale_price: number | null
}

export default function LiveForm() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [partnerId, setPartnerId] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])

  const [title, setTitle] = useState('')
  const [schedDate, setSchedDate] = useState('')
  const [schedTime, setSchedTime] = useState('')
  const [duration, setDuration] = useState('60')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 라이브 전용 쿠폰 (선택) — live_coupons 1행, live_id 당 1개
  const [couponEnabled, setCouponEnabled] = useState(false)
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount')
  const [discountValue, setDiscountValue] = useState('')
  const [minPurchase, setMinPurchase] = useState('')
  const [qtyLimit, setQtyLimit] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const partner = await getMyPartner()
      if (!active) return
      if (!partner) { setPending(true); setLoading(false); return }
      setPartnerId(partner.id)
      const { data } = await supabase
        .from('products')
        .select('id,name,thumbnail_url,price,sale_price')
        .eq('partner_id', partner.id)
        .eq('status', 'on_sale')
      if (!active) return
      setProducts((data as ProductOption[]) ?? [])

      // 수정 모드: 기존 라이브 로드
      if (isEdit && id) {
        const { data: liveRow } = await supabase.from('lives').select('*').eq('id', id).single()
        if (!active) return
        const lr = liveRow as Live | null
        if (lr) {
          setTitle(lr.title)
          setDescription(lr.description ?? '')
          setThumbnailUrl(lr.thumbnail_url ?? '')
          setSelectedIds(lr.product_ids ?? [])
          if (lr.scheduled_at) {
            const d = new Date(lr.scheduled_at)
            const pad = (n: number) => String(n).padStart(2, '0')
            setSchedDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
            setSchedTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
          }
        }
        const { data: coupon } = await supabase.from('live_coupons').select('*').eq('live_id', id).maybeSingle()
        const cp = coupon as LiveCoupon | null
        if (cp?.active) {
          setCouponEnabled(true)
          setDiscountType(cp.discount_type)
          setDiscountValue(String(cp.discount_value))
          setMinPurchase(String(cp.min_purchase))
          setQtyLimit(cp.qty_limit != null ? String(cp.qty_limit) : '')
        }
      }

      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [id, isEdit])

  const toggleProduct = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')

    if (!title.trim()) { setError('라이브 제목을 입력해 주세요.'); return }
    if (!schedDate || !schedTime) { setError('방송 일시를 입력해 주세요.'); return }
    if (couponEnabled && (!discountValue.trim() || Number(discountValue) <= 0)) {
      setError('쿠폰 할인 금액(또는 할인율)을 입력해 주세요.')
      return
    }

    setSubmitting(true)
    const scheduledAt = new Date(`${schedDate}T${schedTime}:00`).toISOString()
    const fields = {
      title: title.trim(),
      description: description.trim() || null,
      scheduled_at: scheduledAt,
      thumbnail_url: thumbnailUrl || null,
      product_ids: selectedIds,
    }

    let liveId = id
    if (isEdit && id) {
      const { error: err } = await supabase.from('lives').update(fields).eq('id', id)
      if (err) { setError('라이브 저장에 실패했습니다. 다시 시도해 주세요.'); setSubmitting(false); return }
    } else {
      const { data: inserted, error: err } = await supabase
        .from('lives')
        .insert({ ...fields, partner_id: partnerId, status: 'scheduled' })
        .select('id')
        .single()
      if (err || !inserted) { setError('라이브 저장에 실패했습니다. 다시 시도해 주세요.'); setSubmitting(false); return }
      liveId = inserted.id
    }

    // 쿠폰 저장 — 실패해도 라이브 저장 자체는 이미 끝난 상태라 조용히 넘어가지 않고 안내만
    if (liveId) {
      if (couponEnabled) {
        const { error: cErr } = await supabase.from('live_coupons').upsert(
          {
            live_id: liveId,
            discount_type: discountType,
            discount_value: Number(discountValue),
            min_purchase: Number(minPurchase) || 0,
            qty_limit: Number(qtyLimit) > 0 ? Number(qtyLimit) : null,
            active: true,
          },
          { onConflict: 'live_id' }
        )
        if (cErr) { setError(`라이브는 저장됐지만 쿠폰 저장에 실패했습니다: ${cErr.message}`); setSubmitting(false); return }
      } else {
        await supabase.from('live_coupons').update({ active: false }).eq('live_id', liveId)
      }
    }

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
      {/* 방송 기본 정보 */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 space-y-5">
        <h3 className="text-[14px] font-bold text-[#111]">방송 기본 정보</h3>

        <div>
          <label className="block text-[12px] font-semibold text-[#555] mb-1.5">방송 제목 *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder='예: "브랜드와 함께하는 스킨케어 특집"'
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#555] mb-1.5">
              <IconCalendar size={13} />방송 예정일 *
            </label>
            <input
              type="date"
              value={schedDate}
              onChange={e => setSchedDate(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">방송 예정 시간 *</label>
            <input
              type="time"
              value={schedTime}
              onChange={e => setSchedTime(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#555] mb-1.5">예상 방송 시간</label>
          <select value={duration} onChange={e => setDuration(e.target.value)} className={inputCls}>
            <option value="30">30분</option>
            <option value="60">1시간</option>
            <option value="90">1시간 30분</option>
            <option value="120">2시간</option>
            <option value="180">3시간</option>
          </select>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-[#555] mb-1.5">방송 설명</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="방송 내용을 간략히 소개해주세요"
            className={`${inputCls} resize-none`}
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

      {/* 판매 상품 */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-[#111] mb-4">
          <IconPackage size={14} />판매 상품 선택
        </h3>

        {products.length === 0 ? (
          <p className="text-[13px] text-[#9a9080]">
            먼저 상품을 등록해 주세요.{' '}
            <Link to="/partner/products/new" className="text-[#b8924a] font-medium hover:underline">
              상품 등록하기
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {products.map(product => {
              const selected = selectedIds.includes(product.id)
              const displayPrice = product.sale_price ?? product.price
              return (
                <div
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                    selected ? 'border-[#b8924a] bg-[#fdf8f0]' : 'border-[#e5e0d8] hover:border-[#b8924a]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                    selected ? 'bg-[#b8924a] border-[#b8924a]' : 'border-[#e5e0d8]'
                  }`}>
                    {selected && <IconCheck size={12} color="white" />}
                  </div>
                  <div className="w-12 h-12 bg-[#f7f4ef] rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {product.thumbnail_url
                      ? <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
                      : <span className="text-[10px] text-[#bbb]">이미지</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] truncate">{product.name}</p>
                    <p className="text-[12px] text-[#9a9080]">{displayPrice.toLocaleString()}원</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {selectedIds.length > 0 && (
          <p className="text-[12px] text-[#b8924a] mt-3">{selectedIds.length}개 상품 선택됨</p>
        )}
      </div>

      {/* 라이브 전용 쿠폰 */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-1.5 text-[14px] font-bold text-[#111]">
            <IconTag size={14} />라이브 전용 쿠폰 (선택)
          </span>
          <input
            type="checkbox"
            checked={couponEnabled}
            onChange={e => setCouponEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#b8924a]"
          />
        </label>

        {couponEnabled && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('amount')}
                className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                  discountType === 'amount' ? 'border-[#b8924a] bg-[#fdf8f0] text-[#b8924a]' : 'border-[#e5e0d8] text-[#9a9080]'
                }`}
              >
                금액 할인
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                  discountType === 'percent' ? 'border-[#b8924a] bg-[#fdf8f0] text-[#b8924a]' : 'border-[#e5e0d8] text-[#9a9080]'
                }`}
              >
                퍼센트 할인
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#555] mb-1.5">
                  {discountType === 'percent' ? '할인율 (%)' : '할인 금액 (원)'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percent' ? '예: 10' : '예: 5000'}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#555] mb-1.5">최소 구매 금액 (원)</label>
                <input
                  type="number"
                  min={0}
                  value={minPurchase}
                  onChange={e => setMinPurchase(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#555] mb-1.5">수량 제한</label>
              <input
                type="number"
                min={0}
                value={qtyLimit}
                onChange={e => setQtyLimit(e.target.value)}
                placeholder="0 (무제한)"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-[#9a9080]">방송 중 이 조건을 만족하는 주문에 결제 직전 자동 적용됩니다.</p>
          </>
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
          {submitting ? '저장 중...' : isEdit ? '라이브 수정' : '라이브 예약'}
        </button>
      </div>
    </form>
  )
}
