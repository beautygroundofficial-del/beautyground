import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 네이버 로그인 — Supabase가 네이버를 공식 지원하지 않아 커스텀으로 처리한다.
// 흐름: 프론트에서 받은 code를 네이버 토큰으로 교환 → 프로필 조회(이메일 필수) →
// Supabase에 유저 없으면 생성 → magiclink용 hashed_token 발급해 프론트로 반환.
// 프론트는 그 token으로 supabase.auth.verifyOtp(type:'magiclink')를 호출해 세션을 완성한다.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const NAVER_CLIENT_ID = process.env.VITE_NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'POST 요청만 허용됩니다.' })
    return
  }
  if (!SERVICE_ROLE || !NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락 (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY)' })
    return
  }

  let body: unknown = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  const { code, state } = (body as { code?: string; state?: string }) || {}
  if (!code || !state) {
    res.status(400).json({ ok: false, reason: 'code/state가 필요합니다.' })
    return
  }

  // 1) 인가코드 → 네이버 액세스 토큰 교환
  const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token')
  tokenUrl.searchParams.set('grant_type', 'authorization_code')
  tokenUrl.searchParams.set('client_id', NAVER_CLIENT_ID)
  tokenUrl.searchParams.set('client_secret', NAVER_CLIENT_SECRET)
  tokenUrl.searchParams.set('code', code)
  tokenUrl.searchParams.set('state', state)

  let tokenJson: any
  try {
    const tokenRes = await fetch(tokenUrl.toString())
    tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson?.access_token) throw new Error(JSON.stringify(tokenJson))
  } catch (e) {
    console.error('[auth-naver] token exchange failed', e)
    res.status(400).json({ ok: false, reason: '네이버 인증에 실패했습니다. 다시 시도해 주세요.' })
    return
  }

  // 2) 네이버 프로필 조회
  let profile: any
  try {
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const profileJson = await profileRes.json()
    if (profileJson?.resultcode !== '00' || !profileJson?.response) throw new Error(JSON.stringify(profileJson))
    profile = profileJson.response
  } catch (e) {
    console.error('[auth-naver] profile fetch failed', e)
    res.status(400).json({ ok: false, reason: '네이버 프로필 조회에 실패했습니다.' })
    return
  }

  const email: string | undefined = profile.email
  const name: string | undefined = profile.name || profile.nickname
  const naverId: string = profile.id
  // 휴대전화번호는 더 이상 필수 동의 항목이 아니다(2026-09-09 — 로그인 단계에서 개인정보를
  // 많이 요구하면 이탈률이 올라간다는 대표님 판단, 카카오 로그인과 동일하게 최소 정보만 받도록
  // 네이버 개발자센터 권한 설정을 이메일만 필수로 낮췄다). profile.mobile은 이제 거의 항상 없다 —
  // block_duplicate_phone_signup 트리거는 phone이 없으면 통과시키게 이미 돼 있어(카카오 가입과 동일
  // 경로) 문제없다. 값이 오면 참고용으로만 저장한다.
  const phone: string | undefined = profile.mobile

  if (!email) {
    res.status(400).json({
      ok: false,
      reason: '네이버 계정에 이메일이 등록되어 있지 않습니다. 네이버ID > 내 프로필 > 연락처 이메일을 등록한 뒤 다시 시도해 주세요.',
    })
    return
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 3) 유저 없으면 생성(이미 있으면 무시하고 계속 진행)
  const { error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name, phone, naver_id: naverId, provider: 'naver' },
  })
  if (createErr && !/already.*registered|already exists/i.test(createErr.message || '')) {
    console.error('[auth-naver] createUser failed', createErr)
    res.status(500).json({ ok: false, reason: '회원 생성 중 오류가 발생했습니다.' })
    return
  }

  // 4) 세션 발급용 OTP 코드 생성 — 프론트에서 verifyOtp(type:'email')로 교환해 세션 완성.
  // ⚠️ type:'magiclink' + hashed_token 조합은 verifyOtp에서 항상 otp_expired로 실패함(실측 확인,
  // 2026-08-24) — type:'email' + email_otp(6자리) 조합만 정상 동작.
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.email_otp) {
    console.error('[auth-naver] generateLink failed', linkErr)
    res.status(500).json({ ok: false, reason: '로그인 토큰 발급에 실패했습니다.' })
    return
  }

  res.status(200).json({ ok: true, email, emailOtp: linkData.properties.email_otp })
}
