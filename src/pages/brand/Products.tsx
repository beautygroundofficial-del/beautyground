import { useEffect, useMemo, useRef, useState } from 'react'
import { IconLink, IconPhoto, IconPlus, IconSearch, IconTrash, IconX } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner, uploadSellerProductImage } from '../../lib/partner'
import type { Partner, Product } from '../../lib/types'

// 브랜드 셀러센터 — 상품 등록 (2026-09-02)
// 브랜드가 자사몰 상품 URL 을 붙여넣으면 /api/scrape-product 가 이름·가격·이미지를 긁어오고,
// 확인 후 저장하면 같은 API 의 저장 모드가 등록한다(partner_id 는 서버가 토큰으로 강제).
// 등록분은 status='hidden' 으로 들어가며 뷰티그라운드 확인 후 판매중으로 전환된다.

// 사진은 URL 스크랩분 말고 브랜드가 직접 올리고 바꾸고 뺄 수도 있다(2026-09-11).
// 파일은 브라우저에서 Storage(seller/<partner_id>/…)로 바로 올라간다 — supabase/brand_product_images.sql.

const CATEGORIES = ['스킨케어', '메이크업', '향수', '헤어·바디', '이너뷰티', '뷰티 디바이스', '기타']
const BULK_MAX = 20

type BulkRow = {
  url: string
  state: 'wait' | 'run' | 'done' | 'need' | 'fail'
  name?: string
  note?: string
  draft?: Draft
}

// 서버(api/scrape-product.ts)가 배열을 30장에서 자르므로 화면에서도 같은 한도를 지킨다.
const MAX_IMAGES = 30
const MAX_IMAGE_MB = 10
type ImageFolder = 'thumb' | 'gallery' | 'detail'

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

