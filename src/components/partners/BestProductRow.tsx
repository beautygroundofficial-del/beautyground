import { useState } from 'react'
import { won } from '../../lib/format'
import { affiliateLinkUrl, createAffiliateLink, type BestProduct } from '../../lib/affiliate'
import { copyText } from '../../pages/partners/AppPartnersHome'

// 잘 팔리는 제품 한 줄 — 순위·썸네일·이름·가격·판매수 + [내 링크] 버튼(누르면 링크 생성 후 바로 복사)
export default function BestProductRow({ p, onToast, onMade }: { p: BestProduct; onToast: (m: string) => void; onMade?: () => void }) {
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const price = p.sale_price ?? p.price

  const make = async () => {
    if (busy) return
    if (code) { if (await copyText(affiliateLinkUrl(code))) onToast('링크를 복사했어요'); return }
    setBusy(true)
    const res = await createAffiliateLink(p.id)
    setBusy(false)
    if (!res.ok) { onToast(res.message); return }
    setCode(res.link.code)
    onMade?.()
    if (await copyText(affiliateLinkUrl(res.link.code))) onToast('내 링크를 만들고 복사했어요')
    else onToast('내 링크를 만들었어요')
  }

  return (
    <li className="py-2.5 flex items-center gap-3">
      <span className={`shrink-0 w-6 text-center text-[13px] font-bold tabular-nums ${p.rank <= 3 ? 'text-ink' : 'text-ink-faint'}`}>{p.rank}</span>
      {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-11 h-11 rounded-lg object-cover bg-quiet shrink-0" /> : <div className="w-11 h-11 rounded-lg bg-quiet shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-ink truncate">{p.name}</p>
        <p className="text-[12px] text-ink-faint">{won(price)}{p.sold_qty > 0 ? ` · ${p.sold_qty}개 판매` : ''}</p>
      </div>
      <button type="button" onClick={() => void make()} disabled={busy}
        className={`shrink-0 text-[12.5px] font-semibold rounded-control px-3 py-1.5 whitespace-nowrap disabled:opacity-50 ${code ? 'border border-rule text-ink' : 'bg-ink text-paper'}`}>
        {busy ? '…' : code ? '복사' : '내 링크'}
      </button>
    </li>
  )
}
