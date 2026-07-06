import { chromium } from 'playwright'
import fs from 'fs'

const BASE = 'https://www.petitfee.com'
const CATS = [
  { no: 24,  label: '아이패치' },
  { no: 123, label: '마스크팩/팩' },
  { no: 94,  label: '스킨케어' },
  { no: 93,  label: '바디케어' },
  { no: 116, label: '클렌저' },
  { no: 163, label: '기획 세트' },
]

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1360, height: 1100 } })
const page = await ctx.newPage()

async function scrapePage(cate, pno) {
  const url = `${BASE}/product/list.html?cate_no=${cate}&page=${pno}`
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(350) }
  return await page.evaluate(() => {
    const scope = document.querySelector('.xans-product-listnormal, .prdList') || document
    const out = []
    const seen = new Set()
    const lis = scope.querySelectorAll('li[id^="anchorBoxId_"], .prdList > li, ul > li')
    lis.forEach((li) => {
      const link = li.querySelector('a[href*="/product/"]')
      if (!link) return
      const href = link.getAttribute('href') || ''
      const m = href.match(/\/product\/[^/]+\/(\d+)\//)
      if (!m) return
      const no = m[1]
      if (seen.has(no)) return
      seen.add(no)
      const abs = href.startsWith('http') ? href : 'https://www.petitfee.com' + href
      let name = ''
      const nameEl = li.querySelector('.description .name a, .name a, p.name, .description .name')
      if (nameEl) name = nameEl.textContent
      if (!name) { const img = li.querySelector('img'); name = img?.getAttribute('alt') || '' }
      name = name.replace(/\[petitfee_이벤트\]/g, '').replace(/상품명\s*:/g, '').replace(/\s+/g, ' ').trim()
      const descText = (li.querySelector('.description')?.innerText || '')
      const pm = descText.match(/([\d,]+)\s*원/)
      const price = pm ? pm[1] + '원' : ''
      const soldout = /품절|SOLD\s*OUT/i.test(li.innerText)
      out.push({ no, url: abs, name, price, soldout })
    })
    const pager = document.querySelector('.xans-product-normalpaging, .ec-base-paginate, .board-paging')
    const pagerText = pager ? pager.innerText.replace(/\s+/g, ' ').trim() : ''
    const pageLinks = pager ? Array.from(pager.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(Boolean) : []
    return { items: out, pagerText, pageLinks }
  })
}

const result = {}
try {
  for (const cat of CATS) {
    const collected = new Map()
    let pno = 1, prevSig = ''
    let lastPager = ''
    while (pno <= 20) {
      const { items, pagerText, pageLinks } = await scrapePage(cat.no, pno)
      lastPager = pagerText
      const sig = items.map(i => i.no).sort().join(',')
      if (items.length === 0) break
      if (sig === prevSig) break
      prevSig = sig
      items.forEach(it => { if (!collected.has(it.no)) collected.set(it.no, it) })
      const hasNext = pageLinks.some(h => h.includes(`page=${pno + 1}`)) || new RegExp(`(^|\\D)${pno + 1}(\\D|$)`).test(pagerText)
      if (!hasNext) break
      pno++
    }
    const arr = [...collected.values()]
    result[cat.no] = { label: cat.label, pagesScanned: pno, pager: lastPager, count: arr.length, items: arr }
    console.log(`\n===== [${cat.no}] ${cat.label} : ${arr.length}개 (페이저 "${lastPager}", ${pno}페이지 스캔) =====`)
    arr.forEach((it, i) => console.log(`  ${String(i + 1).padStart(2)}. [${it.no}] ${it.name}${it.soldout ? ' (품절)' : ''}  ${it.price}`))
  }
  const total = Object.values(result).reduce((s, c) => s + c.count, 0)
  console.log(`\n########## 전체 카테고리 합계: ${total}개 ##########`)
  Object.entries(result).forEach(([no, c]) => console.log(`  [${no}] ${c.label}: ${c.count}개`))
  fs.writeFileSync('products-by-category.json', JSON.stringify(result, null, 2), 'utf8')
  console.log('\n저장: products-by-category.json')
} catch (e) {
  console.log('실패:', e.message)
  fs.writeFileSync('products-by-category.json', JSON.stringify(result, null, 2), 'utf8')
} finally {
  await browser.close()
}
