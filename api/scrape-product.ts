import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as cheerio from 'cheerio'
import { GoogleGenAI } from '@google/genai'

// 상품 카테고리 (폼 드롭다운과 일치)
const CATEGORIES = ['스킨케어', '메이크업', '향수', '헤어·바디', '이너뷰티', '뷰티 디바이스', '기타']

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// 상대경로 → 절대경로 + 이미지 URL 의 대괄호 인코딩
// 네이버 CDN(pstatic.net)의 ?type=f640 류 축소 파라미터는 제거해 원본 해상도를 받는다
function normalizeImage(src: string | undefined, base: string): string | null {
  if (!src) return null
  let abs = src.trim()
  if (!abs) return null
  try {
    const u = new URL(abs, base)
    if (/pstatic\.net$/i.test(u.hostname) && u.searchParams.has('type')) {
      u.searchParams.delete('type')
    }
    abs = u.href
  } catch {
    /* base 와 합치지 못하면 원본 유지 */
  }
  return abs.replace(/\[/g, '%5B').replace(/\]/g, '%5D')
}

// srcset("url 300w, url2 600w" 또는 "url 1x, url2 2x")에서 최대 해상도 후보 선택
function pickBestFromSrcset(srcset: string | undefined): string | null {
  if (!srcset) return null
  let best: { url: string; score: number } | null = null
  for (const part of srcset.split(',')) {
    const [u, desc] = part.trim().split(/\s+/)
    if (!u) continue
    const m = /^([\d.]+)([wx])$/.exec(desc ?? '')
    const score = m ? parseFloat(m[1]) * (m[2] === 'x' ? 1000 : 1) : 0
    if (!best || score > best.score) best = { url: u, score }
  }
  return best?.url ?? null
}

// 상품명 정제: 구분자 뒤 사이트명 제거 + 라벨("상품명/상품요약정보/소비자가/판매가") 잔여 제거
function cleanProductName(raw: string | null | undefined): string {
  let s = (raw ?? '').trim()
  if (!s) return ''
  // " - 사이트명", " | 사이트명" 형태에서 첫 구분자 앞부분만 사용
  s = s.split(/\s+[-|–—]\s+/)[0].trim()
  // 앞에 붙은 라벨 잔여 반복 제거 (예: "품요약정보 ...", "상품명 : ...")
  const LABEL = /^(?:상품명|상품요약정보|품요약정보|요약정보|소비자가|판매가|정가|할인가|적립금)\s*[:：]?\s*/
  let prev: string
  do {
    prev = s
    s = s.replace(LABEL, '').trim()
  } while (s !== prev && s)
  return s.trim()
}

