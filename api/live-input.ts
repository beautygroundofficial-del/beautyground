import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// 라이브 송출 채널(Cloudflare Stream Live Input) 발급·조회.
//   GET  ?liveId=<id> : 내 라이브의 송출 주소(RTMPS)·스트림키·연결상태 조회
//   POST {liveId}     : 채널 생성 + lives.stream_uid 저장 (이미 있으면 기존 채널 반환)
//   POST {hostToken, markLive:true} : 상태를 live로 전환만 함(채널 생성 없이) — 진행자가
//     브라우저에서 실제 WebRTC 송출을 시작한 직후 호출. Vercel Hobby 플랜 서버리스 함수
//     12개 제한 때문에 별도 api/live-go-live.ts로 안 두고 여기 합침(2026-08-20).
//   POST {pushAction:'sendCoupon', userIds, title, body, image, url} : 관리자 쿠폰 생성기 발송
//     (admin/CouponGenerator.tsx) — admin_issue_coupon RPC로 이미 뽑은 대상에게 웹 푸시 발송.
//     같은 12개 함수 한도 이유로 여기 합침(2026-08-27).
// 스트림 키는 DB에 저장하지 않고 매번 Cloudflare에서 조회한다
// (lives 테이블은 소비자도 읽는 공개 테이블이라 키를 넣으면 방송 탈취 위험).
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_API = 'https://api.cloudflare.com/client/v4'
// 공개 재생 도메인(비밀 아님) — src/lib/cloudflare.ts 의 CF_STREAM_SUBDOMAIN 과 같은 값.
// 방송 종료 시 녹화본(VOD) 재생 주소를 만들어 lives.playback_url 에 저장하는 데 쓴다.
const CF_STREAM_SUBDOMAIN = process.env.CF_STREAM_SUBDOMAIN || 'customer-musyiv3qecrzgpdk'

// 팔로우한 브랜드 라이브 시작 알림(웹 푸시). 같은 12개 함수 한도 이유로 이 파일에 합침.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:beautyground.official@gmail.com'
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// 방송이 live로 전환된 직후 호출 — 팔로워의 저장된 구독으로 실제 알림 발송.
// 발송 실패는 절대 방송 시작 응답을 막지 않는다(전체 try/catch).
async function sendLiveStartNotifications(
  supabase: SupabaseClient,
  live: { id: string; title: string; partner_id: string | null; host_id?: string | null }
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return
  if (!live.partner_id && !live.host_id) return
  try {
    // 브랜드가 진행하는 라이브는 partner_follows, 매장(호스트)이 직접 여는 라이브는 host_follows —
    // 서로 다른 팔로우 대상이라 알림 문구도 브랜드명/매장명으로 갈린다.
    let notifyName = '뷰티그라운드'
    let userIds: string[] = []
    if (live.partner_id) {
      const { data: partner } = await supabase.from('partners').select('brand_name').eq('id', live.partner_id).single()
      notifyName = partner?.brand_name ?? notifyName
      const { data: follows } = await supabase.from('partner_follows').select('user_id').eq('partner_id', live.partner_id)
      userIds = (follows ?? []).map((f: { user_id: string }) => f.user_id)
    } else if (live.host_id) {
      const { data: host } = await supabase.from('hosts').select('name').eq('id', live.host_id).single()
      notifyName = host?.name ?? notifyName
      const { data: follows } = await supabase.from('host_follows').select('user_id').eq('host_id', live.host_id)
      userIds = (follows ?? []).map((f: { user_id: string }) => f.user_id)
    }
    if (userIds.length === 0) return

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)
    if (!subs || subs.length === 0) return

    const payload = JSON.stringify({
      title: `${notifyName} 라이브 시작`,
      body: live.title,
      data: { url: `/app/live/${live.id}` },
    })

    await Promise.all(
      subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number } | null)?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            console.error('[live-input] push send failed', sub.id, statusCode)
          }
        }
      })
    )
  } catch (err) {
    console.error('[live-input] sendLiveStartNotifications failed', err)
  }
}

