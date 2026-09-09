import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// 네이버 로그인 — Supabase가 네이버를 공식 지원하지 않아 커스텀으로 처리한다.
// 흐름: 프론트에서 받은 code를 네이버 토큰으로 교환 → 프로필 조회(이메일 필수) →
// Supabase에 유저 없으면 생성 → magiclink용 hashed_token 발급해 프론트로 반환.
// 프론트는 그 token으로 supabase.auth.verifyOtp(type:'magiclink')를 호출해 세션을 완성한다.
//
// ⚠️ 이 파일은 이제 "인증" 관련 두 가지를 함께 처리한다(Vercel Hobby 12개 함수 한도 때문에
// 새 api/*.ts 를 만들지 않고 기존 파일에 얹었다 — project_beautyground_mall_vercel_function_limit).
//   - body.action 없음(기본) : 네이버 로그인 콜백 처리(기존 그대로)
//   - body.action='phone-request' : 전화번호 인증 코드 발송(phone_verification.sql)
//   - body.action='phone-verify'  : 인증 코드 확인 + phone_verifications 기록
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const NAVER_CLIENT_ID = process.env.VITE_NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY
const SOLAPI_API_SECRET = process.env.SOLAPI_API_SECRET
const SOLAPI_SENDER = process.env.SOLAPI_SENDER

