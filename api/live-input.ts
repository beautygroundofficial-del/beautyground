import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 라이브 송출 채널(Cloudflare Stream Live Input) 발급·조회.
//   GET  ?liveId=<id> : 내 라이브의 송출 주소(RTMPS)·스트림키·연결상태 조회
//   POST {liveId}     : 채널 생성 + lives.stream_uid 저장 (이미 있으면 기존 채널 반환)
// 스트림 키는 DB에 저장하지 않고 매번 Cloudflare에서 조회한다
// (lives 테이블은 소비자도 읽는 공개 테이블이라 키를 넣으면 방송 탈취 위험).
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_API = 'https://api.cloudflare.com/client/v4'

interface CfLiveInput {
  uid: string
  rtmps?: { url?: string; streamKey?: string }
  webRTC?: { url?: string }
  status?: { current?: { state?: string } } | null
}

function toInfo(result: CfLiveInput) {
  return {
    ok: true,
    uid: result.uid,
    rtmpsUrl: result.rtmps?.url ?? null,
    streamKey: result.rtmps?.streamKey ?? null,
    webRtcUrl: result.webRTC?.url ?? null,
    connected: result.status?.current?.state === 'connected',
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'GET/POST 요청만 허용됩니다.' })
    return
  }
  if (!SERVICE_ROLE) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락: SUPABASE_SERVICE_ROLE_KEY' })
    return
  }
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    res.status(501).json({
      ok: false,
      reason:
        '클라우드플레어 연동이 아직 설정되지 않았습니다. Vercel 환경변수에 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN(Stream 편집 권한)을 추가하세요.',
    })
    return
  }

  // 로그인한 파트너 본인 확인 (Supabase 액세스 토큰)
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
    return
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (!user) {
    res.status(401).json({ ok: false, reason: '세션이 만료되었습니다. 다시 로그인해 주세요.' })
    return
  }

  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const liveId =
    req.method === 'GET'
      ? String(req.query.liveId ?? '')
      : String((body as { liveId?: string } | null)?.liveId ?? '')
  if (!liveId) {
    res.status(400).json({ ok: false, reason: 'liveId 가 필요합니다.' })
    return
  }

  const { data: live } = await supabase
    .from('lives')
    .select('id, title, partner_id, stream_uid')
    .eq('id', liveId)
    .single()
  if (!live) {
    res.status(404).json({ ok: false, reason: '라이브를 찾을 수 없습니다.' })
    return
  }
  const { data: partner } = await supabase
    .from('partners')
    .select('id, user_id')
    .eq('id', live.partner_id)
    .single()
  if (!partner || partner.user_id !== user.id) {
    res.status(403).json({ ok: false, reason: '본인 라이브만 관리할 수 있습니다.' })
    return
  }

  const cfHeaders = {
    Authorization: `Bearer ${CF_API_TOKEN}`,
    'Content-Type': 'application/json',
  }

  // 생성 (이미 채널이 있으면 아래 조회로 폴스루)
  if (req.method === 'POST' && !live.stream_uid) {
    const r = await fetch(`${CF_API}/accounts/${CF_ACCOUNT_ID}/stream/live_inputs`, {
      method: 'POST',
      headers: cfHeaders,
      body: JSON.stringify({
        meta: { name: live.title },
        recording: { mode: 'automatic' }, // 자동 녹화 → 추후 다시보기용
      }),
    })
    const j = (await r.json()) as { success?: boolean; result?: CfLiveInput; errors?: unknown }
    if (!r.ok || !j.success || !j.result) {
      console.error('[live-input] create failed', r.status, JSON.stringify(j.errors ?? j))
      res.status(502).json({ ok: false, reason: `클라우드플레어 채널 생성 실패 (${r.status})` })
      return
    }
    const { error: upErr } = await supabase
      .from('lives')
      .update({ stream_uid: j.result.uid })
      .eq('id', liveId)
    if (upErr) {
      console.error('[live-input] stream_uid save failed', upErr)
      res.status(500).json({ ok: false, reason: '채널은 생성됐으나 저장에 실패했습니다. 다시 시도해 주세요.' })
      return
    }
    res.status(200).json(toInfo(j.result))
    return
  }

  // 조회
  if (!live.stream_uid) {
    res.status(404).json({ ok: false, reason: '송출 채널이 아직 없습니다. 먼저 채널을 만들어 주세요.' })
    return
  }
  const r = await fetch(
    `${CF_API}/accounts/${CF_ACCOUNT_ID}/stream/live_inputs/${live.stream_uid}`,
    { headers: cfHeaders }
  )
  const j = (await r.json()) as { success?: boolean; result?: CfLiveInput; errors?: unknown }
  if (!r.ok || !j.success || !j.result) {
    console.error('[live-input] fetch failed', r.status, JSON.stringify(j.errors ?? j))
    res.status(502).json({ ok: false, reason: `송출 채널 조회 실패 (${r.status})` })
    return
  }
  res.status(200).json(toInfo(j.result))
}
