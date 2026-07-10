// 팝업 로직 — 활성 탭에서 상품정보 추출(MAIN world 주입) 후 등록폼으로 전달
const FORM_URL = 'https://beautyground.vercel.app/partner/products/new'

const el = (id) => document.getElementById(id)
let extracted = null
let currentTab = null

// ── 스마트스토어 추출기 (페이지 MAIN world 에서 실행됨 — 자체 완결 함수여야 함) ──
function extractSmartstore() {
  const clean = (u) => (u || '').split('?')[0]
  const uniq = (arr) => [...new Set(arr.filter(Boolean))]

  // __PRELOADED_STATE__ 깊이 탐색으로 상품 객체/상세HTML 을 찾는다 (구조 변경에 강함)
  const state = window.__PRELOADED_STATE__
  let product = null
  let detailHtml = ''
  if (state && typeof state === 'object') {
    const queue = [state]
    const seen = new Set()
    let guard = 0
    while (queue.length && guard++ < 20000) {
      const cur = queue.shift()
      if (!cur || typeof cur !== 'object' || seen.has(cur)) continue
      seen.add(cur)
      if (!product && typeof cur.name === 'string' && typeof cur.salePrice === 'number' &&
          (Array.isArray(cur.productImages) || cur.representImage)) {
        product = cur
      }
      for (const v of Object.values(cur)) {
        if (typeof v === 'string' && v.length > 500 && v.includes('<img') && v.length > detailHtml.length) {
          detailHtml = v
        } else if (v && typeof v === 'object') {
          queue.push(v)
        }
      }
    }
  }

  let name = product?.name || document.querySelector('meta[property="og:title"]')?.content || ''
  name = name.replace(/\s*:\s*.*스마트스토어.*$/, '').trim()

  const price = typeof product?.salePrice === 'number' ? product.salePrice : null
  // 할인가는 product 하위 어딘가(benefitsView 등)의 discountedSalePrice
  let salePrice = null
  if (product) {
    const q = [product]; const s2 = new Set(); let g = 0
    while (q.length && g++ < 3000) {
      const cur = q.shift()
      if (!cur || typeof cur !== 'object' || s2.has(cur)) continue
      s2.add(cur)
      if (typeof cur.discountedSalePrice === 'number') { salePrice = cur.discountedSalePrice; break }
      for (const v of Object.values(cur)) if (v && typeof v === 'object') q.push(v)
    }
  }

  // 갤러리: productImages[].url (원본 CDN, ?type= 제거) / 폴백 og:image
  let gallery = []
  if (Array.isArray(product?.productImages)) {
    gallery = product.productImages.map((im) => clean(im?.url)).filter(Boolean)
  }
  if (gallery.length === 0) {
    const og = document.querySelector('meta[property="og:image"]')?.content
    if (og) gallery = [clean(og)]
  }

  // 상세 이미지: detailContent HTML 파싱 (data-src 우선) / 폴백 본문 에디터 영역 DOM
  let detailImages = []
  if (detailHtml) {
    const doc = new DOMParser().parseFromString(detailHtml, 'text/html')
    detailImages = [...doc.querySelectorAll('img')]
      .map((img) => clean(img.getAttribute('data-src') || img.getAttribute('src')))
      .filter(Boolean)
  }
  if (detailImages.length === 0) {
    detailImages = [...document.querySelectorAll('.se-main-container img, #INTRODUCE img')]
      .map((img) => clean(img.getAttribute('data-src') || img.currentSrc || img.src))
      .filter(Boolean)
  }

  const summary = document.querySelector('meta[property="og:description"]')?.content || ''

  return {
    source: 'smartstore',
    url: location.href.split('?')[0],
    name,
    price,
    sale_price: salePrice != null && salePrice !== price ? salePrice : null,
    thumbnail_url: gallery[0] || null,
    gallery: uniq(gallery),
    detail_images: uniq(detailImages),
    summary,
  }
}

