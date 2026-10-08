import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'

// 비회원 주문 조회 (2026-08-18) — 주문번호 + 주문 시 입력한 연락처로 조회.
// 서버 RPC(guest_order_lookup, security definer)가 두 값이 모두 일치할 때만 주문행을 돌려준다.

interface GuestOrderRow {
  order_name: string | null
  quantity: number
  amount: number
  status: string
  created_at: string
  delivery_memo: string | null
}

// orders.status 의 실제 값(lib/types.ts)과 1:1로 맞춘다.
// 예전엔 쓰지도 않는 preparing/delivered 가 들어있고 cancel_requested·done 이 빠져 있어서,
// 취소 요청한 주문을 조회하면 화면에 'cancel_requested' 라는 영문이 그대로 보였다(2026-09-01 수정).
const STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  failed: '결제 실패',
  paid: '결제 완료',
  cancel_requested: '취소 요청됨',
  shipped: '배송 중',
  done: '배송 완료',
  cancelled: '취소 완료',
}

const field =
  'w-full rounded-control bg-paper border border-rule px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus-visible:shadow-ring'

export default function AppGuestOrder() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [orderNo, setOrderNo] = useState(params.get('no') ?? '')
  const [phone, setPhone] = useState('')
  const [rows, setRows] = useState<GuestOrderRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelMsg, setCancelMsg] = useState('')

  const lookup = async () => {
    const no = orderNo.trim()
    const ph = phone.trim()
    if (!no || !ph) {
      setMessage('주문번호와 연락처를 모두 입력해 주세요.')
      return
    }
    setLoading(true)
    setMessage('')
    setCancelMsg('')
    setRows(null)
    const { data, error } = await supabase.rpc('guest_order_lookup', { p_payment_id: no, p_phone: ph })
    setLoading(false)
    if (error) {
      setMessage('조회에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    const list = (data ?? []) as GuestOrderRow[]
    if (list.length === 0) {
      setMessage('일치하는 주문이 없습니다. 주문번호와 연락처를 확인해 주세요.')
      return
    }
    setRows(list)
  }

  // 비회원 주문 취소 — 배송 전이면 서버(/api/order-cancel)가 주문번호+연락처를 대조한 뒤 즉시 환불한다.
  // 회원으로 주문한 건은 서버가 403 을 주므로 로그인 후 취소하도록 안내한다.
  const cancelOrder = async () => {
    if (!window.confirm('이 주문을 취소할까요?\n결제하신 금액이 환불됩니다.')) return
    setCancelling(true)
    setCancelMsg('')
    try {
      const r = await fetch('/api/order-cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: orderNo.trim(), phone: phone.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) {
        setCancelMsg(
          r.status === 403
            ? '회원으로 주문하신 건입니다. 로그인 후 주문 내역에서 취소해 주세요.'
            : data.reason || '취소에 실패했습니다. 고객센터(02-897-8287)로 연락해 주세요.'
        )
        return
      }
      setRows((prev) => (prev ? prev.map((x) => ({ ...x, status: 'cancelled' })) : prev))
      setCancelMsg('취소가 완료되었습니다. 카드 취소 반영은 카드사에 따라 3~5영업일이 걸릴 수 있습니다.')
    } catch {
      setCancelMsg('취소 요청에 실패했습니다. 네트워크를 확인해 주세요.')
    } finally {
      setCancelling(false)
    }
  }

  // 주문 완료 화면에서 주문번호를 들고 넘어온 경우 안내만 — 연락처는 직접 입력해야 조회됨
  useEffect(() => {
    if (params.get('no')) setMessage('주문 시 입력한 연락처를 입력하면 주문 내역이 표시됩니다.')
  }, [params])

  const total = (rows ?? []).reduce((s, r) => s + r.amount, 0)

  return (
    <AppFrame>
      <BackHeader title="비회원 주문 조회" />
      <div className="px-5 py-6 space-y-3">
        <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="주문번호 (order 로 시작)" className={field} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="주문 시 입력한 연락처 (010-0000-0000)" className={field} />
        <button
          onClick={() => void lookup()}
          disabled={loading}
          className="w-full rounded-control bg-ink text-paper font-bold text-[15px] py-4 disabled:opacity-50 focus:outline-none focus-visible:shadow-ring"
        >
          {loading ? '조회 중…' : '주문 조회'}
        </button>
        {message && <p className="text-[13px] text-ink-soft leading-relaxed">{message}</p>}

        {rows && (
          <div className="border border-rule mt-2">
            <div className="px-4 py-3 border-b border-rule bg-quiet">
              <p className="text-[12px] text-ink-faint">주문일 {new Date(rows[0].created_at).toLocaleString('ko-KR')}</p>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="px-4 py-3 border-b border-rule last:border-b-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-ink truncate">{r.order_name ?? '주문 상품'}</p>
                  <p className="text-[12px] text-ink-soft mt-0.5">수량 {r.quantity} · {STATUS_LABEL[r.status] ?? r.status}</p>
                </div>
                <p className="text-[13.5px] font-bold tabular-nums text-ink shrink-0">{r.amount.toLocaleString('ko-KR')}원</p>
              </div>
            ))}
            <div className="px-4 py-3 flex items-center justify-between bg-quiet">
              <span className="text-[13px] font-bold text-ink">합계</span>
              <span className="text-[14px] font-bold tabular-nums text-ink">{total.toLocaleString('ko-KR')}원</span>
            </div>
            {['paid', 'cancel_requested'].includes(rows[0].status) && (
              <div className="px-4 py-3 border-t border-rule">
                <button
                  onClick={() => void cancelOrder()}
                  disabled={cancelling}
                  className="w-full text-[13px] text-ink-soft rounded-control border border-rule py-2.5 bg-paper disabled:opacity-50 focus:outline-none focus-visible:shadow-ring"
                >
                  {cancelling ? '취소 처리 중…' : '주문 취소'}
                </button>
                <p className="mt-2 text-[11.5px] text-ink-faint leading-relaxed">
                  배송 전까지 직접 취소하실 수 있습니다. 배송이 시작된 뒤에는 고객센터(02-897-8287)로 연락해 주세요.
                  결제 후 시간이 많이 지난 주문은 결제사 정산 절차상 처리에 추가 시일이 걸릴 수 있으며, 이 경우 담당자가 바로 확인 후 안내드립니다.
                </p>
              </div>
            )}
            {cancelMsg && <p className="px-4 pb-3 text-[12.5px] text-signal-red leading-relaxed">{cancelMsg}</p>}
          </div>
        )}

        <p className="text-[12px] text-ink-faint leading-relaxed pt-2">
          문의: 02-897-8287 · beautyground.official@gmail.com{' '}
          <button onClick={() => navigate('/app/login')} className="text-ink underline underline-offset-2 focus:outline-none">
            회원 로그인
          </button>
        </p>
      </div>
    </AppFrame>
  )
}
