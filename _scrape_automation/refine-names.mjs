import { chromium } from 'playwright'
import fs from 'fs'

const items = JSON.parse(fs.readFileSync('products.json', 'utf8'))
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'ko-KR' })
const page = await ctx.newPage()

const clean = []
for (const it of items) {
  try {
    await page.goto(it.url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    const info = await page.evaluate(() => {
      const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title
      const price = document.querySelector('#span_product_price_text')?.textContent
        || document.querySelector('[id*="product_price"]')?.textContent || ''
      const sold = /품절|sold\s*out/i.test(document.body.innerText.slice(0, 4000))
      return { title: (title || '').trim(), price: (price || '').replace(/\s+/g, ' ').trim(), sold }
    })
    // 사이트명 꼬리 제거
    const name = info.title.split(/\s+[-|–—]\s+/)[0].trim()
    clean.push({ no: it.no, url: it.url, name, price: info.price, sold: info.sold })
    console.log(`[${it.no}] ${name}  ${info.price}${info.sold ? '  (품절)' : ''}`)
  } catch (e) {
    console.log(`[${it.no}] 실패: ${e.message}`)
  }
}
fs.writeFileSync('products-clean.json', JSON.stringify(clean, null, 2), 'utf8')
console.log('\n정제 완료:', clean.length, '개 → products-clean.json')
await browser.close()