// ── 쿠팡 추출기 (MAIN world) — 지연로딩 상세를 위해 자동 스크롤 후 수집 ──
async function extractCoupang() {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))]
  const abs = (u) => (u && u.startsWith('//') ? 'https:' + u : u)
  const upsize = (u) => (u || '').replace(/\/(\d+)x(\d+)ex\//, '/700x700ex/')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  // 상세영역 지연 이미지 로드 유도
  const h = document.body.scrollHeight
  for (let i = 1; i <= 5; i++) { window.scrollTo(0, (h * i) / 5); await sleep(500) }
  await sleep(700)
  window.scrollTo(0, 0)

  const name = (document.querySelector('.prod-buy-header__title')?.textContent || '').trim() ||
    (document.querySelector('meta[property="og:title"]')?.content || '').trim()

  const num = (t) => {
    const m = (t || '').replace(/[^\d]/g, '')
    return m ? Number(m) : null
  }
  const salePrice = num(document.querySelector('.prod-sale-price .total-price, .total-price strong')?.textContent)
  const originPrice = num(document.querySelector('.origin-price')?.textContent)

  const gallery = uniq(
    [...document.querySelectorAll('.prod-image__item img, .prod-image__detail')]
      .map((img) => upsize(abs(img.getAttribute('src') || img.getAttribute('data-src'))))
  )

  const detailImages = uniq(
    [...document.querySelectorAll('.product-detail-content img, #productDetail img, .vendor-item img')]
      .map((img) => abs(img.getAttribute('data-src') || img.currentSrc || img.getAttribute('src')))
      .filter((u) => u && !/blank|loading|icon|logo|1x1/.test(u))
  )

  return {
    source: 'coupang',
    url: location.href.split('?')[0],
    name,
    price: originPrice ?? salePrice,
    sale_price: originPrice && salePrice && salePrice !== originPrice ? salePrice : null,
    thumbnail_url: gallery[0] || null,
    gallery,
    detail_images: detailImages,
    summary: document.querySelector('meta[name="description"]')?.content || '',
  }
}

function detectSite(url) {
  if (/smartstore\.naver\.com\/.+\/products\//.test(url)) return 'smartstore'
  if (/coupang\.com\/vp\/products\//.test(url)) return 'coupang'
  return null
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab = tab
  const site = detectSite(tab?.url || '')
  if (site === 'smartstore') el('site').innerHTML = '현재 페이지: <b>네이버 스마트스토어</b> 상품'
  else if (site === 'coupang') el('site').innerHTML = '현재 페이지: <b>쿠팡</b> 상품'
  else {
    el('site').textContent = '스마트스토어/쿠팡 상품 페이지에서 열어주세요.'
    el('extract').disabled = true
  }
}

el('extract').addEventListener('click', async () => {
  const site = detectSite(currentTab?.url || '')
  if (!site) return
  el('extract').disabled = true
  el('extract').textContent = '추출 중... (쿠팡은 스크롤 때문에 몇 초 걸려요)'
  el('msg').textContent = ''
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      world: 'MAIN',
      func: site === 'smartstore' ? extractSmartstore : extractCoupang,
    })
    extracted = result
    if (!result?.name && !(result?.gallery || []).length) {
      el('msg').textContent = '추출 실패 — 상품 페이지가 맞는지 확인해 주세요.'
      return
    }
    el('result').style.display = 'block'
    el('result').innerHTML = `
      <div class="row"><span class="k">상품명</span><span>${(result.name || '-').slice(0, 22)}${(result.name || '').length > 22 ? '…' : ''}</span></div>
      <div class="row"><span class="k">정가</span><span>${result.price != null ? result.price.toLocaleString() + '원' : '-'}</span></div>
      <div class="row"><span class="k">판매가</span><span>${result.sale_price != null ? result.sale_price.toLocaleString() + '원' : '(정가와 동일)'}</span></div>
      <div class="row"><span class="k">대표 이미지</span><span>${result.gallery.length}장</span></div>
      <div class="row"><span class="k">상세 이미지</span><span>${result.detail_images.length}장</span></div>`
    el('send').style.display = 'block'
    el('copy').style.display = 'block'
    el('msg').className = 'ok'
    el('msg').textContent = '추출 완료! ②번을 눌러 등록폼으로 보내세요.'
  } catch (e) {
    el('msg').textContent = '오류: ' + (e?.message || e)
  } finally {
    el('extract').disabled = false
    el('extract').textContent = '① 상품 정보 추출'
  }
})

el('send').addEventListener('click', async () => {
  if (!extracted) return
  await chrome.storage.local.set({ pendingImport: extracted })
  await chrome.tabs.create({ url: FORM_URL })
})

el('copy').addEventListener('click', async () => {
  if (!extracted) return
  await navigator.clipboard.writeText(JSON.stringify(extracted, null, 2))
  el('msg').className = 'ok'
  el('msg').textContent = 'JSON 이 클립보드에 복사됐어요.'
})

init()
