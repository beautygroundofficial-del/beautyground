import { supabase } from './supabase'

// 파트너스(개인 제휴 판매자) — supabase/affiliates.sql 과 짝.
// 진행자(host.ts)와 같은 결: 본인 레코드 조회는 getSession()(로컬)으로, 쓰기는 RLS/함수에 맡긴다.

export interface Affiliate {
  id: string
  user_id: string
  code: string
  name: string
  phone: string | null
  email: string | null
  bank_name: string | null
  bank_account: string | null
  bank_holder: string | null
  channel: string | null
  status: 'active' | 'suspended'
  created_at: string
}

export interface AffiliateLink {
  id: string
  affiliate_id: string
  product_id: string
  code: string
  clicks: number
  created_at: string
  product?: { name: string; thumbnail_url: string | null; price: number; sale_price: number | null } | null
}

export interface AffiliateSale {
  id: string
  payment_id: string
  product_id: string | null
  amount: number
  quantity: number
  status: string
  created_at: string
  affiliate_code: string
  product_name: string | null
  thumbnail_url: string | null
}

export interface AffiliateSummary {
  period: string
  total_sales: number
  order_count: number
  tier_name: string
  commission_rate: number
  estimated_commission: number
  next_tier_name: string | null
  next_tier_min_sales: number | null
  link_count: number
  click_count: number
}

export interface AffiliateSettlement {
  id: string
  period: string
  total_sales: number
  tier_name: string | null
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'paid'
  paid_at: string | null
}

export interface AffiliateTier { id: string; name: string; min_sales: number; commission_rate: number }

// 추적 링크로 들어온 방문을 기억해두는 키 — 결제 시 orders.affiliate_code 로 붙는다.
// 유효기간 7일(가정, 쿠팡파트너스는 24시간·다른 곳은 30일 — 대표님 결정으로 바꿀 수 있게 상수로).
const ATTRIB_KEY = 'bg_aff_v1'
export const AFFILIATE_ATTRIBUTION_DAYS = 7

export function storeAffiliateCode(code: string) {
  try {
    localStorage.setItem(ATTRIB_KEY, JSON.stringify({ code, exp: Date.now() + AFFILIATE_ATTRIBUTION_DAYS * 86400_000 }))
  } catch { /* 저장 불가 환경이면 귀속 없이 진행 */ }
}

export function getAffiliateCode(): string | null {
  try {
    const raw = localStorage.getItem(ATTRIB_KEY)
    if (!raw) return null
    const { code, exp } = JSON.parse(raw) as { code: string; exp: number }
    if (!code || Date.now() > exp) { localStorage.removeItem(ATTRIB_KEY); return null }
    return code
  } catch { return null }
}

export async function getMyAffiliate(): Promise<Affiliate | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null
  const { data } = await supabase.from('affiliates').select('*').eq('user_id', userId).maybeSingle()
  return (data as Affiliate | null) ?? null
}

// 셀러 코드: 영문소문자+숫자 6자(사람이 읽기 쉬운 것 우선, 충돌 시 재시도)
function randomCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  const buf = new Uint8Array(6)
  crypto.getRandomValues(buf)
  for (const b of buf) s += chars[b % chars.length]
  return s
}

export async function registerAffiliate(input: {
  name: string; phone: string; email: string | null; bank_name: string; bank_account: string; bank_holder: string; channel: string | null
}): Promise<{ ok: true; affiliate: Affiliate } | { ok: false; message: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return { ok: false, message: '로그인이 필요해요.' }
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from('affiliates')
      .insert({ user_id: userId, code: randomCode(), status: 'active', ...input })
      .select('*')
      .single()
    if (!error) return { ok: true, affiliate: data as Affiliate }
    if (/affiliates_code_key/i.test(error.message)) continue // 코드 충돌만 재시도
    if (/affiliates_user_id_key/i.test(error.message)) return { ok: false, message: '이미 가입되어 있어요.' }
    return { ok: false, message: error.message }
  }
  return { ok: false, message: '코드 생성에 실패했어요. 다시 시도해 주세요.' }
}

export async function updateAffiliate(id: string, patch: Partial<Pick<Affiliate, 'name' | 'phone' | 'email' | 'bank_name' | 'bank_account' | 'bank_holder' | 'channel'>>): Promise<string | null> {
  const { error } = await supabase.from('affiliates').update(patch).eq('id', id)
  return error ? error.message : null
}

// 상품 링크(또는 상품 id)에서 상품 id 추출 — /app/product/{uuid} 형태만 인정
export function parseProductIdFromUrl(input: string): string | null {
  const s = input.trim()
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  const m = s.match(/\/app\/product\/([0-9a-f-]{36})/i) ?? s.match(uuid)
  return m ? m[1].toLowerCase() : null
}

export function affiliateLinkUrl(code: string): string {
  return `${window.location.origin}/go/${code}`
}

export async function createAffiliateLink(productId: string): Promise<{ ok: true; link: AffiliateLink } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('create_affiliate_link', { p_product_id: productId })
  if (error) return { ok: false, message: error.message.replace(/^.*?: /, '') }
  return { ok: true, link: data as AffiliateLink }
}

export async function listMyLinks(): Promise<AffiliateLink[]> {
  const { data } = await supabase
    .from('affiliate_links')
    .select('*, product:products(name, thumbnail_url, price, sale_price)')
    .order('created_at', { ascending: false })
  return (data as AffiliateLink[] | null) ?? []
}

export async function trackAffiliateClick(code: string): Promise<string | null> {
  const ref = (() => { try { return document.referrer ? new URL(document.referrer).hostname : null } catch { return null } })()
  const device = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  const { data, error } = await supabase.rpc('track_affiliate_click', { p_code: code, p_referrer: ref, p_device: device })
  if (error) return null
  return (data as string | null) ?? null
}

export async function getMySummary(period?: string): Promise<AffiliateSummary | null> {
  const { data, error } = await supabase.rpc('my_affiliate_summary', period ? { p_period: period } : {})
  if (error) return null
  const row = (data as AffiliateSummary[] | null)?.[0]
  return row ?? null
}

export async function listMySales(limit = 50): Promise<AffiliateSale[]> {
  const { data } = await supabase.from('affiliate_sales_view').select('*').order('created_at', { ascending: false }).limit(limit)
  return (data as AffiliateSale[] | null) ?? []
}

export async function listMySettlements(): Promise<AffiliateSettlement[]> {
  const { data } = await supabase.from('affiliate_settlements').select('*').order('period', { ascending: false })
  return (data as AffiliateSettlement[] | null) ?? []
}

export async function getTiers(): Promise<AffiliateTier[]> {
  const { data } = await supabase.from('affiliate_tiers').select('*').order('min_sales', { ascending: true })
  return (data as AffiliateTier[] | null) ?? []
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기', paid: '결제 완료', shipped: '배송 중', done: '구매 확정', cancelled: '취소', refunded: '환불',
}

// 잘 팔리는 제품(파트너스 추천) — supabase partner_best_products(): 최근 90일 결제완료 이상 판매 수량 순
export interface BestProduct {
  id: string
  name: string
  thumbnail_url: string | null
  price: number
  sale_price: number | null
  sold_qty: number
  rank: number
}

export async function listBestProducts(limit = 10, offset = 0): Promise<BestProduct[]> {
  const { data, error } = await supabase.rpc('partner_best_products', { p_limit: limit, p_offset: offset })
  if (error) return []
  return (data as BestProduct[] | null) ?? []
}