// 사진 여러 장 관리 — 추가·순서 바꾸기·빼기. 상품 사진과 상세 이미지가 같은 틀을 쓴다.
// "빼기"는 이 상품의 사진 목록에서만 빼는 것이고 올라간 파일 자체는 지우지 않는다
// (되돌리기 안전 + 다른 상품이 같은 사진을 쓰고 있을 수 있음).
function ImageStrip({ images, onChange, onPick, uploading, hint }: {
  images: string[]
  onChange: (next: string[]) => void
  onPick: (files: FileList | null) => void
  uploading: boolean
  hint: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    next[i] = images[j]
    next[j] = images[i]
    onChange(next)
  }
  const arrowCls =
    'w-6 h-5 rounded border border-[#e5e0d8] bg-white text-[11px] leading-none text-[#6b6355] disabled:opacity-30'

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((src, i) => (
          <div key={`${src}-${i}`} className="w-[84px]">
            <div className="relative w-[84px] h-[84px] rounded-lg overflow-hidden border border-[#e5e0d8] bg-white">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, k) => k !== i))}
                aria-label={`${i + 1}번째 사진 빼기`}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <IconX size={12} />
              </button>
            </div>
            <div className="flex justify-center gap-1 mt-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                aria-label={`${i + 1}번째 사진 앞으로`} className={arrowCls}>←</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === images.length - 1}
                aria-label={`${i + 1}번째 사진 뒤로`} className={arrowCls}>→</button>
            </div>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-[84px] h-[84px] rounded-lg border border-dashed border-[#d8d1c4] bg-[#fbf9f5] text-[#b3aa9a] flex flex-col items-center justify-center gap-1 disabled:opacity-50"
          >
            <IconPlus size={16} />
            <span className="text-[11px] font-semibold">{uploading ? '올리는 중' : '사진 추가'}</span>
          </button>
        )}
      </div>

      <p className="mt-2 text-[11.5px] text-[#b3aa9a]">{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { onPick(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}

export default function BrandProducts() {
  const [partner, setPartner] = useState<Partner | null>(null)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Product[]>([])

  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  // 여러 상품 한 번에 등록 — 주소를 줄마다 하나씩 붙여넣으면 순서대로 자동 추출해 "확인 대기"로 넣는다.
  // 가격을 못 읽은 상품(회원전용가 등)은 등록하지 않고 "직접 확인"으로 남겨 편집기에서 채우게 한다.
  // 브랜드 담당자가 사진을 찾아 올리지 않아도 되게 하는 게 목적(2026-09-12 대표님 방향).
  const [bulkText, setBulkText] = useState('')
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null) // null=신규등록, 있으면 그 상품 수정
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')
  // 재고 인라인 수정 — product id별 입력 중인 값. update_my_product_stock RPC(brand_stock_update.sql)로
  // 본인 partner_id 상품만 수정 가능하게 서버(Postgres)에서 강제한다.
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({})
  const [stockSaving, setStockSaving] = useState<string | null>(null)
  // 사진 직접 올리기 — 어느 칸을 올리는 중인지(버튼 잠금용)와 대표사진 파일 입력.
  const [uploading, setUploading] = useState<ImageFolder | null>(null)
  const thumbInputRef = useRef<HTMLInputElement>(null)
  // 상품이 쌓이면 목록에서 찾기 어려워져 이름·카테고리 검색과 상태 거르기를 둔다(서버 왕복 없음).
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_sale' | 'hidden' | 'sold_out'>('all')

  const visibleItems = useMemo(() => {
    const kw = query.trim().toLowerCase()
    return items.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (!kw) return true
      return p.name.toLowerCase().includes(kw) || (p.category ?? '').toLowerCase().includes(kw)
    })
  }, [items, query, statusFilter])

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

  // 여러 주소 한 번에: 추출 → 가격 있으면 바로 등록(확인 대기), 없으면 편집기로 넘길 초안만 보관
  const runBulk = async () => {
    if (bulkRunning) return
    const urls = Array.from(new Set(
      bulkText.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l)),
    )).slice(0, BULK_MAX)
    if (urls.length === 0) { setMsg('상품 페이지 주소를 한 줄에 하나씩 붙여넣어 주세요.'); return }
    if (!bulkCategory) { setMsg('한 번에 등록할 상품의 카테고리를 골라 주세요. 등록 후 상품별로 바꿀 수 있습니다.'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setMsg('로그인이 만료되었습니다. 다시 로그인해 주세요.'); return }
    setBulkRunning(true); setMsg(''); setOk('')
    const rows: BulkRow[] = urls.map((u) => ({ url: u, state: 'wait' }))
    setBulkRows([...rows])
    let registered = 0
    for (let i = 0; i < rows.length; i++) {
      rows[i] = { ...rows[i], state: 'run' }; setBulkRows([...rows])
      try {
        const r = await fetch('/api/scrape-product', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: rows[i].url }),
        })
        const json = await r.json()
        if (!json?.ok) {
          rows[i] = { ...rows[i], state: 'fail', note: json?.error || '상품 정보를 읽지 못했습니다.' }
          setBulkRows([...rows]); continue
        }
        const d = json.data as Partial<Draft> & { images?: string[]; detail_images?: string[] }
        const draft: Draft = {
          ...emptyDraft,
          name: d.name ?? '',
          price: typeof d.price === 'number' ? d.price : (typeof d.sale_price === 'number' ? d.sale_price : ''),
          sale_price: typeof d.price === 'number' && typeof d.sale_price === 'number' ? d.sale_price : '',
          category: bulkCategory,
          description: d.description ?? '',
          thumbnail_url: d.thumbnail_url ?? null,
          images: d.images ?? [],
          detail_images: d.detail_images ?? [],
          source_url: rows[i].url,
          stock: 10,
        }
        if (!draft.name.trim() || !draft.price || Number(draft.price) <= 0) {
          rows[i] = { ...rows[i], state: 'need', name: draft.name, draft, note: !draft.name.trim() ? '상품명을 읽지 못함' : '가격을 읽지 못함(회원전용가 등)' }
          setBulkRows([...rows]); continue
        }
        const sr = await fetch('/api/scrape-product', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ mode: 'save', product: draft }),
        })
        const sj = await sr.json()
        if (!sj?.ok) {
          rows[i] = { ...rows[i], state: 'fail', name: draft.name, draft, note: sj?.error || '등록에 실패했습니다.' }
        } else {
          registered += 1
          rows[i] = { ...rows[i], state: 'done', name: draft.name }
        }
      } catch {
        rows[i] = { ...rows[i], state: 'fail', note: '네트워크 오류' }
      }
      setBulkRows([...rows])
    }
    setBulkRunning(false)
    if (partner) await loadItems(partner.id)
    const need = rows.filter((r) => r.state === 'need').length
    const fail = rows.filter((r) => r.state === 'fail').length
    setOk(`${registered}개 등록되었습니다(뷰티그라운드 확인 후 판매 시작).${need ? ` ${need}개는 직접 확인이 필요합니다.` : ''}${fail ? ` ${fail}개는 실패했습니다.` : ''}`)
  }

  // 한 번에 등록에서 "직접 확인"으로 남은 상품을 편집기로 불러온다
  const openBulkDraft = (row: BulkRow) => {
    if (!row.draft) return
    setEditingId(null); setDraft(row.draft); setMsg(''); setOk('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  // 고른 파일을 순서대로 Storage 에 올려 공개 URL 배열로 돌려준다.
  // 한 장이라도 규격에 안 맞으면 올리기 전에 막는다 — 절반만 올라가 순서가 꼬이는 걸 피한다.
  const uploadFiles = async (folder: ImageFolder, files: FileList | null, room: number): Promise<string[]> => {
    if (!partner || !files || files.length === 0) return []
    const picked = Array.from(files)
    const bad = picked.find((f) => !f.type.startsWith('image/') || f.size > MAX_IMAGE_MB * 1024 * 1024)
    if (bad) { setMsg(`사진 파일만, 한 장당 ${MAX_IMAGE_MB}MB 이하로 올려 주세요. (${bad.name})`); return [] }
    if (room <= 0) { setMsg(`사진은 ${MAX_IMAGES}장까지 올릴 수 있습니다.`); return [] }

    setUploading(folder); setMsg(''); setOk('')
    const urls: string[] = []
    try {
      for (const f of picked.slice(0, room)) {
        urls.push(await uploadSellerProductImage(f, partner.id, folder))
      }
      if (picked.length > room) setMsg(`사진은 ${MAX_IMAGES}장까지라 ${room}장만 올렸습니다.`)
    } catch {
      setMsg(urls.length > 0
        ? `사진 ${urls.length}장까지 올리고 실패했습니다. 나머지는 다시 올려 주세요.`
        : '사진 올리기에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setUploading(null)
    }
    return urls
  }

  // 대표사진은 한 장만 — 여러 장을 골라도 첫 장만 쓴다.
  const pickThumbnail = async (files: FileList | null) => {
    const [url1] = await uploadFiles('thumb', files, 1)
    if (url1) setDraft((d) => (d ? { ...d, thumbnail_url: url1 } : d))
  }

  const pickGallery = async (files: FileList | null) => {
    const room = MAX_IMAGES - (draft?.images.length ?? 0)
    const urls = await uploadFiles('gallery', files, room)
    if (urls.length > 0) setDraft((d) => (d ? { ...d, images: [...d.images, ...urls] } : d))
  }

  const pickDetail = async (files: FileList | null) => {
    const room = MAX_IMAGES - (draft?.detail_images.length ?? 0)
    const urls = await uploadFiles('detail', files, room)
    if (urls.length > 0) setDraft((d) => (d ? { ...d, detail_images: [...d.detail_images, ...urls] } : d))
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

        {!editingId && !draft && (
          <div className="mb-6 pb-6 border-b border-[#efeae1]">
            <p className="text-[13px] font-bold text-[#111] mb-1">여러 상품 한 번에 등록</p>
            <p className="text-[12.5px] text-[#9a9080] mb-3 leading-relaxed">
              자사몰 상품 페이지 주소를 한 줄에 하나씩 붙여넣으면(최대 {BULK_MAX}개) 상품명·가격·사진을 자동으로 읽어
              "확인 대기"로 등록됩니다. 사진을 따로 찾아 올릴 필요가 없고, 뷰티그라운드가 확인한 뒤 판매가 시작됩니다.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
              disabled={bulkRunning}
              placeholder={'https://브랜드몰.com/product/1\nhttps://브랜드몰.com/product/2\nhttps://브랜드몰.com/product/3'}
              className={`${field} resize-y font-mono text-[12.5px]`}
            />
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)} disabled={bulkRunning} className={`${field} sm:w-[200px]`}>
                <option value="">카테고리(전체 적용)</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={() => void runBulk()}
                disabled={bulkRunning}
                className="shrink-0 rounded-lg bg-[#b8924a] text-white font-semibold text-[14px] px-6 py-2.5 disabled:opacity-50 transition"
              >
                {bulkRunning ? `등록 중… (${bulkRows.filter((r) => r.state !== 'wait' && r.state !== 'run').length}/${bulkRows.length})` : '한 번에 등록'}
              </button>
            </div>
            {bulkRows.length > 0 && (
              <ul className="mt-3 grid gap-1.5">
                {bulkRows.map((r) => (
                  <li key={r.url} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] rounded-lg bg-[#f7f4ef] px-3 py-2">
                    <span className={`shrink-0 font-semibold ${
                      r.state === 'done' ? 'text-[#2f7d5b]' : r.state === 'need' ? 'text-[#8a5b0e]' : r.state === 'fail' ? 'text-[#a32118]' : 'text-[#9a9080]'
                    }`}>
                      {r.state === 'wait' ? '대기' : r.state === 'run' ? '읽는 중…' : r.state === 'done' ? '등록됨' : r.state === 'need' ? '직접 확인' : '실패'}
                    </span>
                    <span className="text-[#111] truncate max-w-[280px]">{r.name || r.url}</span>
                    {r.note && <span className="text-[#9a9080]">· {r.note}</span>}
                    {(r.state === 'need' || (r.state === 'fail' && r.draft)) && (
                      <button type="button" onClick={() => openBulkDraft(r)} className="ml-auto text-[#b8924a] underline font-semibold">
                        편집기에서 채우기
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!editingId && (
          <>
            <p className="text-[13px] font-bold text-[#111] mb-1">한 개씩 확인하며 등록</p>
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
            {/* 대표사진 — 목록·검색 결과·장바구니에 뜨는 한 장 */}
            <div>
              <label className={labelCls}>대표사진</label>
              <div className="aspect-square rounded-xl border border-[#e5e0d8] bg-[#f7f4ef] overflow-hidden flex items-center justify-center">
                {draft.thumbnail_url
                  ? <img src={draft.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  : <IconPhoto size={28} className="text-[#d8d1c4]" />}
              </div>
              <div className="flex gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  disabled={uploading === 'thumb'}
                  className="flex-1 rounded-lg border border-[#e5e0d8] bg-white text-[12px] font-semibold text-[#6b6355] py-2 disabled:opacity-50 transition"
                >
                  {uploading === 'thumb' ? '올리는 중…' : draft.thumbnail_url ? '사진 바꾸기' : '사진 올리기'}
                </button>
                {draft.thumbnail_url && (
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, thumbnail_url: null })}
                    className="rounded-lg border border-[#e5e0d8] bg-white text-[12px] font-semibold text-[#a32118] px-3 py-2 transition"
                  >
                    빼기
                  </button>
                )}
              </div>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { void pickThumbnail(e.target.files); e.target.value = '' }}
              />
              <p className="mt-2 text-[11.5px] text-[#9a9080]">
                상품 사진 {draft.images.length}장 · 상세 {draft.detail_images.length}장
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

              {/* 상품 사진·상세 이미지 — URL 로 긁어온 사진도 여기서 빼거나 순서를 바꿀 수 있다. */}
              <div className="pt-2 mt-1 border-t border-[#efeae1] grid gap-4">
                <div>
                  <p className="text-[13px] font-bold text-[#111] mb-1">상품 사진</p>
                  <p className="text-[11.5px] text-[#b3aa9a] mb-2.5">
                    상세페이지 맨 위에서 넘겨 보는 사진입니다. 왼쪽 첫 장이 가장 먼저 보입니다.
                  </p>
                  <ImageStrip
                    images={draft.images}
                    onChange={(next) => setDraft({ ...draft, images: next })}
                    onPick={(files) => void pickGallery(files)}
                    uploading={uploading === 'gallery'}
                    hint={draft.images.length === 0
                      ? '사진이 없으면 대표사진 한 장만 보입니다.'
                      : `${draft.images.length}장 · 최대 ${MAX_IMAGES}장`}
                  />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#111] mb-1">상세 이미지</p>
                  <p className="text-[11.5px] text-[#b3aa9a] mb-2.5">
                    상세페이지 아래에 위에서 아래로 길게 이어 붙는 설명 이미지입니다.
                  </p>
                  <ImageStrip
                    images={draft.detail_images}
                    onChange={(next) => setDraft({ ...draft, detail_images: next })}
                    onPick={(files) => void pickDetail(files)}
                    uploading={uploading === 'detail'}
                    hint={draft.detail_images.length === 0
                      ? '없어도 됩니다. 상품 설명 글만 보입니다.'
                      : `${draft.detail_images.length}장 · 최대 ${MAX_IMAGES}장`}
                  />
                </div>
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
                <button onClick={() => void save()} disabled={saving || uploading !== null}
                  className="rounded-lg bg-[#b8924a] text-white font-semibold text-[14px] px-6 py-2.5 disabled:opacity-50 transition">
                  {uploading !== null
                    ? '사진 올리는 중…'
                    : saving ? (editingId ? '수정 중…' : '등록 중…') : (editingId ? '수정하기' : '등록하기')}
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-[#111]">등록한 상품</h2>
          <span className="text-[12px] text-[#9a9080]">
            {visibleItems.length === items.length
              ? `${items.length}개`
              : `${visibleItems.length}개 / 전체 ${items.length}개`}
          </span>
        </div>

        {items.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 mb-5">
            <div className="relative flex-1">
              <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c3bcae]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="상품명·카테고리로 찾기"
                className={`${field} pl-9 py-2`}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className={`${field} py-2 sm:w-[140px]`}
            >
              <option value="all">전체 상태</option>
              <option value="on_sale">판매중</option>
              <option value="hidden">확인 대기</option>
              <option value="sold_out">품절</option>
            </select>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-10">
            <IconTrash size={30} className="text-[#e5e0d8] mx-auto mb-2" />
            <p className="text-[13px] text-[#9a9080]">아직 등록한 상품이 없습니다.</p>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[13px] text-[#9a9080]">찾는 조건에 맞는 상품이 없습니다.</p>
            <button
              onClick={() => { setQuery(''); setStatusFilter('all') }}
              className="mt-2 text-[12px] font-semibold text-[#6b6355] underline underline-offset-2"
            >
              조건 지우기
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleItems.map((p) => {
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
                      onClick={() => {
                        setEditingId(p.id); setDraft(draftFromProduct(p)); setMsg(''); setOk('')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
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
          — 사진을 바꾸거나 뺀 것도 — 별도 확인 없이 바로 반영됩니다.
        </p>
      </div>
    </>
  )
}