// hostToken 경로(GoLive.tsx)와 로그인 경로(LiveSales.tsx) 양쪽에서 같은 처리가 필요해 공용화.
async function markLiveStarted(
  supabase: SupabaseClient,
  live: { id: string; title: string; partner_id: string | null; host_id: string | null }
) {
  const { error } = await supabase
    .from('lives')
    .update({ status: 'live' })
    .eq('id', live.id)
    .neq('status', 'ended')
  if (error) return { ok: false as const, reason: '상태 변경에 실패했습니다.' }
  await sendLiveStartNotifications(supabase, live)
  return { ok: true as const }
}

// 방송 종료 — 상태를 ended 로 내리고, 이 방송의 녹화본(VOD)을 찾아 다시보기 주소로 연결한다.
// "자동 녹화"는 송출이 한 번이라도 끊겼다 재연결되면 별도 파일로 쪼개진다(2026-09-02 실제 발생 —
// 진행자가 앱 설정을 만지다 7분 구간 연결이 한 번 끊김). 예전엔 가장 최근 파일 하나만 골라서
// 앞부분이 통째로 다시보기에서 빠지는 버그가 있었다. 지금은 이 라이브에 딸린 녹화본을 전부 모아
// (오래된 순) 저장한다 — 1개면 기존처럼 URL 문자열 그대로, 2개 이상이면 JSON 배열 문자열로
// (playback_url 컬럼 스키마를 새로 안 만들고 그대로 재사용 — ShopLiveWatch.tsx가 두 형태를 다 처리).
// 녹화본 조회가 실패해도 종료 처리 자체는 반드시 되게 한다(방송이 계속 켜져 보이는 게 더 나쁨).
async function markLiveEnded(supabase: SupabaseClient, liveId: string, streamUid: string | null) {
  const patch: { status: string; playback_url?: string } = { status: 'ended' }
  if (streamUid && CF_ACCOUNT_ID && CF_API_TOKEN) {
    try {
      const vr = await fetch(`${CF_API}/accounts/${CF_ACCOUNT_ID}/stream?limit=50`, {
        headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      })
      const vj = (await vr.json()) as {
        result?: Array<{ uid: string; liveInput?: string; created?: string; duration?: number; status?: { state?: string } }>
      }
      const mine = (vj.result ?? [])
        // duration<15초는 연결 순간의 잡음(재연결 시도 등)이라 다시보기에 노출할 내용이 아니다.
        .filter((v) => v.liveInput === streamUid && v.status?.state !== 'error' && (v.duration ?? 0) >= 15)
        .sort((a, b) => String(a.created ?? '').localeCompare(String(b.created ?? '')))
        .map((v) => `https://${CF_STREAM_SUBDOMAIN}.cloudflarestream.com/${v.uid}/iframe`)
      if (mine.length === 1) {
        patch.playback_url = mine[0]
      } else if (mine.length > 1) {
        patch.playback_url = JSON.stringify(mine)
      }
    } catch (e) {
      console.error('[live-input] recording lookup failed', e)
    }
  }
  const { error } = await supabase.from('lives').update(patch).eq('id', liveId)
  if (error) return { ok: false as const, reason: '종료 처리에 실패했습니다.' }
  return { ok: true as const, playbackUrl: patch.playback_url ?? null }
}

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
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }

  // 웹 푸시 구독 등록/해제 — 브랜드 팔로우 시 호출. 클라우드플레어 설정과 무관하므로 아래 CF 체크보다 먼저 처리.
  const pushAction = req.method === 'POST' ? (body as { pushAction?: string } | null)?.pushAction : undefined
  if (pushAction === 'subscribe' || pushAction === 'unsubscribe') {
    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!token) {
      res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
      return
    }
    const { data: userData } = await supabase.auth.getUser(token)
    const user = userData?.user
    if (!user) {
      res.status(401).json({ ok: false, reason: '세션이 만료되었습니다. 다시 로그인해 주세요.' })
      return
    }
    const { endpoint, keys } =
      (body as { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null) ?? {}
    if (!endpoint) {
      res.status(400).json({ ok: false, reason: 'endpoint 가 필요합니다.' })
      return
    }
    if (pushAction === 'subscribe') {
      if (!keys?.p256dh || !keys?.auth) {
        res.status(400).json({ ok: false, reason: 'keys 가 필요합니다.' })
        return
      }
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({ user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: 'endpoint' })
      if (error) {
        res.status(500).json({ ok: false, reason: '구독 저장에 실패했습니다.' })
        return
      }
    } else {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
    }
    res.status(200).json({ ok: true })
    return
  }

  // 관리자 쿠폰 생성기 — 대상 회원에게 웹 푸시 일괄 발송. 같은 12개 함수 한도 이유로 이 파일에 합침(2026-08-27).
  // 발급 대상 user_id 목록은 admin_issue_coupon RPC(브라우저에서 먼저 호출)로 이미 계산돼 넘어온다.
  if (pushAction === 'sendCoupon') {
    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!token) {
      res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
      return
    }
    const { data: userData } = await supabase.auth.getUser(token)
    const user = userData?.user
    if (!user?.email) {
      res.status(401).json({ ok: false, reason: '세션이 만료되었습니다. 다시 로그인해 주세요.' })
      return
    }
    const { data: adminRow } = await supabase
      .from('app_admins')
      .select('email')
      .eq('email', user.email.toLowerCase())
      .maybeSingle()
    if (!adminRow) {
      res.status(403).json({ ok: false, reason: '관리자만 쿠폰을 발송할 수 있습니다.' })
      return
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      res.status(501).json({ ok: false, reason: '웹 푸시(VAPID) 환경변수가 설정되지 않았습니다.' })
      return
    }
    const {
      userIds, title: pushTitle, body: pushBody, image: pushImage, url: pushUrl,
    } = (body as { userIds?: string[]; title?: string; body?: string; image?: string; url?: string } | null) ?? {}
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ ok: false, reason: '발송 대상이 없습니다.' })
      return
    }
    if (!pushTitle || !pushBody) {
      res.status(400).json({ ok: false, reason: 'title/body 가 필요합니다.' })
      return
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds)
    const payload = JSON.stringify({
      title: pushTitle,
      body: pushBody,
      image: pushImage || undefined,
      data: { url: pushUrl || '/app/benefits' },
    })

    let sent = 0
    await Promise.all(
      (subs ?? []).map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          )
          sent += 1
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number } | null)?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          } else {
            console.error('[live-input] coupon push send failed', sub.id, statusCode)
          }
        }
      })
    )
    res.status(200).json({ ok: true, targeted: userIds.length, subscribed: (subs ?? []).length, sent })
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

  const hostToken =
    req.method === 'GET'
      ? String(req.query.hostToken ?? '')
      : String((body as { hostToken?: string } | null)?.hostToken ?? '')
  const markLive = req.method === 'POST' && (body as { markLive?: boolean } | null)?.markLive === true
  // 방송 종료 — 상태를 ended 로 내리고, 그 방송의 Cloudflare 녹화본을 찾아 다시보기로 연결한다.
  const markEnded = req.method === 'POST' && (body as { markEnded?: boolean } | null)?.markEnded === true
  let liveId =
    req.method === 'GET'
      ? String(req.query.liveId ?? '')
      : String((body as { liveId?: string } | null)?.liveId ?? '')

  let authorized = false

  if (hostToken) {
    // 링크(토큰) 방식 — 로그인 없이 진행자 본인 확인. 유효성(기간·종료여부)은 RPC 안에서 검사.
    const { data: liveRow, error: rpcErr } = await supabase.rpc('get_live_by_host_token', {
      p_token: hostToken,
    })
    if (rpcErr || !liveRow) {
      res.status(403).json({ ok: false, reason: rpcErr?.message ?? '유효하지 않은 링크입니다.' })
      return
    }
    liveId = liveRow.id
    authorized = true

    if (markLive) {
      const r = await markLiveStarted(supabase, {
        id: liveId,
        title: String(liveRow.title ?? ''),
        partner_id: (liveRow.partner_id as string | null) ?? null,
        host_id: (liveRow.host_id as string | null) ?? null,
      })
      res.status(r.ok ? 200 : 500).json(r)
      return
    }

    if (markEnded) {
      const r = await markLiveEnded(supabase, liveId, (liveRow.stream_uid as string | null) ?? null)
      res.status(r.ok ? 200 : 500).json(r)
      return
    }

    // 방송 종료 — 상태를 ended 로 내리고, 이 방송의 녹화본(VOD)을 찾아 다시보기 주소로 연결한다.
    // Cloudflare는 라이브 입력에서 녹화된 영상에 liveInput 필드를 달아주므로 그걸로 골라낸다.
    // 녹화본 조회가 실패해도 종료 처리 자체는 반드시 되게 한다(방송이 계속 켜져 보이는 게 더 나쁨).
    if (markEnded) {
      const patch: { status: string; playback_url?: string } = { status: 'ended' }
      const streamUid = (liveRow.stream_uid as string | null) ?? null
      if (streamUid && CF_ACCOUNT_ID && CF_API_TOKEN) {
        try {
          const vr = await fetch(`${CF_API}/accounts/${CF_ACCOUNT_ID}/stream?limit=50`, {
            headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
          })
          const vj = (await vr.json()) as {
            result?: Array<{ uid: string; liveInput?: string; created?: string; status?: { state?: string } }>
          }
          const mine = (vj.result ?? [])
            .filter((v) => v.liveInput === streamUid && v.status?.state !== 'error')
            .sort((a, b) => String(b.created ?? '').localeCompare(String(a.created ?? '')))
          if (mine[0]) {
            patch.playback_url = `https://${CF_STREAM_SUBDOMAIN}.cloudflarestream.com/${mine[0].uid}/iframe`
          }
        } catch (e) {
          console.error('[live-input] recording lookup failed', e)
        }
      }
      const { error: endErr } = await supabase.from('lives').update(patch).eq('id', liveId)
      if (endErr) {
        res.status(500).json({ ok: false, reason: '종료 처리에 실패했습니다.' })
        return
      }
      res.status(200).json({ ok: true, playbackUrl: patch.playback_url ?? null })
      return
    }
  } else {
    // 로그인한 파트너/진행자 본인 확인 (Supabase 액세스 토큰) — 기존 방식(관리자·브랜드센터용)
    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    if (!token) {
      res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
      return
    }
    const { data: userData } = await supabase.auth.getUser(token)
    const user = userData?.user
    if (!user) {
      res.status(401).json({ ok: false, reason: '세션이 만료되었습니다. 다시 로그인해 주세요.' })
      return
    }
    if (!liveId) {
      res.status(400).json({ ok: false, reason: 'liveId 가 필요합니다.' })
      return
    }
    const { data: live } = await supabase
      .from('lives')
      .select('id, title, partner_id, host_id, stream_uid')
      .eq('id', liveId)
      .single()
    if (!live) {
      res.status(404).json({ ok: false, reason: '라이브를 찾을 수 없습니다.' })
      return
    }
    if (live.partner_id) {
      const { data: partner } = await supabase
        .from('partners')
        .select('id, user_id')
        .eq('id', live.partner_id)
        .single()
      if (partner && partner.user_id === user.id) authorized = true
    }
    if (!authorized && live.host_id) {
      const { data: host } = await supabase
        .from('hosts')
        .select('id, user_id')
        .eq('id', live.host_id)
        .single()
      if (host && host.user_id === user.id) authorized = true
    }
    if (!authorized) {
      res.status(403).json({ ok: false, reason: '본인 라이브만 관리할 수 있습니다.' })
      return
    }

    // 로그인 경로(호스트 자신의 /host/live/:id, 관리자 방송지원 화면)에도 hostToken 경로와
    // 동일하게 markLive/markEnded를 지원한다 — 이게 없어서 송출은 연결됐는데 사이트엔
    // 계속 "예정"으로 남아있던 버그가 실제로 발생했다(2026-09-02).
    if (markLive) {
      const r = await markLiveStarted(supabase, {
        id: live.id,
        title: live.title,
        partner_id: live.partner_id,
        host_id: live.host_id,
      })
      res.status(r.ok ? 200 : 500).json(r)
      return
    }
    if (markEnded) {
      const r = await markLiveEnded(supabase, live.id, live.stream_uid)
      res.status(r.ok ? 200 : 500).json(r)
      return
    }
  }

  const { data: live } = await supabase
    .from('lives')
    .select('id, title, stream_uid')
    .eq('id', liveId)
    .single()
  if (!live) {
    res.status(404).json({ ok: false, reason: '라이브를 찾을 수 없습니다.' })
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
