// 기존 등록 상품의 갤러리(대표 이미지들) 화질 일괄 업그레이드
// - Cafe24 축소폴더(small/medium/tiny/extra/small) → extra/big | big 치환 후 HEAD 실존검증 통과 시에만 교체
// - 스킨 버튼/아이콘(btn_, /skin/) 정크 제거
// - detail_images 는 건드리지 않음(이전 세션에서 원본 해상도로 정리 완료된 영역)
// 사용법:
//   node upgrade-gallery-quality.mjs --check <product_id>   1개 미리보기(변경 없음)
//   node upgrade-gallery-quality.mjs --apply <product_id>   1개 적용
//   node upgrade-gallery-quality.mjs --all                  전체 순차 적용(1개씩, 건별 로그)
import fs from 'fs'

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
const SUPA = env.match(/VITE_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/VITE_SUPABASE_ANON_KEY=(.+)/)[1].trim()

const SMALL_SEG = /\/web\/product\/(extra\/small|small|medium|tiny)\//i
const BIG_SEG = /\/web\/product\/(?:extra\/)?big\//i
const JUNK = /btn_|_btn|\/skin\/|icon_zoom|wish_before/i

async function login() {
  const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test3@test.com', password: 'test1234' }),
  })
  const s = await r.json()
  if (!s.access_token) throw new Error('로그인 실패')
  return s.access_token
}

import { imageSize } from 'image-size'

// 이미지 앞 128KB 를 받아 실제 픽셀 크기를 파싱 — 없거나 파싱 실패면 null
// (몰마다 폴더별 리사이즈 설정이 달라 폴더명만으로는 화질 판단 불가 —
//  실측: petitfee 는 extra/small 600px > extra/big 500px 로 오히려 big 이 작음!)
async function measure(u) {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 6000)
    const r = await fetch(u, { headers: { Range: 'bytes=0-131071', 'User-Agent': 'Mozilla/5.0' }, signal: ctl.signal })
    clearTimeout(t)
    if (!(r.status === 200 || r.status === 206)) return null
    const buf = Buffer.from(await r.arrayBuffer())
    const dim = imageSize(buf)
    return dim?.width ? dim : null
  } catch { return null }
}

// 한 URL 업그레이드: {url, changed, reason}
// 후보(extra/big, big)가 존재하고 "실제 픽셀이 원본보다 큰 경우에만" 교체한다.
async function upgradeUrl(u) {
  if (typeof u !== 'string' || !u.trim()) return { url: u, changed: false }
  if (JUNK.test(u)) return { url: null, changed: true, reason: '정크 제거' }
  if (BIG_SEG.test(u) || !SMALL_SEG.test(u)) return { url: u, changed: false }

  const orig = await measure(u)
  let best = { url: u, w: orig?.width ?? 0 }
  for (const target of ['/web/product/extra/big/', '/web/product/big/']) {
    const cand = u.replace(SMALL_SEG, target)
    if (cand === u) continue
    const dim = await measure(cand)
    if (dim && dim.width > best.w) best = { url: cand, w: dim.width }
  }
  if (best.url !== u) {
    return { url: best.url, changed: true, reason: `${orig?.width ?? '?'}px → ${best.w}px` }
  }
  return { url: u, changed: false, reason: `원본이 최대(${orig?.width ?? '?'}px) — 유지` }
}

async function processProduct(p, TOKEN, apply) {
  const gallery = Array.isArray(p.gallery_images) ? p.gallery_images : []
  const results = await Promise.all(gallery.map(upgradeUrl))
  const newGallery = results.map((r) => r.url).filter(Boolean)
  const changes = results.filter((r) => r.changed)

  // 대표 썸네일도 같은 규칙으로
  const thumbRes = await upgradeUrl(p.thumbnail_url)
  const newThumb = thumbRes.url || newGallery[0] || p.thumbnail_url

  const changed = changes.length > 0 || thumbRes.changed
  console.log(`\n[${p.name}]`)
  console.log(`  갤러리 ${gallery.length}장 → ${newGallery.length}장 / 변경 ${changes.length}건 / 썸네일 ${thumbRes.changed ? '업그레이드' : '유지'}`)
  changes.slice(0, 12).forEach((c, i) => console.log(`   - ${c.reason}${c.url ? ' ' + c.url.slice(-55) : ''}`))

  if (!changed) { console.log('  변경 없음 — 건너뜀'); return { changed: false, ok: true } }
  if (!apply) { console.log('  (미리보기 모드 — 적용 안 함)'); return { changed: true, ok: true } }

  // 적용 전 안전검증: 새 URL 전부 실존(픽셀 파싱 성공 = 이미지로 접근 가능) — 하나라도 죽으면 적용 중단
  const alive = await Promise.all(newGallery.map(async (u) => (await measure(u)) != null))
  if (alive.some((a) => !a)) { console.log('  ❌ 새 URL 중 접근 불가 존재 — 적용 중단'); return { changed: true, ok: false } }

  const resp = await fetch(`${SUPA}/rest/v1/products?id=eq.${p.id}`, {
    method: 'PATCH',
    headers: { apikey: ANON, Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ gallery_images: newGallery, thumbnail_url: newThumb }),
  })
  const ok = resp.status === 204 || resp.status === 200
  console.log(`  ${ok ? '✅ 적용 완료' : '❌ PATCH 실패 HTTP ' + resp.status}`)
  return { changed: true, ok }
}

const mode = process.argv[2]
const arg = process.argv[3]
const TOKEN = await login()
const H = { apikey: ANON, Authorization: `Bearer ${TOKEN}` }

if (mode === '--check' || mode === '--apply') {
  const rows = await (await fetch(`${SUPA}/rest/v1/products?select=id,name,gallery_images,thumbnail_url&id=eq.${arg}`, { headers: H })).json()
  if (!rows.length) { console.log('상품 없음:', arg); process.exit(1) }
  await processProduct(rows[0], TOKEN, mode === '--apply')
} else if (mode === '--all' || mode === '--scan') {
  const apply = mode === '--all'
  const rows = await (await fetch(`${SUPA}/rest/v1/products?select=id,name,gallery_images,thumbnail_url&order=created_at.asc&limit=500`, { headers: H })).json()
  console.log(`전체 ${rows.length}개 상품 — 순차 ${apply ? '적용' : '스캔(읽기전용)'} 시작`)
  let upgraded = 0, skipped = 0, failed = 0
  const changedList = []
  for (const p of rows) {
    const r = await processProduct(p, TOKEN, apply)
    if (!r.ok) failed++
    else if (r.changed) { upgraded++; changedList.push(p.id + ' | ' + p.name) }
    else skipped++
  }
  console.log(`\n===== 요약: ${apply ? '업그레이드' : '변경 예정'} ${upgraded} / 변경없음 ${skipped} / 실패 ${failed} =====`)
  if (changedList.length) { console.log('대상 목록:'); changedList.forEach((s) => console.log(' ', s)) }
} else {
  console.log('사용법: --check <id> | --apply <id> | --scan(전수 미리보기) | --all(전수 적용)')
}
