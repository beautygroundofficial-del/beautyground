import { useEffect, useState } from 'react'
import { IconLink, IconPhoto, IconTrash } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner, Product } from '../../lib/types'

// 브랜드 셀러센터 — 상품 등록 (2026-09-02)
// 브랜드가 자사몰 상품 URL 을 붙여넣으면 /api/scrape-product 가 이름·가격·이미지를 긁어오고,
// 확인 후 저장하면 같은 API 의 저장 모드가 등록한다(partner_id 는 서버가 토큰으로 강제).
// 등록분은 status='hidden' 으로 들어가며 뷰티그라운드 확인 후 판매중으로 전환된다.

const CATEGORIES = ['스킨케어', '메이크업', '향수', '헤어·바디', '이너뷰티', '뷰티 디바이스', '기타']

interface Draft {
  name: string
  price: number | ''
  sale_price: number | ''
  category: string
  description: string
  thumbnail_url: string | null
  images: string[]
  detail_images: string[]
  source_url: string
  stock: number | ''
  // 상품정보고시(화장품 표시기재) — 전부 선택 입력. 정확한 법정 필수항목은 브랜드·법무 확인 필요.
  capacity_weight: string
  ingredients: string
  expiry_info: string
  usage_method: string
  manufacturer: string
  responsible_seller: string
  precautions: string
  quality_standard: string
}

const emptyDraft: Draft = {
  name: '', price: '', sale_price: '', category: '', description: '',
  thumbnail_url: null, images: [], detail_images: [], source_url: '', stock: 10,
  capacity_weight: '', ingredients: '', expiry_info: '', usage_method: '',
  manufacturer: '', responsible_seller: '', precautions: '', quality_standard: '',
}

function draftFromProduct(p: Product): Draft {
  return {
    name: p.name, price: p.price, sale_price: p.sale_price ?? '', category: p.category ?? '',
    description: p.description ?? '', thumbnail_url: p.thumbnail_url,
    images: p.gallery_images ?? [], detail_images: p.detail_images ?? [],
    source_url: p.source_url ?? '', stock: p.stock,
    capacity_weight: p.capacity_weight ?? '', ingredients: p.ingredients ?? '',
    expiry_info: p.expiry_info ?? '', usage_method: p.usage_method ?? '',
    manufacturer: p.manufacturer ?? '', responsible_seller: p.responsible_seller ?? '',
    precautions: p.precautions ?? '', quality_standard: p.quality_standard ?? '',
  }
}

const card = 'bg-white rounded-[14px] border border-[#e5e0d8]'
const field =
  'w-full bg-white border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[14px] text-[#111] placeholder:text-[#c3bcae] focus:outline-none focus:border-[#b8924a] transition'
const labelCls = 'block text-[12px] font-semibold text-[#6b6355] mb-1.5'

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  on_sale: { text: '판매중', cls: 'bg-[#eaf3ec] text-[#2f7d5b]' },
  hidden: { text: '확인 대기', cls: 'bg-[#f6eedf] text-[#8a5b0e]' },
  sold_out: { text: '품절', cls: 'bg-[#f3f1ed] text-[#9a9080]' },
}

