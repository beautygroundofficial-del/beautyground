import { chromium } from 'playwright'

// 간단 위젯용: 리뷰수 + 평균평점 + 사진썸네일. (본문 텍스트 불필요)
export async function scrapeReviewSummary(page, productUrl, { pages = 2, maxPhotos = 12 } = {}) {
  await page.goto(productUrl, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)
  await page.evaluate(() => document.querySelector('.xans-product-review')?.scrollIntoView())
  await page.waitForTimeout(1200)

  // 리뷰 총 개수 (후기 N / review_count)
  const count = await page.evaluate(() => {
    const t = document.body.innerText
    const m = t.match(/후기\s*(\d[\d,]*)/) || t.match(/리뷰\s*\(?\s*(\d[\d,]*)/) || t.match(/([\d,]+)\s*개의?\s*(후기|리뷰)/)
    const el = document.querySelector('.review_count, .xans-product-review .count')
    const elN = el ? parseInt((el.textContent || '').replace(/[^\d]/g, ''), 10) : NaN
    const textN = m ? parseInt(m[1].replace(/,/g, ''), 10) : NaN
    return Number.isFinite(elN) && elN > 0 ? elN : (Number.isFinite(textN) ? textN : 0)
  })

  // 첫 N페이지 순회: 평점 표본 + 사진리뷰(작성자/날짜/평점/링크) 수집
  const ratings = []
  const photoReviews = []
  for (let p = 1; p <= pages; p++) {
    if (p > 1) {
      const moved = await page.evaluate((pn) => {
        const pager = document.querySelector('.xans-product-reviewpaging, .xans-product-review .ec-base-paginate')
        if (!pager) return false
        const a = Array.from(pager.querySelectorAll('a')).find(x => x.textContent.trim() === String(pn))
        if (a) { a.click(); return true }
        return false
      }, p)
      if (!moved) break
      await page.waitForTimeout(1500)
    }
    const pageData = await page.evaluate(() => {
      const root = document.querySelector('.xans-product-review'); if (!root) return { ratings: [], photoReviews: [] }
      const rows = Array.from(root.querySelectorAll('tr.xans-record-'))
      const ratings = []
      const photoReviews = []
      for (const tr of rows) {
        const txt = tr.innerText
        let rating = 5
        if (/불만족/.test(txt)) rating = 2
        else if (/보통/.test(txt)) rating = 3
        ratings.push(rating)
        if (tr.querySelector('img[src*="ico_attach"]')) {
          const a = tr.querySelector('a[href*="/article/review/"]')
          if (a) {
            const tds = Array.from(tr.querySelectorAll('td'))
            const author = (tds.find(td => /\*\*/.test(td.textContent))?.textContent || '').replace(/\s+/g, ' ').trim()
            const date = ((tds.find(td => /\d{4}-\d{2}-\d{2}/.test(td.textContent))?.textContent || '').match(/\d{4}-\d{2}-\d{2}/) || [])[0] || null
            const subject = (a.textContent || '').replace(/\s+/g, ' ').trim()
            photoReviews.push({ href: a.href, author, date, rating, subject })
          }
        }
      }
      return { ratings, photoReviews }
    })
    ratings.push(...pageData.ratings)
    photoReviews.push(...pageData.photoReviews)
  }

  // 사진리뷰 상세 방문 → /file_data/ 사진 + 본문 수집. 사진마다 {url,text,rating,author,date}
  const photos = []
  for (const r of photoReviews) {
    if (photos.length >= maxPhotos) break
    try {
      await page.goto(r.href, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(800)
      const d = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img')).map(im => im.currentSrc || im.src).filter(s => /\/file_data\//i.test(s))
        const bt = document.body.innerText
        const m = bt.match(/조회수\s*[\d,]+\s*([\s\S]{2,500}?)\s*\(\d{4}-\d{2}-\d{2}[^)]*에 등록된/)
        return { imgs: [...new Set(imgs)], text: m ? m[1].replace(/\s+/g, ' ').trim() : '' }
      })
      const text = (d.text && d.text.length > 1 ? d.text : r.subject) || ''
      for (const url of d.imgs) {
        if (photos.length >= maxPhotos) break
        if (!photos.some(x => x.url === url)) photos.push({ url, text: text.slice(0, 400), rating: r.rating, author: r.author, date: r.date })
      }
    } catch {}
  }

  const avg = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null
  return { count, avg, photos: photos.slice(0, maxPhotos), sampled: ratings.length }
}

if (process.argv[1].endsWith('scrape-review-summary.mjs')) {
  const url = process.argv[2] || 'https://www.petitfee.com/product/골드-아이패치/17/category/24/display/1/'
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1440, height: 1600 } }).then(c => c.newPage())
  const s = await scrapeReviewSummary(page, url, { pages: 3 })
  console.log('리뷰수:', s.count, '| 평균:', s.avg, '(표본', s.sampled + ')', '| 사진:', s.photos.length)
  s.photos.slice(0, 6).forEach(p => console.log(`   ★${p.rating} ${p.author} ${p.date} | ${(p.text||'').slice(0,40)} | ${p.url.replace('https://www.petitfee.com','')}`))
  await browser.close()
}
