import { chromium } from 'playwright'

const EMAIL = 'test3@test.com'
const PW = 'test1234'
const BASE = 'https://beautyground.vercel.app'
const PRODUCT_URL = 'https://www.petitfee.com/product/%ED%8D%BC%ED%93%B8-%ED%95%B8%EB%93%9C%ED%81%AC%EB%A6%BC-%ED%8A%A4%EB%A6%BD-%EC%95%B3-%EB%8D%98/897/category/1/display/4/'

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1360, height: 1100 } })
const page = await ctx.newPage()

try {
  // 로그인
  await page.goto(`${BASE}/partner/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.fill('#email', EMAIL)
  await page.fill('#password', PW)
  await Promise.all([page.waitForNavigation().catch(() => {}), page.click('button[type=submit]')])
  await page.waitForTimeout(2500)
  console.log('로그인 후:', page.url())

  // 상품등록 폼
  await page.goto(`${BASE}/partner/products/new`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)

  // 상품 페이지 URL 입력
  const urlInput = page.locator('input[placeholder*="상품 페이지 URL"]').first()
  await urlInput.fill(PRODUCT_URL)
  console.log('URL 입력 완료, 자동 불러오기 클릭...')

  // "불러오기"(상품페이지 URL 전용, 정확히 일치) 클릭 + 스크랩 응답 대기
  const respP = page.waitForResponse((r) => r.url().includes('/api/scrape-product'), { timeout: 90000 }).catch(() => null)
  await page.getByRole('button', { name: '불러오기', exact: true }).click()
  const resp = await respP
  if (resp) {
    console.log('scrape-product 응답:', resp.status())
    try {
      const j = await resp.json()
      if (j.ok) {
        console.log('  상품명:', j.data.name)
        console.log('  가격:', j.data.price, '/', j.data.sale_price)
        console.log('  대표(gallery):', j.data.gallery.length, ' 상세(detail):', j.data.detail_images.length)
      } else console.log('  API error:', j.error)
    } catch {}
  } else console.log('scrape 응답 못받음(타임아웃)')

  await page.waitForTimeout(6000)

  // 폼에 실제로 붙은 이미지들을 "순서대로" 추출
  const result = await page.evaluate(() => {
    const nameVal = document.querySelector('input[placeholder*="상품명"]')?.value || ''
    // 미리보기 이미지들(순서 유지) — blob/http 이미지
    const imgs = Array.from(document.querySelectorAll('img'))
      .map((im) => im.currentSrc || im.src)
      .filter((s) => s && (s.startsWith('http') || s.startsWith('blob:')) && !/logo|icon/i.test(s))
    return { nameVal, imgs }
  })
  console.log('폼 상품명 값:', result.nameVal)
  console.log('폼에 표시된 이미지 수:', result.imgs.length)

  await page.screenshot({ path: 'form-loaded.png', fullPage: true })
  console.log('전체 캡처 저장: form-loaded.png')
} catch (e) {
  console.log('실패:', e.message)
  await page.screenshot({ path: 'form-error.png', fullPage: true }).catch(() => {})
} finally {
  await page.waitForTimeout(1500)
  await browser.close()
}
