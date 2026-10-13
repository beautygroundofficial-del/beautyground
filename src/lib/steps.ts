import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

// 걷기 포인트 — 폰의 건강 앱(iOS 건강/HealthKit, 안드로이드 Health Connect)에서 오늘 걸음수를 읽어 서버에 보고한다.
//
// 원칙(2026-10-13)
//  - 직접 입력한 숫자는 절대 포인트 근거로 쓰지 않는다. 이 파일은 오직 네이티브 건강 데이터만 읽는다.
//  - 서버(report_steps RPC)가 출처·하루 상한·증가 속도를 다시 검증한다. 클라이언트 값은 신뢰하지 않는다.
//  - 앱이 아니거나(웹), 플러그인이 아직 들어있지 않은 옛 앱 버전이면 조용히 아무것도 하지 않는다.
//  - 걸음수 외의 건강 정보는 읽지 않는다(권한도 steps 하나만 요청).

type HealthPlugin = typeof import('@capgo/capacitor-health').Health

export type StepStatus =
  | 'unsupported'   // 웹이거나 이 앱 버전에 건강 플러그인이 없음
  | 'unavailable'   // 기기에 건강 앱(Health Connect)이 없음
  | 'need_permission'
  | 'ready'

export interface StepSyncResult {
  steps: number
  awarded: number
  balance: number
  message: string
}

let healthCache: HealthPlugin | null | undefined

async function getHealth(): Promise<HealthPlugin | null> {
  if (healthCache !== undefined) return healthCache
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Health')) {
      healthCache = null
      return null
    }
    const mod = await import('@capgo/capacitor-health')
    healthCache = mod.Health
  } catch {
    healthCache = null
  }
  return healthCache ?? null
}

export async function getStepStatus(): Promise<StepStatus> {
  const health = await getHealth()
  if (!health) return 'unsupported'
  try {
    const av = await health.isAvailable()
    if (!av.available) return 'unavailable'
    const auth = await health.checkAuthorization({ read: ['steps'] })
    return auth.readAuthorized.includes('steps') ? 'ready' : 'need_permission'
  } catch {
    return 'unsupported'
  }
}

// 걸음수 연동이 안 될 때 원인을 화면에서 바로 보기 위한 점검 정보(2026-10-13, 출시 전 임시).
export interface StepDiagnostics {
  native: boolean
  platform: string
  plugin: boolean
  imported: boolean
  available?: boolean
  reason?: string
  readAuthorized?: boolean
  error?: string
}

export async function getStepDiagnostics(): Promise<StepDiagnostics> {
  const native = Capacitor.isNativePlatform()
  const platform = Capacitor.getPlatform()
  const plugin = native ? Capacitor.isPluginAvailable('Health') : false
  const out: StepDiagnostics = { native, platform, plugin, imported: false }
  if (!native) return out
  try {
    const mod = await import('@capgo/capacitor-health')
    out.imported = true
    const av = await mod.Health.isAvailable()
    out.available = av.available
    out.reason = av.reason
    try {
      const auth = await mod.Health.checkAuthorization({ read: ['steps'] })
      out.readAuthorized = auth.readAuthorized.includes('steps')
    } catch (e) {
      out.error = 'checkAuthorization: ' + (e instanceof Error ? e.message : String(e))
    }
  } catch (e) {
    out.error = (e instanceof Error ? e.message : String(e))
  }
  return out
}

// 사용자가 버튼을 눌렀을 때만 호출한다(권한 창이 뜬다). 허용되면 true.
export async function requestStepPermission(): Promise<boolean> {
  const health = await getHealth()
  if (!health) return false
  try {
    const res = await health.requestAuthorization({ read: ['steps'] })
    // iOS는 거부해도 "요청 완료"로만 답하는 경우가 있어, 실제 읽기 가능 여부를 한 번 더 확인한다.
    return res.readAuthorized.includes('steps')
  } catch {
    return false
  }
}

// 오늘(기기 시간대 기준 0시부터 지금까지) 걸음수. 읽을 수 없으면 null.
export async function readTodaySteps(): Promise<number | null> {
  const health = await getHealth()
  if (!health) return null
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const res = await health.queryAggregated({
      dataType: 'steps',
      startDate: start.toISOString(),
      endDate: new Date().toISOString(),
      bucket: 'day',
      aggregation: 'sum',
    })
    const total = (res.samples ?? []).reduce((sum, s) => sum + (Number(s.value) || 0), 0)
    return Math.max(0, Math.round(total))
  } catch {
    return null
  }
}

let lastSyncAt = 0
const MIN_INTERVAL_MS = 5 * 60 * 1000   // 너무 자주 보고하지 않는다(서버도 속도 검증을 한다)

// 오늘 걸음수를 읽어 서버에 보고. 권한이 없거나 읽을 수 없으면 null.
export async function syncSteps(force = false): Promise<StepSyncResult | null> {
  if (!force && Date.now() - lastSyncAt < MIN_INTERVAL_MS) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  if ((await getStepStatus()) !== 'ready') return null

  const steps = await readTodaySteps()
  if (steps == null) return null
  lastSyncAt = Date.now()

  const platform = Capacitor.getPlatform()          // 'ios' | 'android'
  const source = platform === 'ios' ? 'healthkit' : 'health_connect'
  const { data, error } = await supabase.rpc('report_steps', { p_steps: steps, p_source: source, p_platform: platform })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    steps: Number(row.steps ?? steps),
    awarded: Number(row.awarded ?? 0),
    balance: Number(row.balance ?? 0),
    message: String(row.message ?? ''),
  }
}
