import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const SUPA = 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const KEY = 'sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'

// 제품명 정규화: 브랜드 접미사·괄호·공백 제거 후 비교용
function norm(s) {
  return s
    .replace(/\s*-\s*메이크업헬퍼$/, '')
    .replace(/\s*-\s*커밍글$/, '')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

async function searchMall(page, mallBase, name) {
  const q = encodeURIComponent(norm(name))
  const url = `${mallBase}/product/search.html?keyword=${q}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(900)
  return page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/product/"]'))
    const seen = new Set()
    return links
      .map((a) => ({ href: a.href, text: (a.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter((x) => x.text && /\/product\/[^/]+\/\d+\//.test(x.href))
      .filter((x) => { if (seen.has(x.href)) return false; seen.add(x.href); return true })
  })
}

async function pageTitle(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(500)
  return page.evaluate(() => {
    const og = document.querySelector('meta[property="og:title"]')?.content
    return (og || document.title || '').replace(/\s+/g, ' ').trim()
  })
}

async function login() {
  const r = await fetch(SUPA + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test3@test.com', password: 'test1234' }),
  })
  return (await r.json()).access_token
}

const token = await login()
const r = await fetch(SUPA + '/rest/v1/products?select=id,name,thumbnail_url&source_url=is.null', {
  headers: { apikey: KEY, Authorization: 'Bearer ' + token },
})
const rows = await r.json()
const targets = rows
  .filter((p) => (p.thumbnail_url || '').includes('ecimg.cafe24img.com'))
  .map((p) => ({ ...p, mall: p.thumbnail_url.includes('dsbkorea2') ? 'https://makeuphelper.co.kr' : 'https://cominglebeauty.com' }))

console.log(`대상 ${targets.length}개 (makeuphelper ${targets.filter(t=>t.mall.includes('makeuphelper')).length} / comingle ${targets.filter(t=>t.mall.includes('comingle')).length})`)

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ locale: 'ko-KR' })).newPage()
page.setDefaultTimeout(25000)

const resolved = []
const unresolved = []

for (let i = 0; i < targets.length; i++) {
  const t = targets[i]
  try {
    const cands = await searchMall(page, t.mall, t.name)
    if (cands.length === 0) { unresolved.push({ ...t, reason: '검색결과0' }); console.log(`(${i+1}/${targets.length}) ${t.name} — 검색결과 없음`); continue }
    // 1) 검색결과 텍스트가 정규화된 이름과 완전 일치하는 것 우선
    const nName = norm(t.name)
    let best = cands.find((c) => norm(c.text) === nName)
    // 2) 없으면 서로 포함관계인 것 중 텍스트 길이가 가장 가까운 것
    if (!best) {
      const contain = cands.filter((c) => norm(c.text).includes(nName) || nName.includes(norm(c.text)))
      if (contain.length > 0) {
        best = contain.sort((a, b) => Math.abs(norm(a.text).length - nName.length) - Math.abs(norm(b.text).length - nName.length))[0]
      }
    }
    if (!best) { unresolved.push({ ...t, reason: '일치후보없음', cands: cands.slice(0,3).map(c=>c.text) }); console.log(`(${i+1}/${targets.length}) ${t.name} — 일치 후보 없음 (검색${cands.length}건)`); continue }
    // 3) 실제 상세페이지 방문해 제목 재확인 (교차검증)
    const title = await pageTitle(page, best.href)
    const match = norm(title) === nName || norm(title).includes(nName) || nName.includes(norm(title))
    if (!match) { unresolved.push({ ...t, reason: '상세제목불일치', found: title, url: best.href }); console.log(`(${i+1}/${targets.length}) ${t.name} — 상세 제목 불일치: "${title}"`); continue }
    resolved.push({ id: t.id, name: t.name, source_url: best.href })
    console.log(`(${i+1}/${targets.length}) ${t.name} — 확정: ${best.href}`)
  } catch (e) {
    unresolved.push({ ...t, reason: '에러', error: String(e.message || e).slice(0, 100) })
    console.log(`(${i+1}/${targets.length}) ${t.name} — 에러: ${String(e.message||e).slice(0,80)}`)
  }
}

await browser.close()
console.log(`\n=== 완료: 확정 ${resolved.length} / 미확정 ${unresolved.length} ===`)
writeFileSync('resolved-urls.json', JSON.stringify(resolved, null, 1))
writeFileSync('unresolved-urls.json', JSON.stringify(unresolved, null, 1))
