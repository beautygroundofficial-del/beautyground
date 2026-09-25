import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import SellerGate from '../../components/seller/SellerGate'
import { won } from '../../lib/format'
import { affiliateLinkUrl, listMyLinks, type AffiliateLink } from '../../lib/affiliate'
import { copyText } from './AppSeller'

// 내 링크 전체 — 클릭 수와 함께. 복사/공유만(삭제는 두지 않는다 — 이미 퍼진 링크가 죽으면 손님이 당황).
export default function AppSellerLinks() {
  const navigate = useNavigate()
  const [links, setLinks] = useState<AffiliateLink[]>([])
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }
  useEffect(() => { void listMyLinks().then(setLinks) }, [])

  return (
    <SellerGate title="내 링크">
      {() => (
        <AppFrame>
          <BackHeader title="내 링크" onBack={() => navigate('/app/seller')} />
          <section className="px-5 pt-4 pb-10">
            {links.length === 0 ? (
              <p className="text-[13px] text-ink-faint py-6 text-center">아직 만든 링크가 없어요.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {links.map((l) => {
                  const price = l.product ? (l.product.sale_price ?? l.product.price) : null
                  return (
                    <li key={l.id} className="py-3.5">
                      <div className="flex items-center gap-3">
                        {l.product?.thumbnail_url ? (
                          <img src={l.product.thumbnail_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-quiet shrink-0" />
                        ) : <div className="w-12 h-12 rounded-lg bg-quiet shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] text-ink truncate">{l.product?.name ?? '상품'}</p>
                          <p className="text-[12px] text-ink-faint">{price != null ? won(price) : ''} · 클릭 {l.clicks}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <p className="flex-1 min-w-0 text-[12px] text-ink-soft truncate">{affiliateLinkUrl(l.code)}</p>
                        <button type="button" onClick={async () => { if (await copyText(affiliateLinkUrl(l.code))) showToast('링크를 복사했어요') }} className="shrink-0 text-[12.5px] font-semibold text-ink border border-rule rounded-control px-3 py-1.5">복사</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>}
        </AppFrame>
      )}
    </SellerGate>
  )
}
