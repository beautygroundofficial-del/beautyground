import { Link, useNavigate } from 'react-router-dom'
import ImagePlaceholder from '../common/ImagePlaceholder'
import DesktopHeader from '../layout/DesktopHeader'
import type { Order } from '../../lib/types'

interface OrderRow extends Order {
  products?: { name: string | null; thumbnail_url: string | null } | null
}

interface OrderGroup {
  paymentId: string
  createdAt: string
  status: Order['status']
  items: OrderRow[]
  shippingFee: number
  total: number
  trackingNumber: string | null
  trackingCarrier: string | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  paid: { label: '결제완료', cls: 'bg-ink text-paper' },
  shipped: { label: '배송중', cls: 'bg-ink text-paper' },
  done: { label: '배송완료', cls: 'bg-quiet text-ink-soft' },
  cancelled: { label: '취소됨', cls: 'bg-quiet text-ink-faint' },
  cancel_requested: { label: '취소 요청됨', cls: 'bg-paper text-signal-red border border-signal-red' },
}

interface Props {
  loggedIn: boolean
  groups: OrderGroup[]
  msg: string
  cancelling: string | null
  onRequestCancel: (g: OrderGroup) => void
}

// PC 버전 — 주문 카드를 넓은 폭으로, 나머지 구조·문구는 모바일과 동일하게 유지.
export default function DesktopOrders({ loggedIn, groups, msg, cancelling, onRequestCancel }: Props) {
  const navigate = useNavigate()

  return (
    <div className="bg-paper min-h-screen">
      <DesktopHeader />

      <div className="max-w-[1280px] mx-auto px-6 py-10">
        <h1 className="text-[22px] font-bold text-ink mb-8">주문 내역</h1>

        {!loggedIn ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
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
        ) : (
          <>
            {msg && (
              <div className="mb-4 bg-paper border border-signal-red text-signal-red text-[12.5px] rounded-control px-4 py-3">{msg}</div>
            )}

            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-[15px] text-ink font-bold mb-2">아직 주문 내역이 없어요</p>
                <p className="text-[13px] text-ink-faint mb-6">마음에 드는 상품을 찾아보세요.</p>
                <button onClick={() => navigate('/app/home')} className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3.5 focus:outline-none focus-visible:shadow-ring">
                  쇼핑하러 가기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((g) => {
                  const badge = STATUS_BADGE[g.status] ?? STATUS_BADGE.paid
                  const d = new Date(g.createdAt)
                  const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
                  return (
                    <div key={g.paymentId} className="bg-paper border border-rule overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-rule">
                        <span className="text-[12.5px] text-ink-faint">{dateStr} 주문</span>
                        <span className={`text-[11.5px] font-bold px-2.5 py-1 rounded-control ${badge.cls}`}>{badge.label}</span>
                      </div>

                      <div className="divide-y divide-rule">
                        {g.items.map((it) => (
                          <Link
                            key={it.id}
                            to={it.product_id ? `/app/product/${it.product_id}` : '#'}
                            className="flex items-center gap-3 px-5 py-3 focus:outline-none focus-visible:shadow-ring"
                          >
                            <div className="w-16 h-16 bg-quiet overflow-hidden shrink-0">
                              {it.products?.thumbnail_url ? (
                                <img src={it.products.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <ImagePlaceholder />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[14px] text-ink truncate">{it.products?.name ?? it.order_name ?? '상품'}</p>
                              <p className="text-[12.5px] text-ink-faint mt-0.5 tabular-nums">
                                {it.quantity}개 · {it.amount.toLocaleString('ko-KR')}원
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>

                      <div className="px-5 py-3 bg-quiet border-t border-rule">
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
                            {g.trackingCarrier ? `${g.trackingCarrier} ` : ''}운송장 <b className="select-all">{g.trackingNumber}</b>
                          </p>
                        )}

                        {['paid', 'cancel_requested'].includes(g.status) && (
                          <>
                            <button
                              onClick={() => onRequestCancel(g)}
                              disabled={cancelling === g.paymentId}
                              className="mt-3 rounded-control border border-rule py-2.5 px-6 text-[13px] text-ink-soft bg-paper disabled:opacity-50 focus:outline-none focus-visible:shadow-ring"
                            >
                              {cancelling === g.paymentId ? '취소 처리 중…' : '주문 취소'}
                            </button>
                            <p className="mt-2 text-[11.5px] text-ink-faint leading-relaxed">
                              배송 전까지 바로 취소하실 수 있습니다. 카드 취소 반영은 카드사에 따라 3~5영업일이 걸릴 수 있습니다.
                              결제 후 시간이 많이 지난 주문은 결제사 정산 절차상 처리에 추가 시일이 걸릴 수 있으며, 이 경우 담당자가 바로 확인 후 안내드립니다.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
