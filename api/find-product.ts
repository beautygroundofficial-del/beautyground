import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as cheerio from 'cheerio'

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// best 로 채택하는 최소 점수 / 후보로 노출하는 최소 점수
const BEST_SCORE = 80
const MIN_CANDIDATE_SCORE = 30
const MAX_CANDIDATES = 5

interface Candidate {
  name: string
  url: string
  thumbnail: string | null
  score: number
}

// 상대경로/스킴생략 → 절대 URL + 이미지 URL 의 대괄호 인코딩
function normalizeUrl(src: string | undefined | null, base: string): string | null {
  if (!src) return null
  let abs = src.trim()
  if (!abs) return null
  if (abs.startsWith('//')) abs = 'https:' + abs
  try {
    abs = new URL(abs, base).href
  } catch {
    return null
  }
  return abs.replace(/\[/g, '%5B').replace(/\]/g, '%5D')
}

// Cafe24 상품 상세 링크에서 상품번호 추출 (없으면 상품 링크 아님)
function extractProductNo(href: string): string | null {
  const m1 = href.match(/[?&]product_no=(\d+)/)
  if (m1) return m1[1]
  const m2 = href.match(/\/product\/[^/]+\/(\d+)\//)
  if (m2) return m2[1]
  return null
}

// 정규화: 소문자화 + 공백/괄호/특수문자 제거 → 비교용 단일 문자열
function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[[\]()+/·\-]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

// 단어 토큰(공백/구분자 기준) — 각 토큰을 정규화 후 빈 값 제거
function tokens(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .split(/[\s[\]()+/·\-,]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((t) => t.length > 0)
}

// 제목 매칭 점수: 완전일치 100 > 포함 80 > 공통 단어 비율(0~60)
function matchScore(inputTitle: string, candName: string): number {
  const a = normalize(inputTitle)
  const b = normalize(candName)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 80
  const wa = tokens(inputTitle)
  if (wa.length === 0) return 0
  const wb = new Set(tokens(candName))
  const common = wa.filter((w) => wb.has(w)).length
  return Math.round((common / wa.length) * 60)
}

interface FetchResult {
  ok: boolean
  html: string
}

async function fetchHtml(url: string): Promise<FetchResult> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!resp.ok) return { ok: false, html: '' }
    return { ok: true, html: await resp.text() }
  } catch {
    return { ok: false, html: '' }
  }
}

interface ParsedProduct {
  no: string
  url: string
  name: string
  thumbnail: string | null
}

// HTML 에서 상품 상세 링크들을 상품번호 기준으로 병합 수집 (썸네일 앵커 + 상품명 앵커 합침)
function parseProducts(html: string, base: string): ParsedProduct[] {
  const $ = cheerio.load(html)
  const byNo = new Map<string, ParsedProduct>()

  $('a[href*="/product/"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    if (!href) return
    const no = extractProductNo(href)
    if (!no) return
    const url = normalizeUrl(href, base)
    if (!url) return

    const $img = $a.find('img').first()
    // 상품명 후보: title 속성 > img alt > 앵커 텍스트
    let name = ($a.attr('title') || '').trim()
    if (!name) name = ($img.attr('alt') || '').trim()
    if (!name) name = $a.text().replace(/\s+/g, ' ').trim()
    name = name.replace(/^상품명\s*[:：]\s*/, '').trim()
    // 잡링크(장바구니/옵션 등) 방지: 너무 길거나 순수 숫자면 이름으로 안 씀
    if (name.length > 120 || /^\d+$/.test(name)) name = ''

    // 썸네일 (지연로딩 속성 포함)
    const thumb = normalizeUrl(
      $img.attr('src') ||
        $img.attr('data-src') ||
        $img.attr('ec-data-src') ||
        $img.attr('data-original'),
      base,
    )

    const existing = byNo.get(no)
    if (!existing) {
      byNo.set(no, { no, url, name, thumbnail: thumb })
    } else {
      // 더 긴(더 서술적인) 상품명 채택, 썸네일은 먼저 발견된 것 유지
      if (name && name.length > existing.name.length) existing.name = name
      if (!existing.thumbnail && thumb) existing.thumbnail = thumb
    }
  })

  return [...byNo.values()].filter((p) => p.name.length > 0)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST 요청만 허용됩니다.' })
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
  const siteUrl = (body as { siteUrl?: string } | null)?.siteUrl?.trim()
  const title = (body as { title?: string } | null)?.title?.trim()

  if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) {
    res.status(400).json({ ok: false, error: '올바른 사이트 주소를 입력해 주세요.' })
    return
  }
  if (!title) {
    res.status(400).json({ ok: false, error: '상품 제목을 입력해 주세요.' })
    return
  }

  let origin: string
  try {
    origin = new URL(siteUrl).origin
  } catch {
    res.status(400).json({ ok: false, error: '올바른 사이트 주소를 입력해 주세요.' })
    return
  }

  // 1) Cafe24 표준 검색 → 2) 폴백: 카테고리 목록 → 3) 폴백: 전체 목록
  const searchUrl = `${origin}/product/search.html?keyword=${encodeURIComponent(title)}`
  const fallbackUrls = [
    `${origin}/product/list.html?cate_no=113`,
    `${origin}/product/list.html`,
  ]

  let products: ParsedProduct[] = []
  let sawAnyPage = false

  const searchResp = await fetchHtml(searchUrl)
  if (searchResp.ok) {
    sawAnyPage = true
    products = parseProducts(searchResp.html, origin)
  }

  // 검색 결과 0건이면 목록 페이지로 폴백
  if (products.length === 0) {
    for (const url of fallbackUrls) {
      const resp = await fetchHtml(url)
      if (!resp.ok) continue
      sawAnyPage = true
      products = parseProducts(resp.html, origin)
      if (products.length > 0) break
    }
  }

  // 어떤 페이지도 열지 못함 → 비표준 스킨/차단으로 간주
  if (!sawAnyPage) {
    res.status(200).json({ best: null, candidates: [], error: 'SEARCH_UNSUPPORTED' })
    return
  }

  // 점수 계산 + 상품번호 기준 중복 제거(이미 no 기준 병합됨)
  const scored: Candidate[] = products
    .map((p) => ({
      name: p.name,
      url: p.url,
      thumbnail: p.thumbnail,
      score: matchScore(title, p.name),
    }))
    .filter((c) => c.score >= MIN_CANDIDATE_SCORE)
    .sort((a, b) => b.score - a.score)

  const candidates = scored.slice(0, MAX_CANDIDATES)
  const best = candidates.length > 0 && candidates[0].score >= BEST_SCORE ? candidates[0] : null

  res.status(200).json({ best, candidates })
}
