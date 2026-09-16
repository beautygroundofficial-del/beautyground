#!/usr/bin/env node
// 커뮤니티 시딩용 계정 실제 생성 — 2026-09-17
// scripts/seed_generate_accounts.mjs 로 만든 JSON을 읽어 Supabase Auth Admin API로
// 실제 계정을 생성한다. 이메일 인증은 관리자 권한으로 즉시 confirm 처리.
// user_metadata 에 is_seed:true 를 심어서, 관리자 회원목록에서 실회원과 구분할 수 있게 한다.
//
// 사용: node --env-file=.env scripts/seed_create_accounts.mjs <accounts.json>
// 환경변수: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다 (--env-file=.env 로 실행할 것)')
  process.exit(2)
}

const [configPath] = process.argv.slice(2)
if (!configPath) {
  console.error('사용: node --env-file=.env scripts/seed_create_accounts.mjs <accounts.json>')
  process.exit(2)
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const sb = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const results = { created: [], skipped: [], failed: [] }

for (const acc of config.accounts) {
  const { data, error } = await sb.auth.admin.createUser({
    email: acc.email,
    password: acc.password,
    email_confirm: true,
    user_metadata: {
      is_seed: true,
      seed_batch: acc.seed_batch,
      name: acc.nickname,
      nickname: acc.nickname,
      persona_age: acc.persona_age,
      categories: acc.categories,
      cohort: acc.cohort,
      provider: 'email',
    },
  })
  if (error) {
    if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
      results.skipped.push(acc.email)
      console.log(`SKIP(이미존재) ${acc.email}`)
    } else {
      results.failed.push({ email: acc.email, error: error.message })
      console.error(`FAIL ${acc.email}: ${error.message}`)
    }
    continue
  }
  results.created.push({ email: acc.email, id: data.user.id })
  console.log(`OK ${acc.email} -> ${data.user.id}`)
}

console.log('\n=== 결과 ===')
console.log('생성:', results.created.length, '/ 스킵(중복):', results.skipped.length, '/ 실패:', results.failed.length)
if (results.failed.length) console.log('실패 목록:', JSON.stringify(results.failed, null, 2))

const outPath = configPath.replace(/\.json$/, '.result.json')
writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8')
console.log('결과 저장:', outPath)
