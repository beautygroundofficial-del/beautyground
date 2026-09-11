import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Live } from '../lib/types'
import AppHeader from '../components/layout/AppHeader'
import AppFrame from '../components/layout/AppFrame'
import AppFooter from '../components/layout/AppFooter'
import PromoBar from '../components/home/PromoBar'
import { formatDateOnly, dateKey, formatLiveSchedTime } from '../lib/format'

// /live/schedule — 라이브 메인 "LIVE 예고 → 전체보기" 목적지. 예정된 방송 전체를 날짜별로 묶어
// 보여준다. 카드 한 줄의 생김새(썸네일·시간·브랜드핑크·설명)는 LiveMain 예고 섹션과 동일.
export default function LiveSchedule() {
  const [scheduled, setScheduled] = useState<Live[]>([])
  const [brandNames, setBrandNames] = useState<Record<string, string>>({})
  const [hostNames, setHostNames] = useState<Record<string, string>>({})
  const [primaryProducts, setPrimaryProducts] = useState<Record<string, { name: string; thumbnail_url: string | null; partner_id: string | null }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data } = await supabase.from('lives').select('*').eq('status', 'scheduled')
        .not('title', 'ilike', '호스트검증방송%').order('scheduled_at', { ascending: true, nullsFirst: false })
      if (!active) return
      const list = (data ?? []) as Live[]
      setScheduled(list)

      const hostIds = Array.from(new Set(list.map((l) => l.host_id).filter((id): id is string => Boolean(id))))
      if (hostIds.length > 0) {
        const { data: hostsData } = await supabase.from('hosts').select('id, name').in('id', hostIds)
        if (active && hostsData) setHostNames(Object.fromEntries(hostsData.map((h) => [h.id, h.name])))
      }

      const primaryIdByLive: Record<string, string> = {}
      list.forEach((l) => {
        const pid = l.highlight_product_id || l.product_ids?.[0]
        if (pid) primaryIdByLive[l.id] = pid
      })
      const productIds = Array.from(new Set(Object.values(primaryIdByLive)))
      if (productIds.length > 0) {
        const { data: productsData } = await supabase.from('products')
          .select('id, name, thumbnail_url, partner_id').in('id', productIds)
        if (active && productsData) {
          const byId = Object.fromEntries(productsData.map((p) => [p.id, p]))
          const map: typeof primaryProducts = {}
          Object.entries(primaryIdByLive).forEach(([liveId, pid]) => {
            const p = byId[pid]
            if (p) map[liveId] = p
          })
          setPrimaryProducts(map)

          const partnerIds = Array.from(new Set(productsData.map((p) => p.partner_id).filter((v): v is string => Boolean(v))))
          if (partnerIds.length > 0) {
            const { data: brandRows } = await supabase.from('partner_brands').select('id, brand_name').in('id', partnerIds)
            if (active && brandRows) setBrandNames(Object.fromEntries(brandRows.map((b) => [b.id, b.brand_name])))
          }
        }
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const groups: { key: string; label: string; items: Live[] }[] = []
  scheduled.forEach((l) => {
    const key = dateKey(l.scheduled_at)
    let g = groups.find((x) => x.key === key)
    if (!g) {
      g = { key, label: formatDateOnly(l.scheduled_at), items: [] }
      groups.push(g)
    }
    g.items.push(l)
  })

  return (
    <AppFrame>
      <PromoBar />
      <AppHeader promoBarAbove />
      <main className="bg-white pb-2 px-4">
        <div className="pt-5 mb-4">
          <h1 className="text-base font-bold text-black">LIVE 예고 전체보기</h1>
        </div>
        {loading ? (
          <p className="text-[13px] text-[#666666] py-8 text-center">불러오는 중…</p>
        ) : groups.length === 0 ? (
          <p className="text-[13px] text-[#666666] py-8 text-center">예정된 방송이 없습니다.</p>
        ) : (
          groups.map((g) => (
            <section key={g.key} className="mb-7">
              <h2 className="text-sm font-bold text-black mb-3">{g.label}</h2>
              <ul className="flex flex-col gap-6">
                {g.items.map((live) => {
                  const product = primaryProducts[live.id]
                  const brand = product?.partner_id ? brandNames[product.partner_id] : ''
                  const channel = (live.host_id ? hostNames[live.host_id] : '') || brand
                  const thumb = product?.thumbnail_url ?? live.thumbnail_url
                  return (
                    <li key={live.id}>
                      <Link to={`/app/live/${live.id}`} className="flex items-center gap-3 focus:outline-none focus-visible:shadow-ring">
                        {thumb ? (
                          <img src={thumb} alt={channel || live.title} className="w-16 h-16 rounded-lg object-cover bg-bg-card border border-card-border shrink-0" />
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-bg-card border border-card-border shrink-0 flex items-center justify-center">
                            <img src="/images/bg-logo-mark.png" alt="" className="w-6 h-6 object-contain opacity-40" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-[#666666]">{formatLiveSchedTime(live.scheduled_at)}</p>
                          <p className="text-sm font-bold text-brand-pink mt-1 truncate">{channel || live.title}</p>
                          <p className="text-xs text-[#666666] mt-1 truncate">{live.title}</p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </main>
      <AppFooter />
    </AppFrame>
  )
}
