import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// 회원탈퇴 — 로그인 계정(auth.users)만 삭제한다. 주문·결제 기록은 이용약관/개인정보처리방침의
// 법정 보관기간 요구사항 때문에 남겨둔다(판매·거래 데이터는 삭제 대상 아님).
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjqtuklkskrqzbuxdwxm.supabase.co'
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, reason: 'POST 요청만 허용됩니다.' })
    return
  }
  if (!SERVICE_ROLE) {
    res.status(500).json({ ok: false, reason: '서버 환경변수 누락 (SUPABASE_SERVICE_ROLE_KEY)' })
    return
  }

  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    res.status(401).json({ ok: false, reason: '로그인이 필요합니다.' })
    return
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userErr || !user) {
    res.status(401).json({ ok: false, reason: '인증에 실패했습니다.' })
    return
  }

  // auth.users FK 중 ON DELETE가 CASCADE/SET NULL이 아닌("NO ACTION") 테이블은 참조 행이 남아있으면
  // deleteUser() 자체가 FK 위반으로 실패한다(실제 발견: orders·partners 등 주문 이력이 있는 모든 유저가
  // 탈퇴 불가였음, 2026-10-08). 기록은 보존하되 유저 연결만 끊어서(user_id→null) 탈퇴를 통과시킨다 —
  // 전부 nullable 컬럼으로 확인됨, 삭제가 아니라 unlink이므로 주문·리뷰 등 법정 보관 요구와도 충돌 없음.
  const unlinkTargets: Array<{ table: string; column: string }> = [
    { table: 'orders', column: 'user_id' },
    { table: 'partners', column: 'user_id' },
    { table: 'partner_applications', column: 'user_id' },
    { table: 'hosts', column: 'user_id' },
    { table: 'chat_messages', column: 'user_id' },
    { table: 'coupon_templates', column: 'created_by' },
    { table: 'product_reviews', column: 'replied_by' },
  ]
  for (const { table, column } of unlinkTargets) {
    const { error: unlinkErr } = await supabase.from(table).update({ [column]: null }).eq(column, user.id)
    if (unlinkErr) {
      console.error(`[delete-account] unlink ${table}.${column} failed`, unlinkErr)
      res.status(500).json({ ok: false, reason: '회원탈퇴 처리 중 오류가 발생했습니다.' })
      return
    }
  }

  const { error: delErr } = await supabase.auth.admin.deleteUser(user.id)
  if (delErr) {
    console.error('[delete-account] deleteUser failed', delErr)
    res.status(500).json({ ok: false, reason: '회원탈퇴 처리 중 오류가 발생했습니다.' })
    return
  }

  res.status(200).json({ ok: true })
}
