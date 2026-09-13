import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopOrders from '../components/order/DesktopOrders'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import type { Order } from '../lib/types'
import ImagePlaceholder from '../components/common/ImagePlaceholder'

// 주문내역 — 같은 결제(payment_id) 단위로 묶어 보여준다.
// 결제 미완료(pending/failed) 행은 잔재이므로 표시하지 않는다.

interface OrderRow extends Order {
  products?: { name: string | null; thumbnail_url: string | null } | null
}

interface OrderGroup {
  paymentId: string
  createdAt: string
  status: Order['status']
  items: OrderRow[] // 배송비 행 제외
  shippingFee: number
  total: number
  trackingNumber: string | null
  trackingCarrier: string | null
}

// 배송 진행 상태는 전부 잉크(중립)로 — 지금 처리해야 할 것만(취소 요청) 신호색을 쓴다.
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  paid: { label: '결제완료', cls: 'bg-ink text-paper' },
  shipped: { label: '배송중', cls: 'bg-ink text-paper' },
  done: { label: '배송완료', cls: 'bg-quiet text-ink-soft' },
  cancelled: { label: '취소됨', cls: 'bg-quiet text-ink-faint' },
  cancel_requested: { label: '취소 요청됨', cls: 'bg-paper text-signal-red border border-signal-red' },
}
const VISIBLE_STATUSES = new Set(Object.keys(STATUS_BADGE))

function groupOrders(rows: OrderRow[]): OrderGroup[] {
  const byPayment = new Map<string, OrderRow[]>()
  for (const r of rows) {
    if (!VISIBLE_STATUSES.has(r.status)) continue
    const key = r.payment_id ?? r.id
    if (!byPayment.has(key)) byPayment.set(key, [])
    byPayment.get(key)!.push(r)
  }
  const groups: OrderGroup[] = []
  for (const [paymentId, list] of byPayment) {
    const items = list.filter((r) => r.order_name !== '배송비' && r.product_id)
    const shippingFee = list
      .filter((r) => r.order_name === '배송비' || !r.product_id)
      .reduce((s, r) => s + r.amount, 0)
    const total = list.reduce((s, r) => s + r.amount, 0)
    const first = items[0] ?? list[0]
    const tracked = list.find((r) => r.tracking_number)
    groups.push({
      paymentId,
      createdAt: first.created_at,
      status: first.status,
      items,
      shippingFee,
      total,
      trackingNumber: tracked?.tracking_number ?? null,
      trackingCarrier: tracked?.tracking_carrier ?? null,
    })
  }
  groups.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return groups
}