export default function BrandProducts() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Product[]>([])

  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null) // null=신규등록, 있으면 그 상품 수정
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')
  // 재고 인라인 수정 — product id별 입력 중인 값. update_my_product_stock RPC(brand_stock_update.sql)로
  // 본인 partner_id 상품만 수정 가능하게 서버(Postgres)에서 강제한다.
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({})
  const [stockSaving, setStockSaving] = useState<string | null>(null)

  const loadItems = async (partnerId: string) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false })
    setItems((data ?? []) as Product[])
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getMyPartner()
      if (!active) return
      setPartner(p)
      if (p) await loadItems(p.id)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  // URL → 상품 정보 가져오기
  const fetchFromUrl = async () => {
    const u = url.trim()
    if (!u) { setMsg('상품 페이지 주소를 입력해 주세요.'); return }
    setFetching(true); setMsg(''); setOk('')
    try {
      const r = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: u }),
      })
      const json = await r.json()
      if (!json?.ok) {
        setMsg(json?.error || '상품 정보를 가져오지 못했습니다. 직접 입력해 주세요.')
        setEditingId(null)
        setDraft({ ...emptyDraft, source_url: u })
        return
      }
      const d = json.data as Partial<Draft> & { images?: string[]; detail_images?: string[] }
      setEditingId(null)
      setDraft({
        ...emptyDraft,
        name: d.name ?? '',
        price: typeof d.price === 'number' ? d.price : '',
        sale_price: typeof d.sale_price === 'number' ? d.sale_price : '',
        category: '',
        description: d.description ?? '',
        thumbnail_url: d.thumbnail_url ?? null,
        images: d.images ?? [],
        detail_images: d.detail_images ?? [],
        source_url: u,
        stock: 10,
      })
    } catch {
      setMsg('가져오기에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setFetching(false)
    }
  }

  const save = async () => {
    if (!draft) return
    if (!draft.name.trim()) { setMsg('상품명을 입력해 주세요.'); return }
    if (!draft.price || Number(draft.price) <= 0) { setMsg('판매가를 입력해 주세요.'); return }
    if (!draft.category) { setMsg('카테고리를 선택해 주세요.'); return }
    setSaving(true); setMsg(''); setOk('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMsg('로그인이 만료되었습니다. 다시 로그인해 주세요.'); return }
      const r = await fetch('/api/scrape-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: 'save', product: draft, product_id: editingId ?? undefined }),
      })
      const json = await r.json()
      if (!json?.ok) { setMsg(json?.error || (editingId ? '수정에 실패했습니다.' : '등록에 실패했습니다.')); return }
      setOk(editingId ? '수정되었습니다.' : '등록되었습니다. 뷰티그라운드 확인 후 판매가 시작됩니다.')
      setDraft(null); setUrl(''); setEditingId(null)
      if (partner) await loadItems(partner.id)
    } catch {
      setMsg('등록 요청에 실패했습니다. 네트워크를 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  const saveStock = async (productId: string) => {
    const raw = stockEdits[productId]
    if (raw === undefined) return
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) { setMsg('재고는 0 이상의 숫자로 입력해 주세요.'); return }
    setStockSaving(productId); setMsg('')
    try {
      const { error } = await supabase.rpc('update_my_product_stock', { p_product_id: productId, p_stock: n })
      if (error) { setMsg(error.message); return }
      setItems((prev) => prev.map((it) => (it.id === productId ? { ...it, stock: n } : it)))
      setStockEdits((prev) => { const n2 = { ...prev }; delete n2[productId]; return n2 })
    } catch {
      setMsg('재고 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setStockSaving(null)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><p className="text-[14px] text-[#9a9080]">불러오는 중...</p></div>
  }

  if (!partner) {
    return (
      <div className={`max-w-md mx-auto mt-16 ${card} p-10 text-center`}>
        <p className="text-[16px] font-semibold text-[#111] mb-2">브랜드 계정을 찾을 수 없습니다</p>
        <p className="text-[14px] text-[#9a9080]">뷰티그라운드 담당자에게 문의해 주세요.</p>
      </div>
    )
  }

  return (
    <>
      {/* 등록/수정 */}
      <div className={`${card} p-6 mb-6`}>
        <h2 className="text-[15px] font-bold text-[#111] mb-1">{editingId ? '상품 수정' : '상품 등록'}</h2>

        {!editingId && (
          <>
            <p className="text-[12.5px] text-[#9a9080] mb-4 leading-relaxed">
              자사몰 상품 페이지 주소를 붙여넣으면 상품명·가격·사진을 자동으로 가져옵니다.
              가져온 내용을 확인하고 수정한 뒤 등록해 주세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-1">
              <div className="relative flex-1">
                <IconLink size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c3bcae]" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void fetchFromUrl() }}
                  placeholder="https://브랜드몰.com/product/..."
                  className={`${field} pl-9`}
                />
              </div>
              <button
                onClick={() => void fetchFromUrl()}
                disabled={fetching}
                className="shrink-0 rounded-lg bg-[#111] text-white font-semibold text-[14px] px-6 py-2.5 disabled:opacity-50 transition"
              >
                {fetching ? '가져오는 중…' : '가져오기'}
              </button>
            </div>
            <p className="text-[11.5px] text-[#b3aa9a]">
              카페24·자체 쇼핑몰은 대부분 자동으로 읽힙니다. 스마트스토어처럼 읽히지 않는 곳은 아래에서 직접 입력하시면 됩니다.
            </p>
          </>
        )}

        {msg && <p className="mt-3 text-[13px] text-[#a32118]">{msg}</p>}
        {ok && <p className="mt-3 text-[13px] text-[#2f7d5b]">{ok}</p>}

        {draft && (
          <div className="mt-6 pt-6 border-t border-[#efeae1] grid gap-4 lg:grid-cols-[200px_1fr]">
            {/* 이미지 미리보기 */}
            <div>
              <div className="aspect-square rounded-xl border border-[#e5e0d8] bg-[#f7f4ef] overflow-hidden flex items-center justify-center">
                {draft.thumbnail_url
                  ? <img src={draft.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <IconPhoto size={28} className="text-[#d8d1c4]" />}
              </div>
              <p className="mt-2 text-[11.5px] text-[#9a9080]">
                사진 {draft.images.length}장 · 상세 {draft.detail_images.length}장
              </p>
            </div>

            {/* 입력 */}
            <div className="grid gap-3.5">
              <div>
                <label className={labelCls}>상품명</label>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} placeholder="상품명" />
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>정가 (원)</label>
                  <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value === '' ? '' : Number(e.target.value) })}
                    inputMode="numeric" className={field} placeholder="0" />
                </div>
                <div>
                  <label className={labelCls}>할인가 (선택)</label>
                  <input value={draft.sale_price} onChange={(e) => setDraft({ ...draft, sale_price: e.target.value === '' ? '' : Number(e.target.value) })}
                    inputMode="numeric" className={field} placeholder="없으면 비워두세요" />
                </div>
                {editingId ? (
                  <div>
                    <label className={labelCls}>재고 (개)</label>
                    <p className="text-[13px] text-[#9a9080] py-2.5">{draft.stock}개 · 목록에서 수정</p>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>재고 (개)</label>
                    <input value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value === '' ? '' : Number(e.target.value) })}
                      inputMode="numeric" className={field} placeholder="0" />
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>카테고리</label>
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={field}>
                  <option value="">선택해 주세요</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>상품 설명</label>
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3} className={`${field} resize-none`} placeholder="상품 설명" />
              </div>

              {/* 상품정보고시 — 전자상거래법상 구매 전 표시 의무. 전부 선택 입력이지만 비워두면
                  상품 상세페이지에 "미기재"로 그대로 뜬다(product/ProductInfoNotice.tsx). */}
              <div className="pt-2 mt-1 border-t border-[#efeae1]">
                <p className="text-[13px] font-bold text-[#111] mb-1">상품정보고시</p>
                <p className="text-[11.5px] text-[#b3aa9a] mb-3">
                  화장품 온라인 판매 시 표시가 필요한 정보입니다. 비워두면 상세페이지에 "미기재"로 표시됩니다.
                </p>
                <div className="grid gap-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>내용물의 용량 또는 중량</label>
                      <input value={draft.capacity_weight} onChange={(e) => setDraft({ ...draft, capacity_weight: e.target.value })}
                        className={field} placeholder="예: 50ml" />
                    </div>
                    <div>
                      <label className={labelCls}>사용기한(또는 개봉 후 사용기간)</label>
                      <input value={draft.expiry_info} onChange={(e) => setDraft({ ...draft, expiry_info: e.target.value })}
                        className={field} placeholder="예: 제조일로부터 36개월, 개봉 후 12개월 이내" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>전성분</label>
                    <textarea value={draft.ingredients} onChange={(e) => setDraft({ ...draft, ingredients: e.target.value })}
                      rows={2} className={`${field} resize-none`} placeholder="정제수, 글리세린, ..." />
                  </div>
                  <div>
                    <label className={labelCls}>사용방법</label>
                    <textarea value={draft.usage_method} onChange={(e) => setDraft({ ...draft, usage_method: e.target.value })}
                      rows={2} className={`${field} resize-none`} placeholder="세안 후 적당량을 덜어 사용합니다." />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>제조업자</label>
                      <input value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })}
                        className={field} placeholder="제조업자명" />
                    </div>
                    <div>
                      <label className={labelCls}>책임판매업자</label>
                      <input value={draft.responsible_seller} onChange={(e) => setDraft({ ...draft, responsible_seller: e.target.value })}
                        className={field} placeholder="책임판매업자명" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>사용할 때의 주의사항</label>
                    <textarea value={draft.precautions} onChange={(e) => setDraft({ ...draft, precautions: e.target.value })}
                      rows={2} className={`${field} resize-none`} placeholder="상처가 있는 부위 등에는 사용을 자제해 주세요." />
                  </div>
                  <div>
                    <label className={labelCls}>품질보증기준</label>
                    <input value={draft.quality_standard} onChange={(e) => setDraft({ ...draft, quality_standard: e.target.value })}
                      className={field} placeholder="예: 공정거래위원회 고시 소비자분쟁해결기준에 따름" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => void save()} disabled={saving}
                  className="rounded-lg bg-[#b8924a] text-white font-semibold text-[14px] px-6 py-2.5 disabled:opacity-50 transition">
                  {saving ? (editingId ? '수정 중…' : '등록 중…') : (editingId ? '수정하기' : '등록하기')}
                </button>
                <button onClick={() => { setDraft(null); setEditingId(null); setMsg('') }}
                  className="rounded-lg border border-[#e5e0d8] text-[#6b6355] font-semibold text-[14px] px-5 py-2.5 transition">
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 내 상품 */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[14px] font-bold text-[#111]">등록한 상품</h2>
          <span className="text-[12px] text-[#9a9080]">{items.length}개</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-10">
            <IconTrash size={30} className="text-[#e5e0d8] mx-auto mb-2" />
            <p className="text-[13px] text-[#9a9080]">아직 등록한 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((p) => {
              const badge = STATUS_LABEL[p.status] ?? { text: p.status, cls: 'bg-[#f3f1ed] text-[#9a9080]' }
              const shown = p.sale_price ?? p.price
              return (
                <div key={p.id} className="flex items-center gap-3.5 p-3 bg-[#f7f4ef] rounded-xl">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-white border border-[#e5e0d8] shrink-0 flex items-center justify-center">
                    {p.thumbnail_url
                      ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : <IconPhoto size={18} className="text-[#d8d1c4]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold text-[#111] truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[12px] text-[#9a9080]">{p.category ?? '-'} · 재고</span>
                      <input
                        value={stockEdits[p.id] ?? String(p.stock ?? 0)}
                        onChange={(e) => setStockEdits((prev) => ({ ...prev, [p.id]: e.target.value.replace(/[^0-9]/g, '') }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveStock(p.id) }}
                        inputMode="numeric"
                        className="w-14 bg-white border border-[#e5e0d8] rounded px-1.5 py-0.5 text-[12px] text-[#111] text-right focus:outline-none focus:border-[#b8924a]"
                      />
                      <span className="text-[12px] text-[#9a9080]">개</span>
                      {stockEdits[p.id] !== undefined && stockEdits[p.id] !== String(p.stock ?? 0) && (
                        <button
                          onClick={() => void saveStock(p.id)}
                          disabled={stockSaving === p.id}
                          className="text-[11px] font-semibold text-white bg-[#b8924a] rounded px-2 py-0.5 disabled:opacity-50"
                        >
                          {stockSaving === p.id ? '저장 중' : '저장'}
                        </button>
                      )}
                    </div>
                    {p.review_summary && p.review_summary.count > 0 && (
                      <p className="text-[11.5px] text-[#b3aa9a] mt-0.5">
                        리뷰 {p.review_summary.count.toLocaleString('ko-KR')}건
                        {p.review_summary.avg != null && ` · ⭐${p.review_summary.avg.toFixed(1)}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13.5px] font-bold text-[#111] tabular-nums">{shown?.toLocaleString('ko-KR')}원</p>
                    <span className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
                    <button
                      onClick={() => { setEditingId(p.id); setDraft(draftFromProduct(p)); setMsg(''); setOk('') }}
                      className="block mt-1.5 text-[11px] font-semibold text-[#6b6355] underline underline-offset-2"
                    >
                      수정
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-5 pt-4 border-t border-[#efeae1] text-[12px] text-[#9a9080] leading-relaxed">
          새로 등록한 상품은 <strong className="text-[#6b6355]">확인 대기</strong> 상태로 들어오며,
          뷰티그라운드에서 내용을 확인한 뒤 판매가 시작됩니다. 이미 판매중인 상품을 고친 내용은
          별도 확인 없이 바로 반영됩니다.
        </p>
      </div>
    </>
  )
}
