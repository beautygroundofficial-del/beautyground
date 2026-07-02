import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as cheerio from 'cheerio'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Cafe24 기본 상품 리뷰 게시판 번호
const REVIEW_BOARD_NO = 4
const MAX_REVIEWS = 20 // 최종 반환 상한
const MAX_DETAIL_FETCH = 15 // 상세 조회 상한
const MAX_PHOTOS_PER_REVIEW = 5
const DETAIL_CONCURRENCY = 3
const DETAIL_GAP_MS = 150
const TIME_BUDGET_MS = 8000

interface Review {
  rating: number | null
  text: string
  photo: string | null
  photos: string[]
  date: string | null
  author: string | null
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

// 상대경로/스킴생략 → 절대 URL
function normalizeUrl(src: string | undefined | null, base: string): string | null {
  if (!src) return null
  let abs = src.trim()
  if (!abs || abs.startsWith('data:') || abs === 'about:blank') return null
  if (abs.startsWith('//')) abs = 'https:' + abs
  try {
    abs = new URL(abs, base).href
  } catch {
    return null
  }
  return abs.replace(/\[/g, '%5B').replace(/\]/g, '%5D')
}

// Cafe24 상품 URL 에서 상품번호 추출
function extractProductNo(u: string): string | null {
  const m1 = u.match(/[?&]product_no=(\d+)/)
  if (m1) return m1[1]
  const m2 = u.match(/\/product\/[^/]+\/(\d+)\//)
  if (m2) return m2[1]
  return null
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!resp.ok) return null
    return await resp.text()
  } catch {
    return null
  }
}

interface ListRow {
  articleId: string
  productNo: string | null
  rating: number | null
  date: string | null
  author: string | null
  text: string // 목록 미리보기(폴백용)
}

