import { affiliateLinkUrl, createAffiliateLink, getMyAffiliate } from './affiliate'

// 제품 링크 복사·공유 (2026-10-14 대표님 지시: 파트너스는 판매자 화면에서만이 아니라 쇼핑몰의 어느 제품에서든
// 링크를 복사·공유할 수 있어야 한다).
//  - 활동 중인 파트너가 누르면 그 제품의 "내 파트너스 링크"(/go/코드)가 자동으로 만들어져(이미 있으면 그대로) 복사·공유된다.
//  - 그 밖의 사람(비로그인·일반 회원·정지된 파트너)은 제품 주소 그대로.
// 링크는 누르는 순간에만 만든다 — 제품을 둘러보기만 해도 "내 링크 전체"에 쌓이는 일이 없게.

export function plainProductUrl(productId: string): string {
  return `${window.location.origin}/app/product/${productId}`
}

export async function resolveShareUrl(productId: string): Promise<{ url: string; mine: boolean }> {
  try {
    const aff = await getMyAffiliate()
    if (aff && aff.status === 'active') {
      const res = await createAffiliateLink(productId)
      if (res.ok) return { url: affiliateLinkUrl(res.link.code), mine: true }
    }
  } catch { /* 파트너 확인·링크 생성에 실패하면 일반 주소로 */ }
  return { url: plainProductUrl(productId), mine: false }
}

// 사용자 클릭 직후 비동기로 주소를 구한 뒤 복사 — 아이폰 사파리는 await 뒤 writeText를 막을 수 있어
// ClipboardItem(약속 값)을 먼저 건네는 방식을 우선 쓰고, 안 되면 writeText → 구형 방식 순으로 시도한다.
export async function copyToClipboard(textPromise: Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const blob = textPromise.then((t) => new Blob([t], { type: 'text/plain' }))
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
      return true
    }
  } catch { /* 다음 방법 */ }
  const text = await textPromise
  try { await navigator.clipboard.writeText(text); return true } catch { /* 다음 방법 */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); document.body.removeChild(ta)
    return ok
  } catch { return false }
}

// ── 카카오톡 공유 ──────────────────────────────────────────────────────────
// 카카오 JavaScript 키(VITE_KAKAO_JS_KEY)가 설정돼 있고 카카오 개발자 콘솔에 이 사이트 주소가 등록돼 있어야 카카오톡 "친구에게 보내기" 창이 뜬다.
// 키가 없으면 휴대폰 공유창(카카오톡 포함) → 링크 복사 순으로 대신한다.
const KAKAO_KEY = (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) || ''
export const kakaoSdkConfigured = KAKAO_KEY.length > 0

interface KakaoSdk {
  isInitialized(): boolean
  init(key: string): void
  Share: { sendDefault(opts: Record<string, unknown>): void }
}
let kakaoLoading: Promise<KakaoSdk | null> | null = null
function loadKakao(): Promise<KakaoSdk | null> {
  if (!kakaoSdkConfigured) return Promise.resolve(null)
  if (kakaoLoading) return kakaoLoading
  kakaoLoading = new Promise((resolve) => {
    const w = window as unknown as { Kakao?: KakaoSdk }
    const ready = () => {
      try { if (w.Kakao && !w.Kakao.isInitialized()) w.Kakao.init(KAKAO_KEY); resolve(w.Kakao ?? null) } catch { resolve(null) }
    }
    if (w.Kakao) { ready(); return }
    const s = document.createElement('script')
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
    s.async = true
    s.onload = ready
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
  return kakaoLoading
}

export async function shareToKakao(opts: { url: string; title: string; description: string; imageUrl: string | null }): Promise<boolean> {
  if (!opts.imageUrl || !/^https:\/\//.test(opts.imageUrl)) return false // 카카오 피드 카드는 https 이미지가 필요
  const kakao = await loadKakao()
  if (!kakao) return false
  try {
    const link = { mobileWebUrl: opts.url, webUrl: opts.url }
    kakao.Share.sendDefault({
      objectType: 'feed',
      content: { title: opts.title, description: opts.description, imageUrl: opts.imageUrl, link },
      buttons: [{ title: '제품 보기', link }],
    })
    return true
  } catch { return false }
}

export const canNativeShare = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function'
