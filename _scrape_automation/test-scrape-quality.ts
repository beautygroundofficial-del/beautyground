// scrape-product 핸들러를 mock req/res 로 직접 호출해 갤러리 화질(big 폴더) 검증
import handler from '../api/scrape-product'

const TEST_URLS = [
  'https://www.petitfee.com/product/카카오-에너자이징-아이패치/711/category/24/display/1/',
  'https://kiwiglow.co.kr/product/%ED%82%A4%EC%9C%84%EA%B8%80%EB%A1%9C%EC%9A%B0-%EC%95%84%EB%88%84%EC%B9%B4-%EC%95%A0%ED%94%8C-%EB%B9%84%EB%8B%88%EA%B1%B0-%EC%83%B4%ED%91%B8%ED%8A%B8%EB%A6%AC%ED%8A%B8%EB%A8%BC%ED%8A%B8/73/category/66/display/1/',
  'https://cerolabs.co.kr/product/%EC%9D%B8%ED%85%90%EC%8A%A4-%EB%A6%AC%ED%8E%98%EC%96%B4-%ED%81%AC%EB%A6%BC/24/category/24/display/1/',
]

async function run(url: string) {
  const req = { method: 'POST', body: { url } } as any
  let payload: any = null
  const res = {
    status: () => res,
    json: (j: any) => { payload = j },
    setHeader: () => res,
  } as any
  await handler(req, res)
  if (!payload?.ok) { console.log(url, '→ 실패:', payload?.error); return }
  const g: string[] = payload.data.gallery
  const bigCount = g.filter((u) => /\/(?:extra\/)?big\//i.test(u)).length
  console.log(`\n=== ${url}`)
  console.log(`갤러리 ${g.length}장 / big 해상도 ${bigCount}장`)
  g.forEach((u) => console.log(' ', /big\//i.test(u) ? '[BIG]' : '[sml]', u.slice(-70)))
  console.log('상세', payload.data.detail_images.length, '장 / 가격', payload.data.price, '/', payload.data.sale_price)
}

async function main() {
  for (const u of TEST_URLS) await run(u)
}
main()
