import { chromium } from 'playwright'
import { writeFileSync, appendFileSync } from 'fs'
import { scrapeFullReviews } from './scrape-full-reviews.mjs'

const SUPA = 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const KEY = 'sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const CAP = 50
const CONCURRENCY = 3
const LOG = 'C:/Users/LIUCHE~1/AppData/Local/Temp/claude/C--Users-Liu-ChengBao/0c459744-dc6d-4e4d-a0df-fba0e1c99827/scratchpad/pwtest/batch-reviews.log'
const OUT = 'C:/Users/LIUCHE~1/AppData/Local/Temp/claude/C--Users-Liu-ChengBao/0c459744-dc6d-4e4d-a0df-fba0e1c99827/scratchpad/pwtest/batch-reviews-result.json'

const log = (m) => { const line = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(line); try { appendFileSync(LOG, line + '\n') } catch {} }

// 1) 로그인
async function login() {
  const r = await fetch(SUPA + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test3@test.com', password: 'test1234' }),
  })
  const a = await r.json()
  if (!a.access_token) throw new Error('login fail: ' + JSON.stringify(a).slice(0, 150))
  return a.access_token
}

// 2) 대상 제품
async function loadProducts(token) {
  const r = await fetch(SUPA + '/rest/v1/products?select=id,name,source_url,review_summary&source_url=not.is.null&order=name', {
    headers: { apikey: KEY, Authorization: 'Bearer ' + token },
  })
  return r.json()
}

// 3) 저장
async function patchProduct(token, id, payload) {
  const r = await fetch(SUPA + '/rest/v1/products?id=eq.' + id, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error('patch ' + r.status + ' ' + (await r.text()).slice(0, 120))
}

let token = await login()
const products = await loadProducts(token)
writeFileSync(LOG, '')
log(`대상 제품 ${products.length}개, CAP=${CAP}, 동시성=${CONCURRENCY}`)

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const results = []
let idx = 0
let done = 0
const tStart = Date.now()

async function worker(wid) {
  const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 1600 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(30000)
  while (true) {
    const i = idx++
    if (i >= products.length) break
    const p = products[i]
    const prevCount = (p.review_summary && p.review_summary.count) || 0
    try {
      if (prevCount === 0) {
        // 리뷰 없음: scraped_reviews 비우기(있던 잔여 정리)
        await patchProduct(token, p.id, { scraped_reviews: [] })
        results.push({ id: p.id, name: p.name, count: 0, collected: 0, withText: 0, withPhoto: 0 })
        done++; log(`(${done}/${products.length}) [w${wid}] ${p.name} — 리뷰0 스킵`)
        continue
      }
      const s = await scrapeFullReviews(page, p.source_url, { cap: CAP })
      const reviews = s.reviews.filter(r => (r.text && r.text.length > 1) || r.photo) // 완전 빈 리뷰 제외
      const withText = reviews.filter(r => r.text && r.text.length > 1).length
      const withPhoto = reviews.filter(r => r.photo).length
      // 사진 리뷰 → review_summary.photos (미리보기 위젯용, 최대 12)
      const photos = reviews.filter(r => r.photo)
        .slice(0, 12)
        .map(r => ({ url: r.photo, text: r.text || '', rating: r.rating, author: r.author, date: r.date }))
      const review_summary = { count: s.count, avg: s.avg, photos }
      await patchProduct(token, p.id, { scraped_reviews: reviews, review_summary })
      results.push({ id: p.id, name: p.name, count: s.count, collected: reviews.length, withText, withPhoto })
      done++; log(`(${done}/${products.length}) [w${wid}] ${p.name} — 총${s.count} 수집${reviews.length} 본문${withText} 사진${withPhoto}`)
    } catch (e) {
      results.push({ id: p.id, name: p.name, error: String(e.message || e).slice(0, 120) })
      done++; log(`(${done}/${products.length}) [w${wid}] ${p.name} — 실패: ${String(e.message || e).slice(0, 80)}`)
    }
    writeFileSync(OUT, JSON.stringify(results, null, 1))
  }
  await ctx.close()
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, w) => worker(w + 1)))
await browser.close()

const ok = results.filter(r => !r.error)
const fail = results.filter(r => r.error)
const totalReviews = ok.reduce((s, r) => s + (r.collected || 0), 0)
log(`\n=== 완료 (${Math.round((Date.now() - tStart) / 1000)}초) ===`)
log(`성공 ${ok.length} / 실패 ${fail.length} | 저장된 실제 리뷰 총 ${totalReviews}개`)
if (fail.length) log('실패목록: ' + fail.map(f => f.name).join(', '))
writeFileSync(OUT, JSON.stringify(results, null, 1))
log('결과 저장: ' + OUT)
