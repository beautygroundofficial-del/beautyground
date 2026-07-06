import { chromium } from 'playwright'

const LIST_URL = 'https://www.petitfee.com/product/list.html?cate_no=24'

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1360, height: 1100 } })
const page = await ctx.newPage()
try {
  await page.goto(LIST_URL, { waitUntil: 'networkidle', timeout: 40000 })
  await page.waitForTimeout(2000)
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(500) }

  const items = await page.evaluate(() => {
    const map = new Map()
    document.querySelectorAll('a[href*="/product/"]').forEach((a) => {
      const href = a.getAttribute('href') || ''
      const m = href.match(/\/product\/[^/]+\/(\d+)\//)
      if (!m) return
      const no = m[1]
      const abs = href.startsWith('http') ? href : 'https://www.petitfee.com' + href
      let name = (a.textContent || '').replace(/\s+/g, ' ').trim()
      if (!name) { const img = a.querySelector('img'); name = img?.getAttribute('alt') || '' }
      const prev = map.get(no)
      if (!prev) map.set(no, { no, url: abs, name })
      else if (!prev.name && name) prev.name = name
    })
    return Array.from(map.values())
  })
  console.log('총 제품 수:', items.length)
  items.forEach((it, i) => console.log(`${i + 1}. [${it.no}] ${it.name || '(이름미상)'}`))
  // 파일로 저장
  const fs = await import('fs')
  fs.writeFileSync('products.json', JSON.stringify(items, null, 2), 'utf8')
  console.log('저장: products.json')
} catch (e) {
  console.log('실패:', e.message)
} finally {
  await browser.close()
}
