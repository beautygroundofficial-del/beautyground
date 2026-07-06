import { chromium } from 'playwright'

const url = process.argv[2] || 'https://smartstore.naver.com/rociocosmetic/products/13233213823'

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
})
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  viewport: { width: 1280, height: 900 },
})
// 봇 탐지 회피: navigator.webdriver 제거
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
})
const page = await ctx.newPage()

try {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  console.log('HTTP status:', resp ? resp.status() : 0)
  await page.waitForTimeout(3000)
  console.log('최종 URL:', page.url())
  console.log('title:', await page.title())

  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, 2500)
    await page.waitForTimeout(600)
  }
  await page.waitForTimeout(2000)

  const data = await page.evaluate(() => {
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null
    const imgs = Array.from(document.images)
      .map((im) => ({ src: im.currentSrc || im.src, w: im.naturalWidth, h: im.naturalHeight }))
      .filter((x) => x.src && /phinf|pstatic/i.test(x.src))
    return { og, imgs }
  })
  console.log('og:image:', data.og)
  const big = data.imgs.filter((x) => x.w >= 600)
  console.log('총 네이버이미지:', data.imgs.length, ' / 대형(>=600px):', big.length)
  big.slice(0, 12).forEach((x) => console.log(`${x.w}x${x.h}  ${x.src.slice(0, 120)}`))
} catch (e) {
  console.log('실패:', e.message)
} finally {
  await page.waitForTimeout(1000)
  await browser.close()
}
