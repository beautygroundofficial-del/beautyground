import { readFileSync } from 'fs'

const SUPA = 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const KEY = 'sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const CAP = 50

async function login() {
  const r = await fetch(SUPA + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test3@test.com', password: 'test1234' }),
  })
  return (await r.json()).access_token
}
async function patchProduct(token, id, payload) {
  const r = await fetch(SUPA + '/rest/v1/products?id=eq.' + id, {
    method: 'PATCH',
    headers: { apikey: KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error('patch ' + r.status + ' ' + (await r.text()).slice(0, 150))
}

function extractProductNo(url) {
  const m = url.match(/\/(\d+)\/category\//)
  return m ? m[1] : null
}

async function fetchAlphReviews(productNo, cap) {
  const url = `https://review-widget.alphwidget.com/v2/api-widget?page=1&page_size=${cap}&sort=-like_count&media_only=false&product_no=${productNo}&widget_code=d782a582&device=w`
  const res = await fetch(url)
  if (!res.ok) throw new Error('alphwidget ' + res.status)
  const arr = await res.json()
  return arr.map((r) => ({
    rating: r.ratings ?? 5,
    text: (r.content || '').trim(),
    photo: r.ordered_media?.[0]?.photo_platform_url || r.ordered_media?.[0]?.photo_url || null,
    photos: r.ordered_media?.length ? r.ordered_media.map((m) => m.photo_platform_url || m.photo_url).filter(Boolean) : undefined,
    date: null,
    author: r.user_info || null,
  }))
}

const token = await login()
const comingle = JSON.parse(readFileSync('comingle-pending.json', 'utf8'))
comingle.push({
  id: 'b0e5b850-be13-4f6c-ab17-5be47a46e902',
  name: '커밍글 원케어 퍼퓸 데일리 스칼프 탈모 샴푸 500ml',
  source_url: 'https://cominglebeauty.com/product/%EC%BB%A4%EB%B0%8D%EA%B8%80-%EC%9B%90%EC%BC%80%EC%96%B4-%ED%8D%BC%ED%93%B8-%EB%8D%B0%EC%9D%BC%EB%A6%AC-%EC%8A%A4%EC%B9%BC%ED%94%84-%ED%83%88%EB%AA%A8-%EC%83%B4%ED%91%B8/9/category/29/display/1/',
})

console.log(`comingle 대상 ${comingle.length}개`)
for (const t of comingle) {
  try {
    await patchProduct(token, t.id, { source_url: t.source_url })
    const no = extractProductNo(t.source_url)
    const reviews = await fetchAlphReviews(no, CAP)
    const clean = reviews.filter((r) => (r.text && r.text.length > 1) || r.photo)
    const withText = clean.filter((r) => r.text && r.text.length > 1).length
    const withPhoto = clean.filter((r) => r.photo).length
    const avg = clean.length ? Math.round((clean.reduce((s, r) => s + (r.rating ?? 5), 0) / clean.length) * 10) / 10 : null
    const photos = clean.filter((r) => r.photo).slice(0, 12)
      .map((r) => ({ url: r.photo, text: r.text || '', rating: r.rating, author: r.author, date: r.date }))
    const review_summary = { count: clean.length, avg, photos }
    await patchProduct(token, t.id, { scraped_reviews: clean, review_summary })
    console.log(`${t.name} — 수집${clean.length} 본문${withText} 사진${withPhoto} avg${avg}`)
  } catch (e) {
    console.log(`${t.name} — 실패: ${String(e.message || e).slice(0, 100)}`)
  }
}
