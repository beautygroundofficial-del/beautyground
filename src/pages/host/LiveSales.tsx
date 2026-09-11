import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconArrowLeft, IconEye, IconX, IconStar, IconFileSpreadsheet } from '@tabler/icons-react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { getMyHost } from '../../lib/host'
import type { HostSaleRow, Live, Product } from '../../lib/types'
import { formatDateTime, won } from '../../lib/format'
import { useLiveStreamChannel } from '../../hooks/useLiveStreamChannel'
import { useStreamStatus } from '../../hooks/useStreamStatus'

type LiteProduct = Pick<Product, 'id' | 'name' | 'thumbnail_url' | 'price' | 'sale_price'>
type LiteBrand = { id: string; name: string } // id = partner_id

// 라이브에 붙일 판매 상품 선택 — host_update_live_products RPC(supabase/host_update_live_products.sql)로
// 본인 라이브에만 반영. 시청자 화면(ShopLiveWatch.tsx)은 product_ids/highlight_product_id를 이미
// 읽어서 상품 시트·구매 버튼을 그리고 있었는데, 정작 진행자가 상품을 고를 화면이 없어서 항상 비어있었다.
function LiveProductPicker({ live, onSaved }: { live: Live; onSaved: (l: Live) => void }) {
  const [selected, setSelected] = useState<LiteProduct[]>([])
  const [highlightId, setHighlightId] = useState<string | null>(live.highlight_product_id ?? null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [brands, setBrands] = useState<LiteBrand[]>([])
  const [brandId, setBrandId] = useState('')
  const [brandProducts, setBrandProducts] = useState<LiteProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<{ updated: number; unmatched: { brand: string; name: string }[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    const loadInitial = async () => {
      const ids = live.product_ids ?? []
      if (ids.length === 0) { setLoadingInitial(false); return }
      const { data } = await supabase
        .from('products')
        .select('id,name,thumbnail_url,price,sale_price')
        .in('id', ids)
      if (!active) return
      const byId = new Map((data as LiteProduct[] ?? []).map((p) => [p.id, p]))
      setSelected(ids.map((id) => byId.get(id)).filter(Boolean) as LiteProduct[])
      setLoadingInitial(false)
    }
    void loadInitial()
    return () => { active = false }
  }, [live.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 브랜드 선택 → 제품 선택 2단 구조 (판매 등록 화면과 동일한 패턴). 판매중 상품이 있는 브랜드만 노출.
  useEffect(() => {
    let active = true
    const loadBrands = async () => {
      const { data: rows } = await supabase.from('products').select('partner_id').eq('status', 'on_sale')
      if (!active) return
      const ids = [...new Set((rows ?? []).map((r) => r.partner_id as string | null).filter((v): v is string => !!v))]
      if (ids.length === 0) { setBrands([]); return }
      const { data: brandRows } = await supabase.from('partner_brands').select('id,brand_name').in('id', ids)
      if (!active) return
      setBrands(
        ((brandRows ?? []) as { id: string; brand_name: string }[])
          .map((b) => ({ id: b.id, name: b.brand_name }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
      )
    }
    void loadBrands()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!brandId) { setBrandProducts([]); return }
    let active = true
    setLoadingProducts(true)
    const loadProducts = async () => {
      const { data } = await supabase
        .from('products')
        .select('id,name,thumbnail_url,price,sale_price')
        .eq('partner_id', brandId)
        .eq('status', 'on_sale')
        .order('name')
      if (!active) return
      setBrandProducts((data as LiteProduct[]) ?? [])
      setLoadingProducts(false)
    }
    void loadProducts()
    return () => { active = false }
  }, [brandId])

  const addProduct = (p: LiteProduct) => {
    setSelected((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev
      const next = [...prev, p]
      if (!highlightId) setHighlightId(p.id)
      return next
    })
    setSaved(false)
  }

  const removeProduct = (id: string) => {
    setSelected((prev) => prev.filter((p) => p.id !== id))
    setHighlightId((prev) => (prev === id ? null : prev))
    setSaved(false)
  }

  // 브랜드가 보내주는 "라이브 특가" 제품 리스트 엑셀(여러 시트, 시트당 브랜드명·제품명·라이브특가KRW 열)을
  // 한 번에 반영 — 브랜드/제품명으로 매칭해서 담고, 라이브특가는 그 제품의 실제 판매가(sale_price)에
  // 반영한다(라이브 화면뿐 아니라 온라인몰에도 같은 특가로 보임 — 지금 진행 중인 실제 할인이라 의도된 동작).
  const importExcel = async (file: File) => {
    setImporting(true)
    setImportSummary(null)
    setError('')
    try {
      const norm = (s: string) => s.replace(/\s+/g, '').trim()
      const wb = XLSX.read(await file.arrayBuffer())
      const rows: { brand: string; name: string; livePrice: number | null }[] = []
      for (const sheetName of wb.SheetNames) {
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: '' })
        for (const r of json) {
          const brand = String(r['브랜드명'] ?? '').trim()
          const name = String(r['제품명'] ?? '').replace(/\s+/g, ' ').trim()
          if (!brand || !name) continue
          let livePrice: number | null = null
          for (const key of Object.keys(r)) {
            const k = key.replace(/\s+/g, '')
            if (k.includes('라이브') && k.includes('특가')) {
              const v = Number(r[key])
              if (Number.isFinite(v) && v > 0) livePrice = v
            }
          }
          rows.push({ brand, name, livePrice })
        }
      }
      if (rows.length === 0) {
        setError('엑셀에서 브랜드명·제품명 열을 찾지 못했습니다.')
        return
      }

      const { data: allBrands } = await supabase.from('partner_brands').select('id,brand_name')
      const brandByNorm = new Map(((allBrands ?? []) as { id: string; brand_name: string }[]).map((b) => [norm(b.brand_name), b.id]))

      const rowsByBrandId = new Map<string, typeof rows>()
      const unmatched: { brand: string; name: string }[] = []
      for (const row of rows) {
        const bid = brandByNorm.get(norm(row.brand))
        if (!bid) { unmatched.push(row); continue }
        if (!rowsByBrandId.has(bid)) rowsByBrandId.set(bid, [])
        rowsByBrandId.get(bid)!.push(row)
      }

      const newlySelected: LiteProduct[] = []
      let updated = 0
      for (const [bid, brandRows] of rowsByBrandId) {
        const { data: prods } = await supabase
          .from('products')
          .select('id,name,thumbnail_url,price,sale_price')
          .eq('partner_id', bid)
        const list = (prods ?? []) as LiteProduct[]
        const byNorm = new Map(list.map((p) => [norm(p.name), p]))
        for (const row of brandRows) {
          const found =
            byNorm.get(norm(row.name)) ??
            list.find((x) => norm(x.name).includes(norm(row.name)) || norm(row.name).includes(norm(x.name)))
          if (!found) { unmatched.push(row); continue }
          let product = found
          if (row.livePrice != null && row.livePrice !== product.sale_price) {
            const { error: upErr } = await supabase.from('products').update({ sale_price: row.livePrice }).eq('id', product.id)
            if (!upErr) {
              product = { ...product, sale_price: row.livePrice }
              updated += 1
            }
          }
          newlySelected.push(product)
        }
      }

      setSelected((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]))
        for (const p of newlySelected) map.set(p.id, p)
        return [...map.values()]
      })
      setImportSummary({ updated, unmatched })
      setSaved(false)
    } catch {
      setError('엑셀 파일을 읽는 중 오류가 발생했습니다. 형식을 확인해 주세요.')
    } finally {
      setImporting(false)
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const { data, error: rpcErr } = await supabase.rpc('host_update_live_products', {
      p_live_id: live.id,
      p_product_ids: selected.map((p) => p.id),
      p_highlight_product_id: highlightId,
    })
    setSaving(false)
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? '저장에 실패했습니다.')
      return
    }
    onSaved(data as Live)
    setSaved(true)
  }

  return (
    <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 mb-6">
      <h3 className="text-[13px] font-bold text-[#111] mb-3">판매 상품</h3>
      <p className="text-[12px] text-[#9a9080] mb-4">
        방송 중 소개할 상품을 브랜드→제품 순으로 골라 담고, 그중 하나를 대표 상품으로 지정하세요. 시청자 화면 하단에 바로 노출됩니다.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <select
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          className="w-full border border-[#e5e0d8] rounded-md px-3 py-2.5 text-[13px] focus:outline-none focus:border-ink"
        >
          <option value="">브랜드 선택</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value=""
          disabled={!brandId || loadingProducts}
          onChange={(e) => {
            const p = brandProducts.find((x) => x.id === e.target.value)
            if (p) addProduct(p)
          }}
          className="w-full border border-[#e5e0d8] rounded-md px-3 py-2.5 text-[13px] focus:outline-none focus:border-ink disabled:bg-[#faf8f4] disabled:text-[#c8c0b0]"
        >
          <option value="">
            {!brandId
              ? '브랜드 먼저 선택'
              : loadingProducts
              ? '불러오는 중…'
              : brandProducts.length === 0
              ? '판매중 상품 없음'
              : '제품 선택'}
          </option>
          {brandProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {won(p.sale_price ?? p.price)}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void importExcel(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#555] border border-dashed border-[#c8c0b0] rounded-md px-3 py-2 hover:border-ink hover:text-ink disabled:opacity-60"
        >
          <IconFileSpreadsheet size={14} />
          {importing ? '엑셀 처리 중…' : '엑셀로 브랜드·제품·라이브특가 일괄 담기'}
        </button>
        <p className="text-[11px] text-[#9a9080] mt-1.5">
          열: 브랜드명 · 제품명 · 라이브특가KRW (여러 시트 한 번에 처리). 라이브특가는 그 제품의 실제 판매가에 바로 반영됩니다.
        </p>
        {importSummary && (
          <div className="mt-2 text-[12px]">
            <p className="text-[#1E7B3C]">가격 반영 {importSummary.updated}건 완료.</p>
            {importSummary.unmatched.length > 0 && (
              <details className="mt-1">
                <summary className="text-[#FF4757] cursor-pointer">매칭 실패 {importSummary.unmatched.length}건 (직접 확인 필요)</summary>
                <ul className="mt-1 pl-4 list-disc text-[#9a9080]">
                  {importSummary.unmatched.map((u, i) => (
                    <li key={i}>{u.brand} · {u.name}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {loadingInitial ? (
        <p className="text-[12px] text-[#9a9080]">불러오는 중...</p>
      ) : selected.length === 0 ? (
        <p className="text-[12px] text-[#9a9080] py-4 text-center border border-dashed border-[#e5e0d8] rounded-md">
          담긴 상품이 없습니다. 위에서 검색해서 추가하세요.
        </p>
      ) : (
        <div className="space-y-2 mb-4">
          {selected.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border border-[#e5e0d8] rounded-md px-3 py-2.5">
              {p.thumbnail_url ? (
                <img src={p.thumbnail_url} alt="" className="w-11 h-11 rounded object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded bg-[#f3f1ec] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[#111] line-clamp-1">{p.name}</p>
                <p className="text-[12px] text-[#555]">{won(p.sale_price ?? p.price)}</p>
              </div>
              <button
                type="button"
                onClick={() => setHighlightId(p.id)}
                title="대표 상품으로 지정"
                className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-full ${
                  highlightId === p.id ? 'bg-[#FFF3D6] text-[#8A5A00]' : 'bg-[#F3F1EC] text-[#9a9080]'
                }`}
              >
                <IconStar size={12} fill={highlightId === p.id ? '#8A5A00' : 'none'} />
                대표
              </button>
              <button
                type="button"
                onClick={() => removeProduct(p.id)}
                className="shrink-0 text-[#c8c0b0] hover:text-[#FF4757]"
              >
                <IconX size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[12px] text-[#FF4757] mb-3">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || loadingInitial}
          className="text-[13px] font-semibold text-white bg-ink rounded-full px-5 py-2.5 disabled:opacity-60"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        {saved && <span className="text-[12px] text-[#1E7B3C]">저장됐습니다</span>}
      </div>
    </div>
  )
}

const STATUS: Record<Live['status'], { label: string; bg: string; text: string }> = {
  scheduled: { label: '예정', bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: 'LIVE', bg: 'bg-[#FBEAF0]', text: 'text-[#993556]' },
  ended:     { label: '완료', bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
}

export default function HostLiveSales() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [live, setLive] = useState<Live | null>(null)
  const [sales, setSales] = useState<HostSaleRow[]>([])

  // 방송 송출 채널 — 브랜드 담당자 없이도 진행자 본인이 직접 RTMPS 주소·키를 발급/조회
  const { streamInfo, streamErr, provisioning, createChannel } = useLiveStreamChannel(
    live?.id,
    Boolean(live?.stream_uid)
  )
  const streamState = useStreamStatus(live?.stream_uid, live?.status !== 'ended', 5000)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState('')
  const [ending, setEnding] = useState(false)
  const [endMsg, setEndMsg] = useState('')
  const markedRef = useRef(false)

  // GoLive.tsx(호스트 링크 화면)와 동일한 로직 — 이 화면(로그인 진행자용)엔 없어서
  // 송출이 실제로 연결돼도 사이트엔 계속 "예정"으로 남아있던 버그가 있었다(2026-09-02).
  useEffect(() => {
    if (streamState !== 'connected' || markedRef.current || !live || live.id === undefined) return
    if (live.status === 'live') return
    markedRef.current = true
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { markedRef.current = false; return }
      const res = await fetch('/api/live-input', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ liveId: live.id, markLive: true }),
      })
      if (res.ok) {
        setLive((prev) => (prev ? { ...prev, status: 'live' } : prev))
      } else {
        markedRef.current = false
      }
    })()
  }, [streamState, live])

  const endBroadcast = async () => {
    if (!live || ending) return
    setEnding(true)
    setEndMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setEnding(false); return }
    const res = await fetch('/api/live-input', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ liveId: live.id, markEnded: true }),
    })
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; playbackUrl?: string | null; reason?: string }
    setEnding(false)
    if (!res.ok || !j.ok) {
      setEndMsg(j.reason ?? '종료 처리에 실패했습니다.')
      return
    }
    setLive((prev) => (prev ? { ...prev, status: 'ended' } : prev))
    setEndMsg(j.playbackUrl ? '방송을 종료하고 다시보기를 저장했습니다.' : '방송을 종료했습니다.')
  }
  const copy = async (label: string, value: string | null) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(''), 1500)
    } catch {
      /* 클립보드 미지원 브라우저 — 무시 */
    }
  }

  useEffect(() => {
    let active = true
    const load = async () => {
      const host = await getMyHost()
      if (!active) return
      if (!host || !id) { setLoading(false); return }

      const { data: liveRow } = await supabase.from('lives').select('*').eq('id', id).maybeSingle()
      if (!active) return
      const lr = liveRow as Live | null
      if (!lr || lr.host_id !== host.id) {
        setForbidden(true)
        setLoading(false)
        return
      }
      setLive(lr)

      const { data: saleRows } = await supabase
        .from('host_sales_view')
        .select('*')
        .eq('live_id', id)
        .order('created_at', { ascending: false })
      if (!active) return
      setSales((saleRows as HostSaleRow[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (forbidden || !live) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-3">방송을 찾을 수 없습니다</p>
        <Link to="/host/lives" className="text-[13px] text-ink font-medium hover:underline">
          내 방송 목록으로
        </Link>
      </div>
    )
  }

  const validSales = sales.filter((s) => ['paid', 'shipped', 'done'].includes(s.status))
  const totalSales = validSales.reduce((sum, s) => sum + s.amount, 0)
  const badge = STATUS[live.status]

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Link to="/host/lives" className="flex items-center gap-1.5 text-[13px] text-[#9a9080] hover:text-[#111] transition-colors shrink-0">
          <IconArrowLeft size={15} />
          내 방송
        </Link>
        <span className="text-[#ccc]">·</span>
        <p className="text-[13px] text-[#111] font-medium truncate flex-1 min-w-0">{live.title}</p>
        <span className={`shrink-0 text-[11px] font-bold px-3 py-1 rounded-full ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>
      </div>

      {/* RTMPS 송출은 화면에 "종료" 시점이 없어서, 끝나도 계속 방송중으로 남는다 —
          진행자가 이 버튼을 눌러 종료 처리 + 녹화본 자동 연결까지 한다. */}
      {live.status === 'live' && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => void endBroadcast()}
            disabled={ending}
            className="text-[13px] font-semibold text-[#111] bg-[#F3F1EC] rounded-full px-4 py-2 disabled:opacity-60"
          >
            {ending ? '종료 처리 중…' : '방송 종료하고 다시보기 저장'}
          </button>
          {endMsg && <p className="text-[12px] text-[#1E7B3C] mt-1.5">{endMsg}</p>}
        </div>
      )}

      {live.status !== 'ended' && <LiveProductPicker live={live} onSaved={setLive} />}

      {live.status !== 'ended' && (
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-bold text-[#111]">방송 송출 정보</h3>
            {streamInfo && (
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  streamState === 'connected'
                    ? 'bg-[#E8F6EC] text-[#1E7B3C]'
                    : 'bg-[#F3F1EC] text-[#9a9080]'
                }`}
              >
                {streamState === 'connected' ? '연결됨' : '송출 대기중'}
              </span>
            )}
          </div>

          {!streamInfo ? (
            <>
              <p className="text-[13px] text-[#555] mb-3">
                아직 송출 채널이 없습니다. 방송 시작 전 채널을 먼저 만들어주세요.
              </p>
              <button
                type="button"
                onClick={createChannel}
                disabled={provisioning}
                className="text-[13px] font-semibold text-white bg-ink rounded-full px-4 py-2 disabled:opacity-60"
              >
                {provisioning ? '채널 생성 중…' : '송출 채널 만들기'}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-[#9a9080] mb-1">RTMPS 서버 URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[12px] bg-[#faf8f4] border border-[#e5e0d8] rounded-md px-3 py-2 truncate">
                    {streamInfo.rtmpsUrl ?? '-'}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy('url', streamInfo.rtmpsUrl)}
                    className="shrink-0 text-[12px] text-ink font-medium"
                  >
                    {copied === 'url' ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] text-[#9a9080] mb-1">스트림 키</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[12px] bg-[#faf8f4] border border-[#e5e0d8] rounded-md px-3 py-2 truncate">
                    {showKey ? streamInfo.streamKey ?? '-' : '••••••••••••••••'}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="shrink-0 text-[12px] text-[#9a9080] font-medium"
                  >
                    {showKey ? '숨기기' : '보기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy('key', streamInfo.streamKey)}
                    className="shrink-0 text-[12px] text-ink font-medium"
                  >
                    {copied === 'key' ? '복사됨' : '복사'}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#9a9080]">
                Prism Live Studio·Larix Broadcaster·OBS 등 방송 송출 앱에 위 주소와 키를 입력하면 바로 송출을 시작할 수 있습니다.
              </p>
            </div>
          )}
          {streamErr && <p className="text-[12px] text-[#FF4757] mt-2">{streamErr}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <p className="text-[12px] text-[#9a9080] mb-2">총 판매액</p>
          <p className="font-serif text-[22px] font-bold text-ink">{won(totalSales)}</p>
        </div>
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <p className="text-[12px] text-[#9a9080] mb-2">판매 건수</p>
          <p className="font-serif text-[22px] font-bold text-[#111]">{validSales.length}건</p>
        </div>
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 col-span-2 lg:col-span-1">
          <p className="text-[12px] text-[#9a9080] mb-2 flex items-center gap-1"><IconEye size={13} />최고 동시 시청자</p>
          <p className="font-serif text-[22px] font-bold text-[#111]">{(live.peak_viewers ?? 0).toLocaleString()}명</p>
        </div>
      </div>

      <div className="bg-white rounded-[14px] border border-[#e5e0d8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#eee]">
          <h3 className="text-[13px] font-bold text-[#111]">판매 내역</h3>
        </div>
        {sales.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-[#9a9080]">판매 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#eee]">
                  {['브랜드', '상품명', '수량', '금액', '판매일시', '상태'].map((col) => (
                    <th key={col} className="text-left text-[11px] text-[#9a9080] font-medium px-5 py-4 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-b border-[#eee] hover:bg-[#fdf9f5] transition-colors">
                    <td className="px-5 py-4 text-[13px] text-[#555] whitespace-nowrap">{s.brand_name ?? '-'}</td>
                    <td className="px-5 py-4 text-[13px] text-[#111]">{s.product_name ?? '-'}</td>
                    <td className="px-5 py-4 text-[13px] text-[#555] whitespace-nowrap">{s.quantity}개</td>
                    <td className="px-5 py-4 text-[13px] font-semibold text-[#111] whitespace-nowrap">{won(s.amount)}</td>
                    <td className="px-5 py-4 text-[12px] text-[#9a9080] whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                    <td className="px-5 py-4 text-[11px] text-[#9a9080] whitespace-nowrap">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
