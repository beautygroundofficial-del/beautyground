import { useEffect, useState } from 'react'
import { IconReceipt } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner } from '../../lib/types'
import { won, formatDateTime } from '../../lib/format'

// 브랜드 셀러센터 — 주문내역 (2026-09-11, 읽기 전용)
// get_my_orders() RPC(supabase/brand_orders_view.sql)로만 조회한다 — 구매자명·연락처·배송지 등
// 개인정보는 그 RPC가 애초에 반환하지 않으므로 여기서도 다룰 수 없다(설계로 차단).
// 우리 몰 주문은 매장이 CJ택배로 직접 발송하므로, 브랜드는 송장 입력 없이 판매 현황만 확인한다.

interface MyOrderRow {
  id: string
  product_id: string
  product_name: string
  quantity: number
  amount: number
  option_label: string | null
  status: string
  tracking_carrier: string | null
  shipping_status: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  paid: { text: '결제완료', cls: 'bg-[#E1F1FF] text-[#0B5FA5]' },
  shipped: { text: '배송중', cls: 'bg-[#F3F1ED] text-[#6b6355]' },
  done: { text: '배송완료', cls: 'bg-[#eaf3ec] text-[#2f7d5b]' },
  cancelled: { text: '취소', cls: 'bg-[#F3F1ED] text-[#9a9080]' },
  cancel_requested: { text: '취소요청', cls: 'bg-[#FBEAEA] text-[#a32118]' },
}

const card = 'bg-white rounded-[14px] border border-[#e5e0d8]'

export default function BrandOrders() {
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [orders, setOrders] = useState<MyOrderRow[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const p = await getMyPartner()
      if (!active) return
      setPartner(p)
      if (!p) { setLoading(false); return }
      const { data, error } = await supabase.rpc('get_my_orders')
      if (!active) return
      if (error) setErr(error.message)
      setOrders((data ?? []) as MyOrderRow[])
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

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

  const totalQty = orders.reduce((s, o) => s + o.quantity, 0)
  const totalAmount = orders.reduce((s, o) => s + o.amount, 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={`${card} p-5`}>
          <p className="text-[12px] text-[#9a9080] mb-1">누적 판매 수량</p>
          <p className="text-[20px] font-bold text-[#111]">{totalQty.toLocaleString('ko-KR')}개</p>
        </div>
        <div className={`${card} p-5`}>
          <p className="text-[12px] text-[#9a9080] mb-1">누적 판매 금액</p>
          <p className="text-[20px] font-bold text-[#111]">{won(totalAmount)}</p>
        </div>
      </div>

      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[14px] font-bold text-[#111]">주문내역</h2>
          <span className="text-[12px] text-[#9a9080]">{orders.length}건</span>
        </div>

        {err && <p className="text-[13px] text-[#a32118] mb-3">{err}</p>}

        {orders.length === 0 ? (
          <div className="text-center py-10">
            <IconReceipt size={30} className="text-[#e5e0d8] mx-auto mb-2" />
            <p className="text-[13px] text-[#9a9080]">아직 주문이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] text-[#9a9080] border-b border-[#efeae1]">
                  <th className="py-2 pr-3 font-medium">주문일시</th>
                  <th className="py-2 pr-3 font-medium">상품</th>
                  <th className="py-2 pr-3 font-medium">옵션</th>
                  <th className="py-2 pr-3 font-medium text-right">수량</th>
                  <th className="py-2 pr-3 font-medium text-right">금액</th>
                  <th className="py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const badge = STATUS_LABEL[o.status] ?? { text: o.status, cls: 'bg-[#F3F1ED] text-[#9a9080]' }
                  return (
                    <tr key={o.id} className="border-b border-[#f3f0ea]">
                      <td className="py-2.5 pr-3 text-[#6b6355] whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                      <td className="py-2.5 pr-3 text-[#111] font-medium max-w-[220px] truncate">{o.product_name}</td>
                      <td className="py-2.5 pr-3 text-[#9a9080]">{o.option_label ?? '-'}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{o.quantity}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-[#111]">{won(o.amount)}</td>
                      <td className="py-2.5">
                        <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.text}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-5 pt-4 border-t border-[#efeae1] text-[12px] text-[#9a9080] leading-relaxed">
          배송은 뷰티그라운드 매장에서 직접 처리합니다. 구매자 개인정보(이름·연락처·배송지)는
          보호를 위해 이 화면에 표시되지 않습니다.
        </p>
      </div>
    </>
  )
}