export default function AppOrders() {
  const navigate = useNavigate()
  const { mode, isDesktop, toggle } = useViewMode()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [groups, setGroups] = useState<OrderGroup[]>([])
  const [msg, setMsg] = useState('')
  const [cancelling, setCancelling] = useState<string | null>(null)

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoggedIn(false); setLoading(false); return }
    const { data } = await supabase
      .from('orders')
      .select('*, products(name, thumbnail_url)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(300)
    setGroups(groupOrders((data ?? []) as OrderRow[]))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // 배송 전 주문은 구매자가 직접 취소하면 그 자리에서 환불된다(2026-09-01).
  // 예전엔 cancel_requested 로만 바뀌고 관리자가 확정해야 환불돼서, 구매자는 돈이 언제 돌아오는지 알 수 없었다.
  const requestCancel = async (g: OrderGroup) => {
    if (!window.confirm('이 주문을 취소할까요?\n결제하신 금액이 환불됩니다.')) return
    setCancelling(g.paymentId)
    setMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMsg('로그인이 만료되었습니다. 다시 로그인해 주세요.'); return }
      const r = await fetch('/api/order-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ paymentId: g.paymentId }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) {
        setMsg(data.reason || '취소에 실패했습니다. 고객센터(02-897-8287)로 연락해 주세요.')
        return
      }
      setGroups((prev) => prev.map((x) => (x.paymentId === g.paymentId ? { ...x, status: 'cancelled' } : x)))
      setMsg('취소가 완료되었습니다. 카드 취소 반영은 카드사에 따라 3~5영업일이 걸릴 수 있습니다.')
    } catch {
      setMsg('취소 요청에 실패했습니다. 네트워크를 확인해 주세요.')
    } finally {
      setCancelling(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        {isDesktop ? (
          <div className="max-w-[1280px] mx-auto px-6 py-24 flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</div>
        ) : (
          <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</div>
        )}
      </div>
    )
  }

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopOrders loggedIn={loggedIn} groups={groups} msg={msg} cancelling={cancelling} onRequestCancel={requestCancel} />
      </>
    )
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <div className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule">
        <BackHeader title="주문 내역" />
        <div className="flex flex-col items-center justify-center px-8 pt-28 text-center">
          <p className="text-[15px] text-ink mb-2 font-bold">로그인이 필요해요</p>
          <p className="text-[13px] text-ink-faint mb-6">주문 내역은 로그인 후 확인할 수 있어요.</p>
          <button onClick={() => navigate('/app/login')} className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3.5 focus:outline-none focus-visible:shadow-ring">
            로그인하기
          </button>
          {/* 비회원 구매자는 여기서 막히면 자기 주문을 찾아갈 길이 없었다(2026-09-01 추가) */}
          <button
            onClick={() => navigate('/app/guest-order')}
            className="mt-3 rounded-control border border-rule text-ink font-bold text-[14px] px-8 py-3.5 focus:outline-none focus-visible:shadow-ring"
          >
            비회원 주문 조회
          </button>
          <p className="mt-3 text-[12px] text-ink-faint leading-relaxed">
            로그인 없이 주문하셨다면 주문번호와 연락처로 조회하실 수 있어요.
          </p>
        </div>
      </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule pb-16">
      <BackHeader title="주문 내역" />

      {msg && (
        <div className="mx-4 mt-3 bg-paper border border-signal-red text-signal-red text-[12.5px] rounded-control px-4 py-3">{msg}</div>
      )}

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 pt-28 text-center">
          <p className="text-[15px] text-ink font-bold mb-2">아직 첫 주문 전이시네요</p>
          <p className="text-[13px] text-ink-faint mb-6">오늘 첫 주문을 시작해보세요</p>
          <button onClick={() => navigate('/app/home')} className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3.5 focus:outline-none focus-visible:shadow-ring">
            쇼핑하러 가기
          </button>
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          {groups.map((g) => {
            const badge = STATUS_BADGE[g.status] ?? STATUS_BADGE.paid
            const d = new Date(g.createdAt)
            const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
            return (
              <div key={g.paymentId} className="bg-paper border border-rule overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-rule">
                  <span className="text-[12.5px] text-ink-faint">{dateStr} 주문</span>
                  <span className={`text-[11.5px] font-bold px-2.5 py-1 rounded-control ${badge.cls}`}>{badge.label}</span>
                </div>

                <div className="divide-y divide-rule">
                  {g.items.map((it) => (
                    <Link
                      key={it.id}
                      to={it.product_id ? `/app/product/${it.product_id}` : '#'}
                      className="flex items-center gap-3 px-4 py-3 focus:outline-none focus-visible:shadow-ring"
                    >
                      <div className="w-14 h-14 bg-quiet overflow-hidden shrink-0">
                        {it.products?.thumbnail_url ? (
                          <img src={it.products.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <ImagePlaceholder />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] text-ink truncate">{it.products?.name ?? it.order_name ?? '상품'}</p>
                        <p className="text-[12px] text-ink-faint mt-0.5 tabular-nums">
                          {it.quantity}개 · {it.amount.toLocaleString('ko-KR')}원
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="px-4 py-3 bg-quiet border-t border-rule">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] text-ink-faint">
                      {g.shippingFee > 0 ? `배송비 ${g.shippingFee.toLocaleString('ko-KR')}원 포함` : '무료배송'}
                    </span>
                    <span className="text-[14.5px] font-bold tabular-nums text-ink">
                      총 {g.total.toLocaleString('ko-KR')}원
                    </span>
                  </div>

                  {g.trackingNumber && (
                    <p className="mt-2 text-[12.5px] text-ink-soft">
                      {g.trackingCarrier ? `${g.trackingCarrier} ` : ''}운송장 <b className="select-all">{g.trackingNumber}</b>{' '}<a href={`https://trace.cjlogistics.com/next/tracking.html?wblNo=${encodeURIComponent(g.trackingNumber.replace(/-/g, ''))}`} target="_blank" rel="noreferrer" className="ml-2 underline text-ink">배송 조회</a>
                    </p>
                  )}

                  {['paid', 'cancel_requested'].includes(g.status) && (
                    <>
                      <button
                        onClick={() => requestCancel(g)}
                        disabled={cancelling === g.paymentId}
                        className="mt-3 w-full text-[13px] text-ink-soft rounded-control border border-rule py-2.5 bg-paper disabled:opacity-50 focus:outline-none focus-visible:shadow-ring"
                      >
                        {cancelling === g.paymentId ? '취소 처리 중…' : '주문 취소'}
                      </button>
                      <p className="mt-2 text-[11.5px] text-ink-faint leading-relaxed">
                        배송 전까지 바로 취소하실 수 있습니다. 카드 취소 반영은 카드사에 따라 3~5영업일이 걸릴 수 있습니다.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
    </div>
  )
}
