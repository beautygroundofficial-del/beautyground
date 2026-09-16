#!/usr/bin/env node
// 시딩 좋아요·댓글 실행 — 2026-09-17
// seed_reactions_plan.json(계정/게시물/댓글문구)을 읽어 각 계정으로 로그인 →
// toggle_board_like → (댓글 있으면) create_board_comment 순서로 실행한다.
//
// 사용: node --env-file=.env scripts/run_seed_reactions.mjs <plan.json>

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) { console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 없습니다'); process.exit(2) }

const planPath = process.argv[2]
if (!planPath) { console.error('사용: node --env-file=.env scripts/run_seed_reactions.mjs <plan.json>'); process.exit(2) }
const plan = JSON.parse(readFileSync(planPath, 'utf-8'))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let okLike = 0, okComment = 0, fail = 0
for (const item of plan) {
  const sb = createClient(url, anon, { auth: { persistSession: false } })
  let signInError
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await sb.auth.signInWithPassword({ email: item.email, password: item.password })
    signInError = res.error
    if (!signInError) break
    if (!signInError.message?.includes('rate limit')) break
    await sleep(3000 * (attempt + 1))
  }
  if (signInError) { console.error(`[${item.email}] 로그인 실패:`, signInError.message); fail++; continue }
  await sleep(400)

  if (item.like) {
    const { error } = await sb.rpc('toggle_board_like', { p_post_id: item.post_id })
    if (error) { console.error(`[${item.email}] 좋아요 실패:`, error.message); fail++ } else { okLike++ }
  }
  if (item.comment) {
    const { error } = await sb.rpc('create_board_comment', { p_post_id: item.post_id, p_content: item.comment, p_nickname: item.nickname })
    if (error) { console.error(`[${item.email}] 댓글 실패:`, error.message); fail++ } else { okComment++ }
  }
  await sb.auth.signOut()
}

console.log(`\n=== 요약 === 좋아요 성공 ${okLike} / 댓글 성공 ${okComment} / 실패 ${fail}`)
