import { chromium } from 'playwright'

const EMAIL = 'test3@test.com'
const PW = 'test1234'
const BASE = 'https://beautyground.vercel.app'

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1280, height: 1000 } })
const page = await ctx.newPage()

try {
  console.log('1) 로그인 페이지 이동')
  await page.goto(`${BASE}/partner/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.fill('#email', EMAIL)
  await page.fill('#password', PW)
  console.log('2) 로그인 제출')
  await Promise.all([
    page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
    page.click('button[type=submit]'),
  ])
  await page.waitForTimeout(3000)
  console.log('로그인 후 URL:', page.url())
  const err = await page.locator('[role=alert]').first().textContent().catch(() => null)
  if (err) console.log('로그인 에러메시지:', err)

  console.log('3) 상품등록 폼 이동')
  await page.goto(`${BASE}/partner/products/new`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  console.log('현재 URL:', page.url())
  await page.screenshot({ path: 'productform.png', fullPage: true })
  console.log('스크린샷 저장: productform.png')

  // 폼 필드/버튼/입력 요약
  const summary = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input,textarea,select')).map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      name: el.getAttribute('name') || el.id || '',
      placeholder: el.getAttribute('placeholder') || '',
    }))
    const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean)
    const labels = Array.from(document.querySelectorAll('label')).map((l) => l.textContent?.trim()).filter(Boolean)
    return { inputs, buttons, labels }
  })
  console.log('=== 입력필드 ===')
  summary.inputs.forEach((i) => console.log(`${i.tag}[${i.type}] ${i.name} "${i.placeholder}"`))
  console.log('=== 라벨 ===', summary.labels.join(' | '))
  console.log('=== 버튼 ===', summary.buttons.join(' | '))
} catch (e) {
  console.log('실패:', e.message)
} finally {
  await page.waitForTimeout(1000)
  await browser.close()
}
