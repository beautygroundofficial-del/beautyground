import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as cheerio from 'cheerio'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Cafe24 기본 상품 리뷰 게시판 번호
const REVIEW_BOARD_NO = 4
const MAX_REVIEWS = 20

interface Review {
  rating: number | null
  text: string
  photo: string | null
  date: string | null
  author: string | null
}

// 상대경로/스킴생략 → 절대 URL
function normalizeUrl(src: string | undefined | null, base: string): string | null {
  if (!src) return null
  let abs = src.trim()
  if (!abs || abs.startsWith('data:')) return null
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

interface ParsedReview extends Review {
  productNo: string | null
  articleId: string | null
}

// 리뷰 게시판 목록 HTML 에서 리뷰 행 파싱
function parseReviewRows(html: string, base: string): ParsedReview[] {
  const $ = cheerio.load(html)
  const rows: ParsedReview[] = []

  $('tr.xans-record-').each((_, el) => {
    const $row = $(el)

    // 리뷰 본문: 게시글(/article/) 링크 텍스트
    const $textLink = $row.find('td.subject a[href*="/article/"]').first()
    let text = $textLink.text().replace(/\s+/g, ' ').trim()
    if (!text) return // 본문 없으면 리뷰 행 아님
    if (text.length > 200) text = text.slice(0, 200).trim()

    // 별점: star-rating{N}.svg (alt "N점" 또는 파일명)
    const $star = $row.find('img[src*="star-rating"]').first()
    const starHay = `${$star.attr('alt') ?? ''} ${$star.attr('src') ?? ''}`
    const starMatch = starHay.match(/(\d)/)
    const rating = starMatch ? Math.min(5, Math.max(1, parseInt(starMatch[1], 10))) : null

    // 리뷰가 달린 상품 번호 (상품별 우선순위용)
    const prodHref = $row.find('td.thumb a[href*="/product/"]').first().attr('href') ?? ''
    const productNo = extractProductNo(prodHref)

    // 대표 이미지(리뷰 상품 썸네일)
    const photo = normalizeUrl($row.find('td.thumb img').first().attr('src'), base)

    // 작성일 (YYYY-MM-DD)
    const rowText = $row.text()
    const dateMatch = rowText.match(/\d{4}-\d{2}-\d{2}/)
    const date = dateMatch ? dateMatch[0] : null

    // 작성자 (마스킹된 표시명: '*' 포함 셀)
    let author: string | null = null
    $row.find('td').each((__, td) => {
      const t = $(td).text().replace(/\s+/g, ' ').trim()
      if (author) return
      if (t.includes('*') && t.length <= 20 && !/\d{4}-\d{2}-\d{2}/.test(t)) author = t
    })

    // 게시글 id (중복 제거용)
    const articleId = ($textLink.attr('href') ?? '').match(/\/article\/[^/]+\/\d+\/(\d+)\//)?.[1] ?? null

    rows.push({ rating, text, photo, date, author, productNo, articleId })
  })

  return rows
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

  // 리뷰 게시판 목록 1~2 페이지 수집 (product_no 필터가 무시되는 스킨이 있어 행 단위로 상품 매칭)
  const parsed: ParsedReview[] = []
  for (let page = 1; page <= 2; page++) {
    const url = `${origin}/board/product/list.html?board_no=${REVIEW_BOARD_NO}&product_no=${targetNo ?? ''}&page=${page}`
    const html = await fetchHtml(url)
    if (!html) break
    const rows = parseReviewRows(html, origin)
    if (rows.length === 0) break
    parsed.push(...rows)
  }

  if (parsed.length === 0) {
    res.status(200).json({ reviews: [], count: 0, error: 'NO_REVIEWS' })
    return
  }

  // 게시글 id 기준 중복 제거
  const seen = new Set<string>()
  const unique = parsed.filter((r) => {
    const key = r.articleId ?? `${r.text}|${r.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 해당 상품 리뷰 우선, 그다음 브랜드(전체) 최신 리뷰로 채움
  const matched = targetNo ? unique.filter((r) => r.productNo === targetNo) : []
  const others = unique.filter((r) => !matched.includes(r))
  const ordered = [...matched, ...others].slice(0, MAX_REVIEWS)

  const reviews: Review[] = ordered.map(({ rating, text, photo, date, author }) => ({
    rating,
    text,
    photo,
    date,
    author,
  }))

  res.status(200).json({ reviews, count: reviews.length })
}
