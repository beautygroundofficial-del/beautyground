// 네이티브 앱(iOS APNs / Android FCM) 푸시 발송 헬퍼.
// 파일명이 _lib 폴더 아래라 Vercel이 별도 서버리스 함수로 세지 않는다(api/*.ts 12개 한도와 무관) —
// api/live-input.ts 등에서 모듈로 import 해서 쓴다.
//
// 신규 npm 의존성(firebase-admin 등) 없이 Node 내장 crypto/http2/fetch로 직접 구현했다:
//   - APNs: JWT(ES256, Apple Auth Key) 발급 → HTTP/2 provider API
//   - FCM:  JWT(RS256, 서비스 계정) → OAuth2 액세스 토큰 교환 → FCM v1 REST API
import crypto from 'crypto'
import http2 from 'http2'

const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID
const APPLE_AUTHKEY_ID = process.env.APPLE_AUTHKEY_ID
const APPLE_AUTHKEY_P8 = process.env.APPLE_AUTHKEY_P8
const APNS_TOPIC = process.env.APNS_TOPIC || 'kr.co.beautyground.app'
// 개발판(Xcode 로컬 실행)은 sandbox 서버를 쓰지만, TestFlight/App Store 빌드(우리가 CI로 만드는 것)는
// 항상 production APNs 서버를 쓴다.
const APNS_HOST = 'api.push.apple.com'

const FCM_SERVICE_ACCOUNT_JSON = process.env.FCM_SERVICE_ACCOUNT_JSON

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ---------- APNs ----------

let cachedApnsJwt: { token: string; issuedAt: number } | null = null

function getApnsJwt(): string | null {
  if (!APPLE_TEAM_ID || !APPLE_AUTHKEY_ID || !APPLE_AUTHKEY_P8) return null
  const now = Math.floor(Date.now() / 1000)
  // Apple 권장: 같은 토큰을 20분 넘게 재사용하지 않는다. 실행마다 새로 만들면 낭비가 커서 15분까지 캐시.
  if (cachedApnsJwt && now - cachedApnsJwt.issuedAt < 15 * 60) return cachedApnsJwt.token

  const header = base64url(Buffer.from(JSON.stringify({ alg: 'ES256', kid: APPLE_AUTHKEY_ID })))
  const payload = base64url(Buffer.from(JSON.stringify({ iss: APPLE_TEAM_ID, iat: now })))
  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('SHA256')
  sign.update(signingInput)
  sign.end()
  const signature = sign.sign({ key: APPLE_AUTHKEY_P8, dsaEncoding: 'ieee-p1363' } as crypto.SignPrivateKeyInput)
  const token = `${signingInput}.${base64url(signature)}`
  cachedApnsJwt = { token, issuedAt: now }
  return token
}

export interface NativePushPayload {
  title: string
  body: string
  url?: string
}

// 실패해도 조용히 무시(로그만) — 라이브 알림 등 발송 실패가 본 기능(방송 시작 등)을 막으면 안 된다.
export async function sendApnsPush(deviceToken: string, payload: NativePushPayload): Promise<boolean> {
  const jwt = getApnsJwt()
  if (!jwt) return false

  return new Promise((resolve) => {
    let client: http2.ClientHttp2Session
    try {
      client = http2.connect(`https://${APNS_HOST}`)
    } catch {
      resolve(false)
      return
    }
    client.on('error', () => resolve(false))

    const body = JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
      url: payload.url,
    })

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': APNS_TOPIC,
      'apns-push-type': 'alert',
      'content-type': 'application/json',
    })
    let status = 0
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0)
    })
    req.on('data', () => {})
    req.on('end', () => {
      client.close()
      resolve(status >= 200 && status < 300)
    })
    req.on('error', () => {
      client.close()
      resolve(false)
    })
    req.end(body)
  })
}

// ---------- FCM (Android) ----------

let cachedFcmToken: { token: string; expiresAt: number } | null = null

async function getFcmAccessToken(): Promise<string | null> {
  if (!FCM_SERVICE_ACCOUNT_JSON) return null
  const now = Math.floor(Date.now() / 1000)
  if (cachedFcmToken && now < cachedFcmToken.expiresAt - 60) return cachedFcmToken.token

  let sa: { client_email: string; private_key: string; project_id: string }
  try {
    sa = JSON.parse(FCM_SERVICE_ACCOUNT_JSON)
  } catch {
    return null
  }

  const header = base64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claims = base64url(
    Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      })
    )
  )
  const signingInput = `${header}.${claims}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  sign.end()
  const signature = base64url(sign.sign(sa.private_key))
  const assertion = `${signingInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!res.ok) return null
  const json = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) return null
  cachedFcmToken = { token: json.access_token, expiresAt: now + (json.expires_in ?? 3600) }
  return json.access_token
}

export async function sendFcmPush(deviceToken: string, payload: NativePushPayload): Promise<boolean> {
  if (!FCM_SERVICE_ACCOUNT_JSON) return false
  const accessToken = await getFcmAccessToken()
  if (!accessToken) return false
  const projectId = (JSON.parse(FCM_SERVICE_ACCOUNT_JSON) as { project_id: string }).project_id

  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: payload.title, body: payload.body },
          data: payload.url ? { url: payload.url } : undefined,
        },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function sendNativePush(
  platform: 'ios' | 'android',
  deviceToken: string,
  payload: NativePushPayload
): Promise<boolean> {
  if (platform === 'ios') return sendApnsPush(deviceToken, payload)
  return sendFcmPush(deviceToken, payload)
}
