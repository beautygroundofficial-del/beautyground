import { chromium } from 'playwright'
import { readFileSync, writeFileSync, appendFileSync } from 'fs'

const SUPA = 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const KEY = 'sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const CAP = 50
const LOG = 'batch-crema.log'
const log = (m) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(line); try { appendFileSync(LOG, line + '\n') } catch {} }

async function login() {
  const r = await fetch(SUPA + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test3@test.com', password: 'test1234' }),
  })
  return (await r.json()).access_token
}
async function patchProduct(token, id, payload) {
  const r = await fetch(SUPA + '/rest/v1/products?id=eq.' + id, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error('patch ' + r.status + ' ' + (await r.text()).slice(0, 120))
}

// CREMA 토큰 1회 획득 (몰 도메인당 1번, 이후 fetch로 전 상품 재사용)
async function getCremaToken(sampleProductUrl) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 1600 } })).newPage()
  let captured = null
  page.on('request', (r) => { const u = r.url(); if (!captured && u.includes('review3.cre.ma/api/') && u.includes('/reviews?')) captured = u })
  await page.goto(sampleProductUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(200) }
  await page.waitForTimeout(2000)
  await browser.close()
  if (!captured) return null
  const u = new URL(captured)
  return { mallDomain: u.pathname.split('/')[2], token: u.searchParams.get('secure_device_token') }
}

// URL에서 cafe24 product_code(경로의 숫자 세그먼트) 추출
function extractProductCode(url) {
  const m = url.match(/\/(\d+)\/category\//)
  return m ? m[1] : null
}

async function fetchCremaReviews(mallDomain, token, productCode, cap) {
  const url = `https://review3.cre.ma/api/${mallDomain}/reviews?secure_device_token=${token}&product_code=${productCode}&widget_id=2&widget_style=list_v3&iframe=1&locale=ko-KR&app=0&page=1&per=${cap}`
  const res = await fetch(url, { headers: { Referer: `https://${mallDomain.replace('.cafe24.com', '')}.co.kr/` } })
  if (!res.ok) throw new Error('crema api ' + res.status)
  const j = await res.json()
  const reviews = (j.reviews || []).map((r) => ({
    rating: r.score ?? 5,
    text: (r.filtered_message || '').trim(),
    photo: r.images?.[0]?.url ?? null,
    photos: r.images?.length ? r.images.map((im) => im.url) : undefined,
    date: r.created_at ? r.created_at.slice(0, 10) : null,
    author: r.user_display_name || null,
  }))
  const count = j.reviews?.[0]?.product_meta_reviews_count ?? reviews.length
  const avgScore = j.reviews?.[0]?.product_meta_score ?? null
  return { count, avg: avgScore, reviews }
}

const token = await login()
const resolved = JSON.parse(readFileSync('resolved-urls.json', 'utf8'))
resolved.push({
  id: 'b0e5b850-be13-4f6c-ab17-5be47a46e902',
  name: '커밍글 원케어 퍼퓸 데일리 스칼프 탈모 샴푸 500ml',
  source_url: 'https://cominglebeauty.com/product/%EC%BB%A4%EB%B0%8D%EA%B8%80-%EC%9B%90%EC%BC%80%EC%96%B4-%ED%8D%BC%ED%93%B8-%EB%8D%B0%EC%9D%BC%EB%A6%AC-%EC%8A%A4%EC%B9%BC%ED%94%84-%ED%83%88%EB%AA%A8-%EC%83%B4%ED%91%B8/9/category/29/display/1/',
})

// 몰별로 그룹핑 (makeuphelper vs comingle)
const makeuphelper = resolved.filter((r) => r.source_url.includes('makeuphelper.co.kr'))
const comingle = resolved.filter((r) => r.source_url.includes('cominglebeauty.com'))
log(`makeuphelper ${makeuphelper.length}개 / comingle ${comingle.length}개`)

writeFileSync(LOG, '')
const results = []

// 1) makeuphelper: CREMA API 재사용
log('makeuphelper CREMA 토큰 획득 중...')
const mhToken = await getCremaToken(makeuphelper[0].source_url)
if (!mhToken) { log('토큰 획득 실패 — 중단'); process.exit(1) }
log(`토큰 획득: mall=${mhToken.mallDomain}`)

for (let i = 0; i < makeuphelper.length; i++) {
  const t = makeuphelper[i]
  try {
    await patchProduct(token, t.id, { source_url: t.source_url })
    const code = extractProductCode(t.source_url)
    const s = await fetchCremaReviews(mhToken.mallDomain, mhToken.token, code, CAP)
    const reviews = s.reviews.filter((r) => (r.text && r.text.length > 1) || r.photo)
    const withText = reviews.filter((r) => r.text && r.text.length > 1).length
    const withPhoto = reviews.filter((r) => r.photo).length
    const photos = reviews.filter((r) => r.photo).slice(0, 12)
      .map((r) => ({ url: r.photo, text: r.text || '', rating: r.rating, author: r.author, date: r.date }))
    const review_summary = { count: s.count, avg: s.avg, photos }
    await patchProduct(token, t.id, { scraped_reviews: reviews, review_summary })
    results.push({ id: t.id, name: t.name, count: s.count, collected: reviews.length, withText, withPhoto })
    log(`(${i + 1}/${makeuphelper.length}) ${t.name} — 총${s.count} 수집${reviews.length} 본문${withText} 사진${withPhoto}`)
  } catch (e) {
    results.push({ id: t.id, name: t.name, error: String(e.message || e).slice(0, 120) })
    log(`(${i + 1}/${makeuphelper.length}) ${t.name} — 실패: ${String(e.message || e).slice(0, 80)}`)
  }
  writeFileSync('batch-crema-result.json', JSON.stringify(results, null, 1))
}

log(`\n=== makeuphelper 완료 ===`)
writeFileSync('batch-crema-result.json', JSON.stringify(results, null, 1))
writeFileSync('comingle-pending.json', JSON.stringify(comingle, null, 1))
