#!/usr/bin/env node
// 시딩 게시물 일괄 등록 — 2026-09-17
// seed_posts_plan.json(계정별 email/password/nickname/category/content/image)을 읽어
// 각 계정으로 로그인 → 이미지 업로드 → create_board_post 호출을 순서대로 실행한다.
// plan 파일엔 비밀번호가 평문으로 들어가므로 저장소에 커밋하지 말 것(스크래치패드에만 보관).
//
// 사용: node --env-file=.env scripts/run_seed_posts.mjs <plan.json>

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) { console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 없습니다'); process.exit(2) }

const planPath = process.argv[2]
if (!planPath) { console.error('사용: node --env-file=.env scripts/run_seed_posts.mjs <plan.json>'); process.exit(2) }
const plan = JSON.parse(readFileSync(planPath, 'utf-8'))

const results = []
for (const item of plan) {
  const sb = createClient(url, anon, { auth: { persistSession: false } })
  const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({ email: item.email, password: item.password })
  if (signInError) { console.error(`[${item.email}] 로그인 실패:`, signInError.message); results.push({ email: item.email, ok: false, step: 'login', error: signInError.message }); continue }
  const userId = signInData.user.id

  const buf = readFileSync(item.image)
  const ext = (path.extname(item.image).slice(1) || 'jpg').toLowerCase()
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  const storagePath = `board/${userId}/${Date.now()}_0.${ext}`
  const { error: upErr } = await sb.storage.from('product-images').upload(storagePath, buf, { upsert: true, contentType })
  if (upErr) { console.error(`[${item.email}] 이미지 업로드 실패:`, upErr.message); results.push({ email: item.email, ok: false, step: 'upload', error: upErr.message }); continue }
  const imageUrl = sb.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl

  const { data, error } = await sb.rpc('create_board_post', {
    p_category: item.category, p_content: item.content, p_images: [imageUrl],
    p_nickname: item.nickname ?? null, p_video: null,
  })
  if (error) { console.error(`[${item.email}] 작성 실패:`, error.message); results.push({ email: item.email, ok: false, step: 'post', error: error.message }); continue }
  const post = Array.isArray(data) ? data[0] : data
  console.log(`[${item.email}] OK category=${item.category} post_id=${post?.id ?? JSON.stringify(post)}`)
  results.push({ email: item.email, ok: true, category: item.category, nickname: item.nickname, post })
  await sb.auth.signOut()
}

console.log('\n=== 요약 ===')
console.log('성공:', results.filter(r => r.ok).length, '/ 실패:', results.filter(r => !r.ok).length)
if (results.some(r => !r.ok)) console.log(JSON.stringify(results.filter(r => !r.ok), null, 2))
