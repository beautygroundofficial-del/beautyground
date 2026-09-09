import { useEffect, useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { IconTruck, IconDownload, IconUpload, IconCheck } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { Order } from '../../lib/types'
import { won, formatDateTime } from '../../lib/format'

// 배송/물류 1단계(반자동, 2026-08-27) — 출고 대기 → CJ 접수 엑셀 내보내기 → LoIS 업로드 →
// 송장 엑셀 가져오기(주문번호↔송장 매핑) → 배송중 → 배송완료. 2단계(CJ API/LoIS 자동화)에서
// "출고" 버튼이 송장 발급까지 자동으로 하도록 issueLabel 자리만 비워둔다.
// 서버 함수 없이 Supabase 클라이언트(관리자 RLS: orders_admin_update)로만 동작 — 몰 API 12/12 제한 때문.

type Row = Order & {
  products: { name: string } | null
  recipient_name?: string | null
  recipient_phone?: string | null
  ship_address?: string | null
  ship_zip?: string | null
  ship_from?: string | null
  shipped_at?: string | null
  delivered_at?: string | null
}

interface Group {
  paymentId: string
  createdAt: string
  status: Order['status']
  items: Row[]
  total: number
  recipient: string
  phone: string
  address: string
  zip: string
  memo: string
  tracking: string | null
  shippedAt: string | null
}

const CJ_TRACK = (no: string) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${encodeURIComponent(no.replace(/-/g, ''))}`

// 배송지: 정식 컬럼 우선, 없으면 옛 주문(delivery_memo "배송지: ...")에서 파싱
function resolveAddress(r: Row): { address: string; memo: string } {
  if (r.ship_address) return { address: r.ship_address, memo: (r.delivery_memo ?? '').replace(/^배송지:[^\n]*\n?/, '').trim() }
  const m = (r.delivery_memo ?? '').match(/^배송지:\s*([^\n]+)\n?([\s\S]*)$/)
  if (m) return { address: m[1].trim(), memo: m[2].trim() }
  return { address: '', memo: (r.delivery_memo ?? '').trim() }
}

function groupRows(rows: Row[]): Group[] {
  const by = new Map<string, Row[]>()
  for (const r of rows) {
    const key = r.payment_id ?? r.id
    if (!by.has(key)) by.set(key, [])
    by.get(key)!.push(r)
  }
  const out: Group[] = []
  for (const [paymentId, list] of by) {
    const items = list.filter((r) => r.product_id)
    const first = items[0] ?? list[0]
    const { address, memo } = resolveAddress(first)
    const tracked = list.find((r) => r.tracking_number)
    out.push({
      paymentId,
      createdAt: first.created_at,
      status: first.status,
      items,
      total: list.reduce((s, r) => s + r.amount, 0),
      recipient: first.recipient_name ?? first.buyer_name ?? '',
      phone: first.recipient_phone ?? first.buyer_phone ?? '',
      address,
      zip: first.ship_zip ?? '',
      memo,
      tracking: tracked?.tracking_number ?? null,
      shippedAt: tracked?.shipped_at ?? null,
    })
  }
  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return out
}

type Tab = 'ready' | 'shipped' | 'done'

export default function AdminShipping() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<Tab>('ready')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [manual, setManual] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, products(name)')
      .in('status', ['paid', 'shipped', 'done'])
      .order('created_at', { ascending: false })
      .limit(800)
    if (error) setMsg(`불러오기 실패: ${error.message}`)
    setRows((data ?? []) as Row[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const groups = useMemo(() => groupRows(rows), [rows])
  const visible = useMemo(() => {
    if (tab === 'ready') return groups.filter((g) => g.status === 'paid' && !g.tracking)
    if (tab === 'shipped') return groups.filter((g) => g.status === 'shipped' || (g.status === 'paid' && g.tracking))
    return groups.filter((g) => g.status === 'done').slice(0, 100)
  }, [groups, tab])

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((g) => g.paymentId)))

  // ── LoIS 파일접수용 엑셀 내보내기 (2026-09-09 LoIS 실제 확인 후 열 확정) ──
  // 매장이 이미 쓰는 고객사LAYOUT "뷰티그라운드"는 7열(받는분성명·전화·주소·배송메세지1·품목명·내품명·내품수량)이고
  // 고객주문번호 칸이 없어 송장을 되가져올 때 주문과 자동으로 못 맞춘다. 그래서 그 7열 뒤에 고객주문번호를
  // 붙인 8열짜리 LAYOUT "뷰티그라운드몰"을 LoIS에 따로 만들었다 — 매장 기존 양식은 그대로 두고, 이 파일은
  // 업로드할 때 형식명만 "뷰티그라운드몰"로 고르면 된다. 보내는분(광명점)은 LoIS 화면 기본값이 채운다.
  // 열 순서가 곧 규격이다(LoIS는 제목행을 건너뛰고 순서로 읽음) — 아래 순서를 바꾸면 접수가 깨진다.
  const exportExcel = () => {
    const target = visible.filter((g) => selected.size === 0 || selected.has(g.paymentId))
    if (target.length === 0) { setMsg('내보낼 주문이 없습니다.'); return }
    const itemName = (r: Row) => `${r.products?.name ?? r.order_name}${r.option_label ? `(${r.option_label})` : ''}`
    const data = target.map((g) => ({
      '받는분성명': g.recipient,
      '받는분전화번호': g.phone,
      '받는분주소(전체)': g.address,
      // 배송메세지1은 100Byte(한글 50자)까지만 LoIS가 받는다 — 넘치면 잘라서 보낸다
      '배송메세지1': g.memo.replace(/[\r\n]+/g, ' ').slice(0, 50),
      '품목명': '화장품',
      '내품명': g.items.map((r) => `${itemName(r)} ${r.quantity}개`).join(', ').slice(0, 120),
      '내품수량': g.items.reduce((s, r) => s + r.quantity, 0),
      '고객주문번호': g.paymentId,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '접수')
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    XLSX.writeFile(wb, `LoIS접수_뷰티그라운드몰_${stamp}_${target.length}건.xlsx`)
    setMsg(`${target.length}건 내보냈습니다. LoIS 파일접수에서 형식명 "뷰티그라운드몰"을 고르고 업로드하세요.`)
  }

  // ── 송장 반영(주문 묶음 단위) ──
  const applyTracking = async (paymentId: string, tracking: string) => {
    const no = tracking.replace(/[^0-9]/g, '')
    if (no.length < 10) { setMsg(`송장번호 형식을 확인해 주세요: ${tracking}`); return false }
    // shipping.sql(신규 컬럼) 실행 전이라도 송장·상태 반영은 되도록 — 컬럼 없음 오류면 기본 컬럼만으로 재시도
    let { error } = await supabase
      .from('orders')
      .update({ tracking_number: no, tracking_carrier: 'cj', status: 'shipped', shipping_status: 'shipped', shipped_at: new Date().toISOString() })
      .eq('payment_id', paymentId)
      .in('status', ['paid', 'shipped'])
    if (error && /column|schema cache/i.test(error.message)) {
      ;({ error } = await supabase.from('orders').update({ tracking_number: no, tracking_carrier: 'cj', status: 'shipped' }).eq('payment_id', paymentId).in('status', ['paid', 'shipped']))
    }
    if (error) { setMsg(`반영 실패(${paymentId}): ${error.message}`); return false }
    return true
  }

  // ── 송장 엑셀/CSV 가져오기 — '주문번호'와 '송장/운송장' 열을 이름으로 찾는다 ──
  const importFile = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer())
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const recs = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    if (recs.length === 0) { setMsg('빈 파일입니다.'); return }
    const keys = Object.keys(recs[0])
    const orderKey = keys.find((k) => /주문번호|주문 번호|payment_id|고객주문번호/i.test(k))
    const trackKey = keys.find((k) => /운송장|송장|invoice|tracking/i.test(k))
    if (!orderKey || !trackKey) { setMsg(`열을 찾지 못했습니다. 있는 열: ${keys.join(', ')}`); return }
    let ok = 0, skip = 0
    for (const rec of recs) {
      const pid = String(rec[orderKey] ?? '').trim()
      const no = String(rec[trackKey] ?? '').trim()
      if (!pid || !no) { skip++; continue }
      if (!groups.some((g) => g.paymentId === pid)) { skip++; continue }
      if (await applyTracking(pid, no)) ok++
    }
    setMsg(`송장 반영 ${ok}건, 건너뜀 ${skip}건`)
    setSelected(new Set())
    await load()
  }

  const markDelivered = async (paymentId: string) => {
    let { error } = await supabase
      .from('orders')
      .update({ status: 'done', shipping_status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('payment_id', paymentId)
      .eq('status', 'shipped')
    if (error && /column|schema cache/i.test(error.message)) {
      ;({ error } = await supabase.from('orders').update({ status: 'done' }).eq('payment_id', paymentId).eq('status', 'shipped'))
    }
    setMsg(error ? `완료 처리 실패: ${error.message}` : '배송완료 처리했습니다.')
    await load()
  }

  const counts = {
    ready: groups.filter((g) => g.status === 'paid' && !g.tracking).length,
    shipped: groups.filter((g) => g.status === 'shipped' || (g.status === 'paid' && g.tracking)).length,
    done: groups.filter((g) => g.status === 'done').length,
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="text-[22px] font-bold text-ink flex items-center gap-2"><IconTruck className="w-6 h-6" /> 배송 / 물류</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control bg-ink text-paper text-[13px] font-semibold hover:opacity-90">
            <IconDownload className="w-4 h-4" /> LoIS 접수 엑셀 내보내기{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control border border-ink text-ink text-[13px] font-semibold hover:bg-quiet">
            <IconUpload className="w-4 h-4" /> 송장 엑셀 가져오기
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-rule">
        {([['ready', '출고 대기'], ['shipped', '배송중'], ['done', '배송완료']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSelected(new Set()) }}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px ${tab === k ? 'border-ink text-ink' : 'border-transparent text-ink-faint hover:text-ink'}`}>
            {label} <span className="ml-1 text-[11px] text-ink-faint">{counts[k]}</span>
          </button>
        ))}
      </div>

      {msg && <p className="mb-4 text-[13px] text-signal-blue">{msg}</p>}

      <p className="mb-3 text-[12px] text-ink-faint">
        흐름: 출고 대기 선택 → "LoIS 접수 엑셀 내보내기" → LoIS Parcel ▸ 예약 ▸ 기업고객파일접수에서 <b>형식명 "뷰티그라운드몰"</b> 선택 후 업로드 → 접수확정 → 운송장출력 → LoIS에서 운송장 목록 엑셀(고객주문번호·운송장번호 열) 내려받아 "송장 엑셀 가져오기" → 배송중 → 배달되면 "배송완료". 송장은 아래 칸에 직접 입력해도 됩니다.
      </p>

      {loading ? (
        <p className="py-12 text-center text-ink-faint text-[13px]">불러오는 중…</p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-ink-faint text-[13px]">해당 주문이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto border border-rule rounded-card">
          <table className="w-full text-[12.5px]">
            <thead className="bg-quiet text-ink-soft">
              <tr>
                {tab === 'ready' && <th className="p-2.5 w-8"><input type="checkbox" checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} /></th>}
                <th className="p-2.5 text-left">주문</th>
                <th className="p-2.5 text-left">상품</th>
                <th className="p-2.5 text-left">받는분 / 배송지</th>
                <th className="p-2.5 text-right">금액</th>
                <th className="p-2.5 text-left">송장</th>
                <th className="p-2.5 text-left">처리</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((g) => (
                <tr key={g.paymentId} className="border-t border-rule align-top">
                  {tab === 'ready' && <td className="p-2.5"><input type="checkbox" checked={selected.has(g.paymentId)} onChange={() => toggle(g.paymentId)} /></td>}
                  <td className="p-2.5 whitespace-nowrap">
                    <div className="font-mono text-[11px] text-ink-faint">{g.paymentId}</div>
                    <div>{formatDateTime(g.createdAt)}</div>
                  </td>
                  <td className="p-2.5">
                    {g.items.map((r) => (
                      <div key={r.id}>{r.products?.name ?? r.order_name}{r.option_label ? ` (${r.option_label})` : ''} × {r.quantity}</div>
                    ))}
                  </td>
                  <td className="p-2.5">
                    <div className="font-semibold text-ink">{g.recipient} <span className="font-normal text-ink-soft">{g.phone}</span></div>
                    <div className={g.address ? 'text-ink' : 'text-signal-red'}>{g.address || '⚠ 배송지 없음 — 고객 확인 필요'}</div>
                    {g.memo && <div className="text-ink-faint">메모: {g.memo}</div>}
                  </td>
                  <td className="p-2.5 text-right tabular-nums whitespace-nowrap">{won(g.total)}</td>
                  <td className="p-2.5 whitespace-nowrap">
                    {g.tracking ? (
                      <a href={CJ_TRACK(g.tracking)} target="_blank" rel="noreferrer" className="text-signal-blue underline">CJ {g.tracking}</a>
                    ) : (
                      <div className="flex gap-1">
                        <input value={manual[g.paymentId] ?? ''} onChange={(e) => setManual({ ...manual, [g.paymentId]: e.target.value })}
                          placeholder="송장번호" className="w-36 px-2 py-1 border border-rule rounded-control text-[12px]" />
                        <button onClick={async () => { if (await applyTracking(g.paymentId, manual[g.paymentId] ?? '')) { setMsg('송장 저장·배송중 처리'); await load() } }}
                          className="px-2 py-1 rounded-control bg-ink text-paper text-[11px]">저장</button>
                      </div>
                    )}
                    {g.shippedAt && <div className="text-[11px] text-ink-faint">발송 {formatDateTime(g.shippedAt)}</div>}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {tab === 'shipped' && (
                      <button onClick={() => markDelivered(g.paymentId)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control border border-rule text-[11.5px] hover:bg-quiet">
                        <IconCheck className="w-3.5 h-3.5" /> 배송완료
                      </button>
                    )}
                    {tab === 'done' && <span className="text-ink-faint text-[11.5px]">완료</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
