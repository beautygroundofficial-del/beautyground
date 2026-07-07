const SUPA = 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const KEY = 'sb_publishable_nuBbC2D1_S_eV0fA9OAjhQ_ntsloX0Q'
const PHOTO_BASE = 'https://spdy-flexg-ha.flexgate.co.kr/data/reviewimg/dailylabs/thum3/'

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
async function fetchReviews(mgCode, pagesize) {
  const res = await fetch('https://www.cellinffect.com/Goods/GetReviewList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ param: { page: 1, pagesize, mg_code: mgCode, orderBy: 'new' } }),
  })
  const j = await res.json()
  const total = j?.dataTotalCount ?? j?.data?.dataTotalCount ?? 0
  const rows = (j?.data?.data ?? []).map((r) => {
    const photos = (r.photoList || '').split('~|~').filter(Boolean).map((f) => PHOTO_BASE + f)
    return {
      rating: r.c_grade ?? 5,
      text: (r.c_content || '').trim(),
      photo: photos[0] ?? null,
      photos: photos.length ? photos : undefined,
      date: r.c_regdate || null,
      author: r.c_name || null,
    }
  })
  return { count: total, rows }
}

const targets = [
  { id: 'a8af8af9-f3ae-4667-a48e-5d21bbc4a67c', name: '무중력 리프팅 크림(EMS 디바이스 포함)', mgCode: 'SDA15457297', url: 'https://www.cellinffect.com/Goods/Detail/SDA15457297' },
  { id: '7b22ee52-0f42-472d-96e4-e08c6b57c978', name: '트리플 딥케어 마스크팩(1BOX/15매입)', mgCode: 'SDA79171681', url: 'https://www.cellinffect.com/Goods/Detail/SDA79171681' },
]

const token = await login()
for (const t of targets) {
  const { count, rows } = await fetchReviews(t.mgCode, 50)
  const clean = rows.filter((r) => (r.text && r.text.length > 1) || r.photo)
  const withText = clean.filter((r) => r.text && r.text.length > 1).length
  const withPhoto = clean.filter((r) => r.photo).length
  const avg = clean.length ? Math.round((clean.reduce((s, r) => s + r.rating, 0) / clean.length) * 10) / 10 : null
  const photos = clean.filter((r) => r.photo).slice(0, 12).map((r) => ({ url: r.photo, text: r.text || '', rating: r.rating, author: r.author, date: r.date }))
  await patchProduct(token, t.id, { source_url: t.url, scraped_reviews: clean, review_summary: { count, avg, photos } })
  console.log(`${t.name} — 총${count} 수집${clean.length} 본문${withText} 사진${withPhoto} avg${avg}`)
}
