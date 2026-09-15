// 배포 후 수동 스모크 체크 — 대표님 지시(2026-09-15) "로컬 테스트 없이 바로 배포"로 바뀌면서
// CS담당(가상직원) 제안으로 만든 최소 안전장치. 핵심 URL 몇 개가 살아있는지만 빠르게 확인한다.
// 잡는 것: 빌드는 성공했는데 런타임이 깨진 배포, 서버리스 함수 12/12 한도 초과로 API가 조용히
// 404 나는 경우. 못 잡는 것: 특정 시나리오(로그인 후 특정 동작)의 로직 버그.
// 실행: npm run smoke  (사람이 배포 직후 직접 돌려야 함 — 자동 트리거 아님)

const BASE = process.env.SMOKE_BASE_URL || 'https://beautyground.co.kr'

const CHECKS = [
  { name: '홈', url: `${BASE}/`, expectContains: '<div id="root"' },
  { name: '사이트맵(DB읽기 포함)', url: `${BASE}/api/sitemap.xml`, expectContains: '<urlset' },
  { name: '회사소개 OG', url: `${BASE}/api/company-og?page=company`, expectContains: 'LIFE IS BEAUTY' },
]

let failed = 0

for (const check of CHECKS) {
  const start = Date.now()
  try {
    const res = await fetch(check.url, { redirect: 'follow' })
    const body = await res.text()
    const ms = Date.now() - start
    const looksBroken = /Internal Server Error|FUNCTION_INVOCATION_FAILED|NOT_FOUND|<pre>Error/i.test(body)
    const hasExpected = check.expectContains ? body.includes(check.expectContains) : true

    if (res.status === 200 && !looksBroken && hasExpected) {
      console.log(`✅ ${check.name} — ${res.status} (${ms}ms)`)
    } else {
      failed++
      console.error(`❌ ${check.name} — status=${res.status} looksBroken=${looksBroken} hasExpected=${hasExpected} (${ms}ms)`)
      console.error(`   ${check.url}`)
      console.error(`   응답 앞부분: ${body.slice(0, 200).replace(/\s+/g, ' ')}`)
    }
  } catch (err) {
    failed++
    console.error(`❌ ${check.name} — 요청 자체 실패: ${err.message}`)
  }
}

console.log('')
if (failed > 0) {
  console.error(`${failed}/${CHECKS.length}개 실패`)
  process.exit(1)
} else {
  console.log(`전부 정상 (${CHECKS.length}/${CHECKS.length})`)
}
