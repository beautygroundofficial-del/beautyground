import { chromium } from 'playwright'

const EMAIL = 'test3@test.com'
const PW = 'test1234'
const BASE = 'https://beautyground.vercel.app'
const SITE_URL = 'https://www.petitfee.com/product/%ED%8D%BC%ED%93%B8-%ED%95%B8%EB%93%9C%ED%81%AC%EB%A6%BC-%ED%8A%A4%EB%A6%BD-%EC%95%B3-%EB%8D%98/897/category/1/display/4/'
const PRODUCT_NAME = '퍼퓸 핸드크림 튤립 앳 던'

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1360, height: 1100 } })
const page = await ctx.newPage()

// 모든 api 응답 로깅
page.on('response', async (r) => {
  if (r.url().includes('/api/')) {
    console.log('[API]', r.status(), r.url().replace(BASE, ''))
  }
})

try {
  await page.goto(`${BASE}/partner/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.fill('#email', EMAIL)
  await page.fill('#password', PW)
  await Promise.all([page.waitForNavigation().catch(() => {}), page.click('button[type=submit]')])
  await page.waitForTimeout(2500)

  await page.goto(`${BASE}/partner/products/new`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)

  // 칸1: 사이트 URL(placeholder makeuphelper), 칸2: 제품명(placeholder 상품 제목 입력)
  await page.locator('input[placeholder*="makeuphelper"]').first().fill(SITE_URL)
  await page.locator('input[placeholder*="상품 제목"]').first().fill(PRODUCT_NAME)
  console.log('칸1(URL)·칸2(제품명) 입력 완료 → "자동 불러오기" 클릭')

  await page.getByRole('button', { name: '자동 불러오기', exact: true }).click()
  // ① 제품검색 → ② 스크래핑, 둘 다 끝날 때까지 대기
  await page.waitForResponse((r) => r.url().includes('/api/find-product'), { timeout: 60000 }).catch(() => null)
  await page.waitForResponse((r) => r.url().includes('/api/scrape-product'), { timeout: 90000 }).catch(() => null)
  await page.waitForTimeout(9000) // 이미지 렌더링/지연로딩 대기

  const result = await page.evaluate(() => {
    const nameVal = document.querySelector('input[placeholder*="상품명"]')?.value || ''
    const priceVal = document.querySelector('input[placeholder="0"]')?.value || ''
    // 대표/상세 이미지를 DOM 순서대로, 원본 해상도까지
    const imgs = Array.from(document.querySelectorAll('img'))
      .filter((im) => { const s = im.currentSrc || im.src; return s && s.startsWith('http') && !/logo|icon/i.test(s) })
      .map((im) => ({ src: (im.currentSrc || im.src), w: im.naturalWidth, h: im.naturalHeight }))
    return { nameVal, priceVal, imgs }
  })
  console.log('폼 상품명:', result.nameVal, '| 정가:', result.priceVal, '| 이미지수:', result.imgs.length)
  console.log('--- 폼에 붙은 이미지 (순서대로, 최대 12) ---')
  result.imgs.slice(0, 12).forEach((x, i) => console.log(`${i + 1}. ${x.w}x${x.h}  ${x.src.slice(0, 90)}`))
  await page.screenshot({ path: 'auto-loaded.png', fullPage: true })
  console.log('채워진 폼 캡처: auto-loaded.png')

  // 이미지 지연로딩 완료 대기: 끝까지 스크롤
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 3000); await page.waitForTimeout(600) }
  await page.waitForTimeout(3000)
  // 모든 이미지 로드 확인
  const loaded = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('img'))
    const done = all.filter((im) => im.complete && im.naturalWidth > 0).length
    return { total: all.length, done }
  })
  console.log(`이미지 로드: ${loaded.done}/${loaded.total}`)

  console.log('→ "등록하기" 클릭')
  const navP = page.waitForNavigation({ timeout: 40000 }).catch(() => null)
  await page.getByRole('button', { name: '등록하기', exact: true }).click()
  await navP
  await page.waitForTimeout(5000)
  console.log('등록 후 URL:', page.url())
  // 성공/실패 메시지 탐색
  const msg = await page.evaluate(() => {
    const t = document.body.innerText
    const m = t.match(/(등록[^\n]{0,20}(완료|되었|성공)|실패|오류|에러)[^\n]{0,40}/)
    return m ? m[0] : ''
  })
  console.log('메시지:', msg || '(명시적 메시지 없음)')
  await page.screenshot({ path: 'after-register.png', fullPage: true })
  console.log('등록후 캡처: after-register.png')

  // 상품 목록에서 실제 업로드 확인
  await page.goto(`${BASE}/partner/products`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3500)
  const verify = await page.evaluate(() => {
    const body = document.body.innerText
    return { found: body.includes('퍼퓸 핸드크림 튤립 앳 던') }
  })
  console.log('==== 상품목록 검증: "퍼퓸 핸드크림 튤립 앳 던" 존재? ', verify.found, ' ====')
  await page.screenshot({ path: 'products-list.png', fullPage: true })
  console.log('상품목록 캡처: products-list.png')
} catch (e) {
  console.log('실패:', e.message)
} finally {
  await page.waitForTimeout(1500)
  await browser.close()
}
