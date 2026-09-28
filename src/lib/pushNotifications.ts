import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export function isPushSupported(): boolean {
  if (Capacitor.isNativePlatform()) return true
  return 'serviceWorker' in navigator && 'PushManager' in window
}

// base64url(VAPID public key) → Uint8Array. pushManager.subscribe가 요구하는 형식.
function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

async function registerDeviceToken(platform: 'ios' | 'android', token: string): Promise<void> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) return
  // 같은 12개 함수 한도 이유로 웹 푸시 구독과 같은 라우트에 얹음.
  await fetch('/api/live-input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ pushAction: 'registerDevice', platform, token }),
  })
}

// 네이티브 앱(APNs/FCM) — Apple 심사 4.2(웹사이트만 감싼 앱) 대비, capacitor.config.ts 참고.
async function subscribeNative(): Promise<void> {
  const platform = Capacitor.getPlatform()
  if (platform !== 'ios' && platform !== 'android') return

  const current = await PushNotifications.checkPermissions()
  let granted = current.receive === 'granted'
  if (!granted && (current.receive === 'prompt' || current.receive === 'prompt-with-rationale')) {
    const requested = await PushNotifications.requestPermissions()
    granted = requested.receive === 'granted'
  }
  if (!granted) return

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    void PushNotifications.addListener('registration', (token) => {
      void registerDeviceToken(platform, token.value).finally(finish)
    })
    void PushNotifications.addListener('registrationError', finish)
    void PushNotifications.register()
    // 토큰 콜백이 안 오는 극단적인 경우를 대비한 안전장치 — 호출부(팔로우 등)를 막지 않는다.
    setTimeout(finish, 8000)
  })
}

// 팔로우 시 호출 — 권한 요청부터 서버 등록까지. 거부/미지원/실패는 조용히 무시(팔로우 자체는 막지 않음).
export async function subscribeToPush(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await subscribeNative()
    return
  }
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return

  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') return

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) return

  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return

  // Vercel Hobby 플랜 서버리스 함수 12개 한도(이미 꽉 참)라 별도 라우트 대신 live-input.ts에 얹음.
  await fetch('/api/live-input', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      pushAction: 'subscribe',
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  })
}
