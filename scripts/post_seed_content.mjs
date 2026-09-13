#!/usr/bin/env node
// 씨앗글 게시 — 대표님이 이미지+주제를 주시면 김이사가 이 스크립트로 직접 올린다. (2026-09-13)
// 브라우저 없이, 지정한 계정으로 로그인해서 create_diary/create_board_post RPC를 직접 부른다.
// 한글 본문은 CLI 인자 대신 JSON 설정 파일로 넘긴다(curl 한글 인코딩 깨짐 재발 방지, feedback_curl_korean_encoding).
//
// 사용: node --env-file=.env scripts/post_seed_content.mjs <email> <password> <configFile.json>
//
// configFile.json (하루 이야기):
//   { "type": "diary", "content": "본문...", "images": ["C:/path/1.jpg"], "steps": 2951 }
// configFile.json (속 이야기, category는 lib/board.ts BOARD_CATEGORIES 키):
//   { "type": "board", "category": "kids", "content": "본문...", "images": [] }
//
// 환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (.env 와 동일 — 공개용 anon key)

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) { console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 없습니다 (--env-file=.env 로 실행할 것)'); process.exit(2) }

const [email, password, configPath] = process.argv.slice(2)
if (!email || !password || !configPath) {
  console.error('사용: node --env-file=.env scripts/post_seed_content.mjs <email> <password> <configFile.json>')
  process.exit(2)
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'))
if (!config.type || !config.content) { console.error('config.type, config.content 는 필수입니다'); process.exit(2) }
if (config.type !== 'diary' && config.type !== 'board') { console.error('config.type 은 diary 또는 board 여야 합니다'); process.exit(2) }
if (config.type === 'board' && !config.category) { console.error('board 글은 config.category 가 필수입니다'); process.exit(2) }

const sb = createClient(url, anon, { auth: { persistSession: false } })
const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({ email, password })
if (signInError) { console.error('로그인 실패:', signInError.message); process.exit(1) }
const userId = signInData.user.id

const folder = config.type === 'diary' ? 'diaries' : 'board'
const imageUrls = []
for (const [i, imgPath] of (config.images ?? []).entries()) {
  const buf = readFileSync(imgPath)
  const ext = (path.extname(imgPath).slice(1) || 'jpg').toLowerCase()
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
  const storagePath = `${folder}/${userId}/${Date.now()}_${i}.${ext}`
  const { error } = await sb.storage.from('product-images').upload(storagePath, buf, { upsert: true, contentType })
  if (error) { console.error('이미지 업로드 실패:', imgPath, error.message); process.exit(1) }
  imageUrls.push(sb.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl)
}

let result
if (config.type === 'diary') {
  const { data, error } = await sb.rpc('create_diary', {
    p_content: config.content, p_images: imageUrls, p_nickname: config.nickname ?? null,
    p_steps: config.steps ?? null, p_video: null, p_pet_ids: [],
  })
  if (error) { console.error('작성 실패:', error.message); process.exit(1) }
  result = data
} else {
  const { data, error } = await sb.rpc('create_board_post', {
    p_category: config.category, p_content: config.content, p_images: imageUrls,
    p_nickname: config.nickname ?? null, p_video: null,
  })
  if (error) { console.error('작성 실패:', error.message); process.exit(1) }
  result = data
}

console.log(JSON.stringify({ ok: true, imageUrls, result: Array.isArray(result) ? result[0] : result }, null, 2))
