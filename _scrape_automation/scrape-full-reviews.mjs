import { chromium } from 'playwright'

// 제품 1개의 실제 리뷰 전부(캡까지) 수집: 목록 전 페이지 순회 → 각 상세 방문해 본문/사진 획득.
// 반환: { count, avg, reviews: [{rating,text,photo,photos,date,author}] }
export async function scrapeFullReviews(page, productUrl, { cap = 50, maxPages = 30 } = {}) {
  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(800)
  await page.evaluate(() => document.querySelector('.xans-product-review')?.scrollIntoView()).catch(() => {})
  await page.waitForTimeout(800)

  const count = await page.evaluate(() => {
    const t = document.body.innerText
    const m = t.match(/후기\s*(\d[\d,]*)/) || t.match(/리뷰\s*\(?\s*(\d[\d,]*)/)
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0
  })

  // 목록 전 페이지 순회 (행: href/author/date/rating/subject/hasPhoto)
  const rows = []
  const seen = new Set()
  let pageNo = 1
  while (pageNo <= maxPages && rows.length < cap) {
    if (pageNo > 1) {
      const moved = await page.evaluate((pn) => {
        const pager = document.querySelector('.xans-product-reviewpaging, .xans-product-review .ec-base-paginate')
        if (!pager) return false
        const a = Array.from(pager.querySelectorAll('a')).find(x => x.textContent.trim() === String(pn))
        if (a) { a.click(); return true }
        return false
      }, pageNo)
      if (!moved) break
      await page.waitForTimeout(1300)
    }
    const pageRows = await page.evaluate(() => {
      const root = document.querySelector('.xans-product-review'); if (!root) return []
      return Array.from(root.querySelectorAll('tr.xans-record-')).map(tr => {
        const txt = tr.innerText
        let rating = 5
        if (/불만족/.test(txt)) rating = 2
        else if (/보통/.test(txt)) rating = 3
        const a = tr.querySelector('a[href*="/article/review/"]')
        const tds = Array.from(tr.querySelectorAll('td'))
        const author = (tds.find(td => /\*\*/.test(td.textContent))?.textContent || '').replace(/\s+/g, ' ').trim()
        const date = ((tds.find(td => /\d{4}-\d{2}-\d{2}/.test(td.textContent))?.textContent || '').match(/\d{4}-\d{2}-\d{2}/) || [])[0] || null
        const subject = a ? (a.textContent || '').replace(/\s+/g, ' ').trim() : ''
        return { href: a ? a.href : null, author, date, rating, subject }
      })
    })
    let added = 0
    for (const r of pageRows) {
      if (!r.href || seen.has(r.href)) continue
      seen.add(r.href); rows.push(r); added++
      if (rows.length >= cap) break
    }
    if (added === 0) break
    pageNo++
  }

  // 각 상세 방문 → 본문 + 사진
  const reviews = []
  for (const r of rows) {
    let body = '', photos = []
    try {
      await page.goto(r.href, { waitUntil: 'domcontentloaded', timeout: 22000 })
      await page.waitForTimeout(500)
      const d = await page.evaluate(() => {
        const bt = document.body.innerText
        const m = bt.match(/조회수\s*[\d,]+\s*([\s\S]{1,900}?)\s*\(\d{4}-\d{2}-\d{2}[^)]*에 등록된/)
        const imgs = Array.from(document.querySelectorAll('img'))
          .map(im => im.currentSrc || im.src).filter(s => /\/file_data\//i.test(s))
        return { body: m ? m[1].replace(/\s+/g, ' ').trim() : '', imgs: [...new Set(imgs)] }
      })
      body = d.body
      photos = d.imgs
    } catch {}
    // 본문 없으면 subject 폴백(단, "만족/불만족/보통"만이면 버림)
    let text = body
    if (!text || text.length < 2) {
      text = /^(만족|불만족|보통)$/.test(r.subject) ? '' : r.subject
    }
    reviews.push({
      rating: r.rating,
      text,
      photo: photos[0] ?? null,
      photos: photos.length ? photos : undefined,
      date: r.date,
      author: r.author,
    })
  }

  // 평균: 수집된 행 별점 기준(전 페이지는 아니지만 cap 내 표본)
  const avg = reviews.length
    ? Math.round((reviews.reduce((a, b) => a + (b.rating ?? 5), 0) / reviews.length) * 10) / 10
    : null

  return { count: count || reviews.length, avg, reviews }
}

if (process.argv[1].endsWith('scrape-full-reviews.mjs')) {
  const url = process.argv[2] || 'https://www.petitfee.com/product/루비-불가리안로즈-아이패치/38/category/24/display/1/'
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 1600 } }).then(c => c.newPage())
  const s = await scrapeFullReviews(page, url, { cap: 50 })
  const withText = s.reviews.filter(r => r.text && r.text.length > 1).length
  const withPhoto = s.reviews.filter(r => r.photo).length
  console.log(`count(총):${s.count} | avg:${s.avg} | 수집:${s.reviews.length} | 본문있음:${withText} | 사진있음:${withPhoto}`)
  console.log('\n샘플 8개:')
  s.reviews.slice(0, 8).forEach((r, i) =>
    console.log(`  ${i + 1}. ★${r.rating} ${r.author} ${r.date} ${r.photo ? '📷' : '  '} | ${(r.text || '(본문없음)').slice(0, 55)}`))
  await browser.close()
}
