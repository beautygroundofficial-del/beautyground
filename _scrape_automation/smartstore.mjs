import { chromium } from 'playwright'

const url = process.argv[2] || 'https://smartstore.naver.com/rociocosmetic/products/13233213823'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  locale: 'ko-KR',
  viewport: { width: 1280, height: 900 },
})
const page = await ctx.newPage()

let status = 0
try {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  status = resp ? resp.status() : 0
  console.log('HTTP status:', status)

  // 상세정보 지연로딩 유도: 여러 번 스크롤
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 2500)
    await page.waitForTimeout(700)
  }
  await page.waitForTimeout(1500)

  const data = await page.evaluate(() => {
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || null
    const title = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title
    const imgs = Array.from(document.images)
      .map((im) => ({ src: im.currentSrc || im.src, w: im.naturalWidth, h: im.naturalHeight }))
      .filter((x) => x.src && /phinf|pstatic/i.test(x.src))
    return { og, title, imgs }
  })

  console.log('title:', data.title)
  console.log('og:image:', data.og)
  const big = data.imgs.filter((x) => x.w >= 600)
  console.log('총 네이버이미지:', data.imgs.length, ' / 대형(가로>=600):', big.length)
  console.log('--- 대형 이미지 (상세페이지 후보) 최대 12 ---')
  big.slice(0, 12).forEach((x) => console.log(`${x.w}x${x.h}  ${x.src}`))
} catch (e) {
  console.log('실패:', e.message)
} finally {
  await browser.close()
}