// 리뷰 게시판 목록 HTML → 행 파싱 (articleId, 상품번호, 별점/날짜/작성자)
function parseListRows(html: string): ListRow[] {
  const $ = cheerio.load(html)
  const rows: ListRow[] = []

  $('tr.xans-record-').each((_, el) => {
    const $row = $(el)

    const $textLink = $row.find('td.subject a[href*="/article/"]').first()
    const href = $textLink.attr('href') ?? ''
    const articleId = href.match(/\/article\/[^/]+\/\d+\/(\d+)\//)?.[1] ?? null
    if (!articleId) return

    let text = $textLink.text().replace(/\s+/g, ' ').trim()
    if (text.length > 200) text = text.slice(0, 200).trim()

    const $star = $row.find('img[src*="star-rating"]').first()
    const starHay = `${$star.attr('alt') ?? ''} ${$star.attr('src') ?? ''}`
    const starMatch = starHay.match(/(\d)/)
    const rating = starMatch ? Math.min(5, Math.max(1, parseInt(starMatch[1], 10))) : null

    const prodHref = $row.find('td.thumb a[href*="/product/"]').first().attr('href') ?? ''
    const productNo = extractProductNo(prodHref)

    const dateMatch = $row.text().match(/\d{4}-\d{2}-\d{2}/)
    const date = dateMatch ? dateMatch[0] : null

    let author: string | null = null
    $row.find('td').each((__, td) => {
      const t = $(td).text().replace(/\s+/g, ' ').trim()
      if (author) return
      if (t.includes('*') && t.length <= 20 && !/\d{4}-\d{2}-\d{2}/.test(t)) author = t
    })

    rows.push({ articleId, productNo, rating, date, author, text })
  })

  return rows
}

// 게시글 상세 HTML 에서 상품번호 추출 (product_no 파라미터 최빈값)
function detailProductNo(html: string): string | null {
  const nos = [...html.matchAll(/[?&]product_no=(\d+)/g)].map(m => m[1])
  if (nos.length === 0) return null
  const freq: Record<string, number> = {}
  let best: string | null = null
  let bestCount = 0
  for (const n of nos) {
    freq[n] = (freq[n] || 0) + 1
    if (freq[n] > bestCount) { bestCount = freq[n]; best = n }
  }
  return best
}

interface DetailData {
  productNo: string | null
  text: string
  photos: string[]
  rating: number | null
  date: string | null
  author: string | null
}

// 게시글 상세 HTML 파싱: 본문 전체 텍스트 + 리뷰 사진(/file_data/) + 상품번호
function parseDetail(html: string, base: string): DetailData {
  const $ = cheerio.load(html)
  const $body = $('.fr-view-article').first()

  // 본문 텍스트 (img 제거 후, 첨부 파일명/게시판 UI 문구 정리)
  const $clone = $body.clone()
  $clone.find('img, script, style, noscript').remove()
  let text = $clone.text().replace(/\s+/g, ' ').trim()
  text = text
    .replace(/\S*review_\d+_image\d+\.\w+/gi, ' ') // review_8685_image1.jpg 류
    .replace(/\S+\.(?:jpe?g|png|gif)/gi, ' ') // 기타 이미지 파일명
    .replace(/삭제하려면 비밀번호를 입력하세요\.?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length > 500) text = text.slice(0, 500).trim()

  // 리뷰 사진: 본문 영역의 ecimg.cafe24img.com + /file_data/ 이미지만
  const photos: string[] = []
  const seen = new Set<string>()
  const scope = $body.length > 0 ? $body.find('img') : $('img')
  scope.each((_, el) => {
    const $img = $(el)
    const raw =
      $img.attr('src') ||
      $img.attr('data-src') ||
      $img.attr('ec-data-src') ||
      $img.attr('data-original') ||
      $img.attr('data-lazy')
    const n = normalizeUrl(raw, base)
    if (!n) return
    if (!/ecimg\.cafe24img\.com/i.test(n)) return
    if (!/\/file_data\//i.test(n)) return
    if (/\.(?:gif|svg)(?:\?|$)/i.test(n)) return
    if (seen.has(n)) return
    seen.add(n)
    if (photos.length < MAX_PHOTOS_PER_REVIEW) photos.push(n)
  })

  // 별점 (상세의 star-rating)
  const $star = $('img[src*="star-rating"]').first()
  const starHay = `${$star.attr('alt') ?? ''} ${$star.attr('src') ?? ''}`
  const starMatch = starHay.match(/(\d)/)
  const rating = starMatch ? Math.min(5, Math.max(1, parseInt(starMatch[1], 10))) : null

  return { productNo: detailProductNo(html), text, photos, rating, date: null, author: null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ reviews: [], error: 'POST 요청만 허용됩니다.' })
    return
  }

  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const productUrl = (body as { productUrl?: string } | null)?.productUrl?.trim()

  if (!productUrl || !/^https?:\/\//i.test(productUrl)) {
    res.status(400).json({ reviews: [], error: '올바른 상품 페이지 URL 을 입력해 주세요.' })
    return
  }

  let origin: string
  try {
    origin = new URL(productUrl).origin
  } catch {
    res.status(400).json({ reviews: [], error: '올바른 상품 페이지 URL 을 입력해 주세요.' })
    return
  }

  const targetNo = extractProductNo(productUrl)
  if (!targetNo) {
    res.status(200).json({ reviews: [], count: 0, matched: false, error: 'NO_PRODUCT_NO' })
    return
  }

  const startedAt = Date.now()

  // 1) 게시판 목록 1~2 페이지에서 행 수집 → articleId + 상품번호
  const rows: ListRow[] = []
  const seenArticle = new Set<string>()
  for (let page = 1; page <= 2; page++) {
    const url = `${origin}/board/product/list.html?board_no=${REVIEW_BOARD_NO}&product_no=${targetNo}&page=${page}`
    const html = await fetchHtml(url)
    if (!html) break
    const parsed = parseListRows(html)
    if (parsed.length === 0) break
    for (const r of parsed) {
      if (seenArticle.has(r.articleId)) continue
      seenArticle.add(r.articleId)
      rows.push(r)
    }
  }

  if (rows.length === 0) {
    res.status(200).json({ reviews: [], count: 0, matched: false, error: 'NO_REVIEWS' })
    return
  }

  // 목록 행의 상품번호로 1차 후보 선별 (상품번호 불명확 스킨이면 전체를 후보로)
  const rowsWithNo = rows.filter(r => r.productNo != null)
  let candidates: ListRow[]
  if (rowsWithNo.length > 0) {
    candidates = rows.filter(r => r.productNo === targetNo)
  } else {
    candidates = rows // 목록에서 상품번호를 못 읽는 스킨 → 상세에서 판별
  }
  candidates = candidates.slice(0, MAX_DETAIL_FETCH)

  if (candidates.length === 0) {
    res.status(200).json({ reviews: [], count: 0, matched: false })
    return
  }

  // 2) 후보 게시글 상세 조회 (동시 3개, 150ms 간격, 8초 예산). 상세 product_no 로 최종 매칭.
  const collected: Review[] = []
  for (let i = 0; i < candidates.length; i += DETAIL_CONCURRENCY) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    const batch = candidates.slice(i, i + DETAIL_CONCURRENCY)

    const results = await Promise.allSettled(
      batch.map(async (row, k) => {
        await sleep(k * DETAIL_GAP_MS) // 요청 간 지연
        const detailUrl = `${origin}/board/product/read.html?no=${row.articleId}&board_no=${REVIEW_BOARD_NO}`
        const html = await fetchHtml(detailUrl)
        if (!html) return null
        const d = parseDetail(html, origin)
        // 상세 상품번호가 확인되면 대상 상품과 일치할 때만 채택
        if (d.productNo && d.productNo !== targetNo) return null
        if (!d.productNo && row.productNo && row.productNo !== targetNo) return null

        const text = d.text || row.text
        if (!text) return null
        const review: Review = {
          rating: d.rating ?? row.rating,
          text,
          photo: d.photos[0] ?? null,
          photos: d.photos,
          date: row.date ?? d.date,
          author: row.author ?? d.author,
        }
        return review
      }),
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) collected.push(r.value)
    }
  }

  if (collected.length === 0) {
    res.status(200).json({ reviews: [], count: 0, matched: false })
    return
  }

  const reviews = collected.slice(0, MAX_REVIEWS)
  res.status(200).json({ reviews, count: reviews.length, matched: true })
}
