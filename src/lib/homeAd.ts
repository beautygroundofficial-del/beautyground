import { supabase } from './supabase'

export interface HomeAd {
  campaign_id: string
  campaign_name: string
  product_id: string
  product_name: string
  brand: string | null
  price: number
  sale_price: number | null
  thumbnail_url: string
  ends_at: string
  slot_at: string
  refresh_after_seconds: number
}

export type AdEvent = 'impression' | 'popup_open' | 'product_click'
export const HOME_AD_PILOT_PRODUCT = '1e6bcb09-4c8f-4cc7-af06-704653953a54'
export const isHomeAdPreview = () => import.meta.env.DEV && new URLSearchParams(location.search).get('homeAdPreview') === '1'

export async function getHomeAd(): Promise<HomeAd | null> {
  // Local review uses the real product, but never sends advertising events.
  if (isHomeAdPreview()) {
    const { data, error } = await supabase.from('products').select('id,name,brand,price,sale_price,thumbnail_url').eq('id', HOME_AD_PILOT_PRODUCT).eq('status', 'on_sale').maybeSingle()
    if (error || !data?.thumbnail_url) return null
    const slot = Math.floor(Date.now() / 3600000) * 3600000
    return { campaign_id: 'local-preview', campaign_name: '홈 상품 광고 자체 테스트', product_id: data.id, product_name: data.name, brand: data.brand, price: data.price, sale_price: data.sale_price, thumbnail_url: data.thumbnail_url, ends_at: new Date(slot + 3600000).toISOString(), slot_at: new Date(slot).toISOString(), refresh_after_seconds: (slot + 3600000 - Date.now()) / 1000 }
  }
  const { data, error } = await supabase.rpc('get_active_home_ad')
  if (error) return null
  return data?.[0] ?? null
}

let sessionId: string | null = null
let eventQueue: Promise<void> = Promise.resolve()
const recorded = new Set<string>()

// A random tab-session identifier, never an account, email or device fingerprint.
function getSessionId() {
  if (sessionId) return sessionId
  try {
    sessionId = sessionStorage.getItem('bg_home_ad_session')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem('bg_home_ad_session', sessionId)
    }
  } catch { sessionId = crypto.randomUUID() }
  return sessionId
}

export function trackHomeAd(ad: HomeAd, kind: AdEvent): Promise<void> {
  if (import.meta.env.DEV || ad.campaign_id === 'local-preview' || !location.pathname.startsWith('/app/')) return Promise.resolve()
  const key = `${ad.campaign_id}:${ad.product_id}:${ad.slot_at}:${kind}`
  // Serial requests preserve impression → popup → product-click ordering.
  eventQueue = eventQueue.catch(() => {}).then(async () => {
    if (recorded.has(key)) return
    const { data, error } = await supabase.rpc('record_home_ad_event', { p_campaign_id: ad.campaign_id, p_product_id: ad.product_id, p_slot_at: ad.slot_at, p_session_id: getSessionId(), p_kind: kind })
    if (!error && data === true) recorded.add(key)
  }).catch(() => { /* Advertising metrics must never block shopping. */ })
  return eventQueue
}