// 커뮤니티 포인트를 노리는 다중계정 어뷰징 방어선 — 전화번호 하나는 평생 한 계정에만 묶인다
// (phone_verifications.phone 유니크 인덱스가 실제 방어, 여긴 사용자 흐름일 뿐).
// 대표님 지시(2026-09-09): "회원가입은 복잡할 필요 없고, 커뮤니티 어뷰징 방지용으로
// 서비스 사용 시점에 전화번호를 추가하면 된다" — 그래서 로그인이 아니라 여기 별도 액션으로 뺐다.
async function phoneRequestHandler(req: VercelRequest, res: VercelResponse) {
  if (!SERVICE_ROLE) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY)' })
    return
  }
  const uid = await getUserIdFromAuthHeader(req)
  if (!uid) {
    res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
    return
  }
  const body = parseBody(req)
  const phone = normalizePhone((body as { phone?: string }).phone)
  if (!phone) {
    res.status(400).json({ ok: false, reason: '휴대전화번호 형식이 올바르지 않습니다.' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // 이미 인증된 전화번호인지 먼저 본다 — SMS 비용 아끼고, 다른 계정 것이면 바로 알려준다.
  const { data: existing } = await supabase
    .from('phone_verifications')
    .select('user_id')
    .eq('phone', phone)
    .maybeSingle()
  if (existing && existing.user_id !== uid) {
    res.status(200).json({ ok: false, reason: '이미 다른 계정에서 인증된 번호예요.' })
    return
  }
  if (existing && existing.user_id === uid) {
    res.status(200).json({ ok: true, alreadyVerified: true })
    return
  }

  // 60초 안에 보낸 코드가 있으면 재발송 막는다(문자 스팸·비용 방지)
  const { data: recent } = await supabase
    .from('phone_otp_codes')
    .select('created_at')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (recent && Date.now() - new Date(recent.created_at as string).getTime() < 60_000) {
    res.status(200).json({ ok: false, reason: '잠시 후 다시 시도해 주세요.' })
    return
  }

  const code = String(Math.floor(100000 + Math.random() * 900000))
  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString()

  const { error: insErr } = await supabase
    .from('phone_otp_codes')
    .insert({ user_id: uid, phone, code_hash: codeHash, expires_at: expiresAt })
  if (insErr) {
    console.error('[auth-naver:phone-request] insert failed', insErr)
    res.status(500).json({ ok: false, reason: '인증코드 발급에 실패했습니다.' })
    return
  }

  const sent = await sendSms(phone, `[뷰티그라운드] 인증번호는 ${code} 입니다. 5분 안에 입력해 주세요.`)
  if (!sent.ok) {
    // 문자 발송 실패는 손님 잘못이 아니다 — 코드는 만들어졌으니 관리자가 원인을 봐야 한다.
    console.error('[auth-naver:phone-request] sms send failed', sent.reason)
    res.status(200).json({ ok: false, reason: '인증문자 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' })
    return
  }

  res.status(200).json({ ok: true })
}

async function phoneVerifyHandler(req: VercelRequest, res: VercelResponse) {
  if (!SERVICE_ROLE) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY)' })
    return
  }
  const uid = await getUserIdFromAuthHeader(req)
  if (!uid) {
    res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
    return
  }
  const body = parseBody(req)
  const phone = normalizePhone((body as { phone?: string }).phone)
  const code = String((body as { code?: string }).code || '').trim()
  if (!phone || !/^\d{6}$/.test(code)) {
    res.status(400).json({ ok: false, reason: '인증번호를 확인해 주세요.' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  const { data: row, error: selErr } = await supabase
    .from('phone_otp_codes')
    .select('id, code_hash, attempts, expires_at, consumed_at')
    .eq('user_id', uid)
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (selErr || !row) {
    res.status(200).json({ ok: false, reason: '인증번호를 먼저 요청해 주세요.' })
    return
  }
  if (row.consumed_at) {
    res.status(200).json({ ok: false, reason: '이미 사용된 인증번호예요. 다시 요청해 주세요.' })
    return
  }
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    res.status(200).json({ ok: false, reason: '인증번호가 만료됐어요. 다시 요청해 주세요.' })
    return
  }
  if ((row.attempts as number) >= 5) {
    res.status(200).json({ ok: false, reason: '시도 횟수를 초과했어요. 다시 요청해 주세요.' })
    return
  }

  const codeHash = crypto.createHash('sha256').update(code).digest('hex')
  if (codeHash !== row.code_hash) {
    await supabase.from('phone_otp_codes').update({ attempts: (row.attempts as number) + 1 }).eq('id', row.id)
    res.status(200).json({ ok: false, reason: '인증번호가 올바르지 않아요.' })
    return
  }

  await supabase.from('phone_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id)

  const { error: verErr } = await supabase
    .from('phone_verifications')
    .insert({ user_id: uid, phone })
  if (verErr) {
    // phone 유니크 제약 위반 = 그 사이 다른 계정이 먼저 그 번호로 인증을 끝냄(드문 동시성 사례)
    if (/duplicate key|unique/i.test(verErr.message || '')) {
      res.status(200).json({ ok: false, reason: '이미 다른 계정에서 인증된 번호예요.' })
      return
    }
    console.error('[auth-naver:phone-verify] insert failed', verErr)
    res.status(500).json({ ok: false, reason: '인증 처리 중 오류가 발생했습니다.' })
    return
  }

  res.status(200).json({ ok: true })
}

async function getUserIdFromAuthHeader(req: VercelRequest): Promise<string | null> {
  if (!SERVICE_ROLE) return null
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

function parseBody(req: VercelRequest): unknown {
  let body: unknown = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }
  return body || {}
}

// 01012345678 형태로 정규화. 그 외 형식은 null.
function normalizePhone(raw: string | undefined): string | null {
  const digits = (raw || '').replace(/\D/g, '')
  if (!/^01[0-9]\d{7,8}$/.test(digits)) return null
  return digits
}

// Solapi(https://solapi.com) HMAC 서명 방식 발송 — 계정을 만들어 아래 세 값을
// Vercel 환경변수에 넣기 전까지는 발송이 안 되고, 원인이 로그로만 남는다(에러로 죽지 않는다).
async function sendSms(to: string, text: string): Promise<{ ok: boolean; reason?: string }> {
  if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER) {
    return { ok: false, reason: 'SOLAPI_API_KEY/SOLAPI_API_SECRET/SOLAPI_SENDER 환경변수 없음 — SMS 발송 계정 미설정' }
  }
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', SOLAPI_API_SECRET).update(date + salt).digest('hex')
  try {
    const r = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      },
      body: JSON.stringify({ message: { to, from: SOLAPI_SENDER, text } }),
    })
    if (!r.ok) {
      const t = await r.text()
      return { ok: false, reason: `HTTP ${r.status}: ${t.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String(e) }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'POST 요청만 허용됩니다.' })
    return
  }

  const action = (parseBody(req) as { action?: string }).action
  if (action === 'phone-request') { await phoneRequestHandler(req, res); return }
  if (action === 'phone-verify') { await phoneVerifyHandler(req, res); return }

  if (!SERVICE_ROLE || !NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락 (NAVER_CLIENT_ID / NAVER_CLIENT_SECRET / SUPABASE_SERVICE_ROLE_KEY)' })
    return
  }

  const body = parseBody(req)
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