// 숫자(가격) 정규화: number 또는 "33,000원" 같은 문자열 → 정수
function toIntOrNull(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null
  const digits = String(v).replace(/[^0-9]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : null
}

interface ScrapeData {
  name: string | null
  price: number | null
  sale_price: number | null
  description: string | null
  summary: string | null
  thumbnail_url: string | null
  category: string | null
  gallery: string[]
  images: string[]
  detail_images: string[]
}

// URL 파일명(쿼리/해시 제외)
function baseName(u: string): string {
  const clean = u.split('?')[0].split('#')[0]
  const parts = clean.split('/')
  return parts[parts.length - 1] || clean
}
// Cafe24 등 큰 이미지 폴더(/big/, /extra/big/)인지
function isBigFolder(u: string): boolean {
  return /\/(?:extra\/)?big\//i.test(u)
}

// Cafe24 축소 폴더(small/tiny/medium/extra/small) URL 을 big 후보로 치환하고
// HEAD 로 실존 확인 후에만 승격한다. (몰마다 big 미생성인 경우가 있어 무조건 치환은 404 위험 —
// 실측: extra/small→extra/big 은 존재, extra/small→big 은 404, cerolabs 는 big 자체가 없음)
async function upgradeCafe24Gallery(urls: string[]): Promise<string[]> {
  const SMALL_SEG = /\/web\/product\/(extra\/small|small|medium|tiny)\//i
  const headOk = async (u: string): Promise<boolean> => {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 3000)
      const r = await fetch(u, { method: 'HEAD', signal: ctl.signal })
      clearTimeout(t)
      return r.ok
    } catch {
      return false
    }
  }
  return Promise.all(
    urls.map(async (u) => {
      if (isBigFolder(u) || !SMALL_SEG.test(u)) return u
      const candidates = [
        u.replace(SMALL_SEG, '/web/product/extra/big/'),
        u.replace(SMALL_SEG, '/web/product/big/'),
      ]
      for (const c of candidates) {
        if (c !== u && (await headOk(c))) return c
      }
      return u // big 미존재 → 원본 유지 (깨진 링크 방지)
    })
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'POST 요청만 허용됩니다.' })
    return
  }

  // body 파싱 (문자열로 올 수도 있어 방어적으로 처리)
  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const url = (body as { url?: string } | null)?.url?.trim()

  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ ok: false, error: '올바른 상품 페이지 URL 을 입력해 주세요.' })
    return
  }

  // 1) 페이지 HTML 가져오기
  let html: string
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!resp.ok) {
      res.status(200).json({ ok: false, error: `페이지를 불러오지 못했습니다 (HTTP ${resp.status}).` })
      return
    }
    html = await resp.text()
  } catch {
    res.status(200).json({ ok: false, error: '페이지에 접근하지 못했습니다.' })
    return
  }

  // 2) 메타 태그 추출 (og:title / og:image / description)
  const $ = cheerio.load(html)
  const meta = (sel: string) => $(sel).attr('content')?.trim() || ''

  const ogTitle = meta('meta[property="og:title"]') || $('title').first().text().trim()
  // og:title 없을 때만 쓰는 상품명 요소 후보 (라벨 섞이지 않게 이름 영역만)
  const nameEl = (
    $('#span_product_name').first().text() ||
    $('.xans-product-detail .name').first().text() ||
    $('.infoArea .name, .headingArea h2, .detailArea .name').first().text() ||
    ''
  ).replace(/\s+/g, ' ').trim()
  const ogImage =
    meta('meta[property="og:image"]') ||
    meta('meta[name="og:image"]') ||
    meta('meta[property="og:image:url"]')
  const metaDesc =
    meta('meta[property="og:description"]') || meta('meta[name="description"]')

  const thumbnailUrl = normalizeImage(ogImage, url)

  // 상품 이미지 여러 장 수집 (og:image + img 태그). 로고/아이콘/배너 등은 제외.
  const rawImgs: string[] = []
  const pushImg = (raw: string | undefined | null) => {
    const n = normalizeImage(raw ?? undefined, url)
    if (n && /^https?:\/\//i.test(n)) rawImgs.push(n)
  }
  // og:image (여러 개일 수 있음) → 대표 이미지 후보로 먼저
  $('meta[property="og:image"], meta[name="og:image"], meta[property="og:image:url"]').each((_, el) => {
    pushImg($(el).attr('content'))
  })
  // img 태그 (지연로딩 속성 포함), 상품 무관 이미지 제외
  const EXCLUDE =
    /logo|icon|banner|btn|button|sprite|blank|pixel|spacer|common|footer|header|\bnav\b|badge|cart|search|social|sns|arrow|star|rating|1x1/i
  $('img').each((_, el) => {
    const $el = $(el)
    const src =
      pickBestFromSrcset($el.attr('srcset')) ||
      $el.attr('src') ||
      $el.attr('data-src') ||
      $el.attr('data-original') ||
      $el.attr('data-lazy') ||
      $el.attr('data-echo')
    if (!src || src.startsWith('data:')) return
    const hay = `${src} ${$el.attr('class') ?? ''} ${$el.attr('id') ?? ''} ${$el.attr('alt') ?? ''}`
    if (EXCLUDE.test(hay)) return
    pushImg(src)
  })
  // 중복 제거(순서 유지) + 개수 상한(20)
  const seenImg = new Set<string>()
  const images: string[] = []
  for (const u of rawImgs) {
    if (seenImg.has(u)) continue
    seenImg.add(u)
    images.push(u)
    if (images.length >= 20) break
  }

  // 대표 이미지 갤러리 전용 추출 (갤러리 컨테이너 안의 img 만)
  // Cafe24: .xans-product-image(대표) + .xans-product-addimage(추가), 그 외 일반 갤러리 컨테이너
  const GALLERY_SEL =
    '.keyImg, .xans-product-image, .xans-product-addimage, .xans-product-mobileimage, [class*="gallery"], [class*="Gallery"], .thumbnail, .listImg, .swiper-wrapper, .prdImg'
  const galleryRaw: string[] = []
  $(GALLERY_SEL)
    .find('img')
    .each((_, el) => {
      const $el = $(el)
      const src =
        pickBestFromSrcset($el.attr('srcset')) ||
        $el.attr('src') ||
        $el.attr('data-src') ||
        $el.attr('data-original') ||
        $el.attr('data-lazy')
      if (!src || src.startsWith('data:')) return
      // 스킨 버튼/아이콘(찜·돋보기 등) 이 갤러리 컨테이너에 섞이는 몰 방어
      const hay = `${src} ${$el.attr('class') ?? ''} ${$el.attr('id') ?? ''} ${$el.attr('alt') ?? ''}`
      if (EXCLUDE.test(hay) || /btn_|_btn|\/skin\//i.test(src)) return
      const n = normalizeImage(src, url)
      if (n && /^https?:\/\//i.test(n)) galleryRaw.push(n)
    })
  // 파일명 기준 dedupe — 같은 이미지의 small/big 중 big 폴더 버전 우선(치환 없이 실제 존재하는 URL만)
  const galleryByBase = new Map<string, string>()
  const galleryOrder: string[] = []
  for (const u of galleryRaw) {
    const b = baseName(u)
    const existing = galleryByBase.get(b)
    if (existing == null) {
      galleryByBase.set(b, u)
      galleryOrder.push(b)
    } else if (!isBigFolder(existing) && isBigFolder(u)) {
      galleryByBase.set(b, u) // 작은 폴더 → 큰 폴더 버전으로 승격
    }
  }
  // 페이지에 big 버전이 노출되지 않는 추가 이미지들은 폴더 치환+실존검증으로 승격
  const gallery = await upgradeCafe24Gallery(
    galleryOrder.map((b) => galleryByBase.get(b)!).slice(0, 20)
  )

  // ── 상세 이미지(본문 상세컷) 수집 — 상세 영역 안의 img 만, cheerio 로만 ──────
  // 상세 본문 컨테이너: Cafe24 기본(#prdDetail), 신형(.xans-product-detail),
  // edibot 스킨(.edibot-product-detail)
  const DETAIL_SEL = '#prdDetail, .xans-product-detail, .edibot-product-detail'
  // 상세컷에서 제외할 노이즈: 공통 스킨 도메인 / gif / 버튼·아이콘·배너 파일명
  const DETAIL_NOISE =
    /img\.echosting\.cafe24\.com|\.gif(?:\?|$)|btn|icon|banner|button|logo|sns|arrow|blank|spacer/i
  const detailRaw: string[] = []
  $(DETAIL_SEL)
    .find('img')
    .each((_, el) => {
      const $el = $(el)
      const src =
        $el.attr('src') ||
        $el.attr('data-src') ||
        $el.attr('ec-data-src') ||
        $el.attr('data-original') ||
        $el.attr('data-lazy')
      if (!src || src.startsWith('data:')) return
      const n = normalizeImage(src, url)
      if (!n || !/^https?:\/\//i.test(n)) return
      const hay = `${n} ${$el.attr('class') ?? ''} ${$el.attr('id') ?? ''} ${$el.attr('alt') ?? ''}`
      if (DETAIL_NOISE.test(hay)) return
      detailRaw.push(n)
    })
  // 순서 유지 + 중복 제거
  const seenDetail = new Set<string>()
  const detail_images: string[] = []
  for (const u of detailRaw) {
    if (seenDetail.has(u)) continue
    seenDetail.add(u)
    detail_images.push(u)
    if (detail_images.length >= 40) break
  }

  // 상품요약설명(간략설명) — 요약 요소 → og:description 순.
  // 가격/가격라벨 텍스트가 잡히면 버리고 다음 후보로 (가격을 넣느니 비워둔다)
  const looksLikePrice = (t: string): boolean => {
    if (!t) return true
    // 숫자+콤마/점+"원" 만으로 구성 (예: "17,000원", "11900")
    if (/^[0-9][0-9,.\s]*원?$/.test(t)) return true
    // 가격/적립/배송 관련 라벨 포함
    if (/(판매가|소비자가|공급가|정가|할인가|적립금|배송비)/.test(t)) return true
    return false
  }
  const summaryCandidates = [
    $('.simple-desc, [class*="simple-desc"]').first().text(),
    $('.product-simpledesc, .summary-desc, .short-desc, .prd-simpledesc').first().text(),
    meta('meta[property="og:description"]'),
  ]
  let summary: string | null = null
  for (const raw of summaryCandidates) {
    const t = (raw || '').replace(/\s+/g, ' ').trim()
    if (t && !looksLikePrice(t)) {
      summary = t.length > 500 ? t.slice(0, 500).trim() : t
      break
    }
  }

  // 본문 텍스트(노이즈 제거 후 일부) — Gemini 가격/카테고리 추출용
  $('script, style, noscript, svg, iframe').remove()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000)

  // 3) Gemini 로 가격/카테고리/상품명/설명 정밀 추출 (키 없거나 실패해도 og 값으로 대체)
  let ai: Partial<ScrapeData> = {}
  const apiKey = process.env.GEMINI_API_KEY
  if (apiKey) {
    try {
      const genAI = new GoogleGenAI({ apiKey })
      const prompt = `다음은 한 쇼핑몰 "상품 상세 페이지"의 메타데이터와 본문 텍스트다.
이 페이지의 "메인 상품 1개"에 대한 정보만 추출하라.
페이지 하단의 "추천 상품 / 함께 본 상품 / 연관 상품" 영역의 다른 상품 정보는 절대 포함하지 마라.

반드시 아래 키만 가진 JSON 객체로만 답하라(설명·코드블록 금지):
{
  "name": 메인 상품명(문자열) 또는 null,
  "price": 정가(할인 전 가격, 숫자만, 원 단위 정수) 또는 null,
  "sale_price": 판매가(실제 판매/할인가, 숫자만, 정수) 또는 null,
  "description": 상품 핵심 설명 2~4문장(문자열) 또는 null,
  "category": 다음 중 하나로만 분류 ["스킨케어","메이크업","향수","헤어·바디","이너뷰티","뷰티 디바이스","기타"] 또는 null
}
규칙:
- price 와 sale_price 가 같으면 sale_price 는 null.
- 정가만 있으면 price 에 넣고 sale_price 는 null.
- 숫자에 콤마/원/통화기호를 넣지 말 것(예: 33000).

[og:title]
${ogTitle}

[meta description]
${metaDesc}

[본문 텍스트]
${bodyText}`

      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      })

      const raw = (result.text ?? '').replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim()
      const objMatch = raw.match(/\{[\s\S]*\}/)
      if (objMatch) {
        ai = JSON.parse(objMatch[0]) as Partial<ScrapeData>
      }
    } catch (e) {
      console.error('[scrape-product] Gemini 실패:', e)
      // 무시하고 og 값으로 진행
    }
  }

  // 4) 병합 (Gemini 우선, 없으면 og/meta 값)
  const category =
    ai.category && CATEGORIES.includes(ai.category) ? ai.category : null

  const data: ScrapeData = {
    // 상품명: og:title(정제) 1순위 → 상품명 요소(정제) → Gemini(정제) 순
    name:
      cleanProductName(ogTitle) ||
      cleanProductName(nameEl) ||
      cleanProductName(ai.name ? String(ai.name) : '') ||
      null,
    price: toIntOrNull(ai.price),
    sale_price: toIntOrNull(ai.sale_price),
    description: (ai.description && String(ai.description).trim()) || metaDesc || null,
    summary,
    thumbnail_url: gallery[0] ?? images[0] ?? thumbnailUrl, // 대표 = 갤러리 첫 장
    category,
    gallery, // 대표 이미지 갤러리(순서 유지)
    images, // 페이지 전체 이미지(상세/폴백용)
    detail_images, // 상세 본문 이미지(순서 유지)
  }

  res.status(200).json({ ok: true, data })
}
