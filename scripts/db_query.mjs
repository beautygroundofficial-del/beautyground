#!/usr/bin/env node
// 운영 DB(beautyground-main)에 SQL 실행 — 브라우저·대시보드 없이. (2026-09-11)
//
// 클라우드 세션(claude.ai/code)처럼 Playwright·Supabase 로그인이 없는 곳에서 쓴다.
// Supabase Management API(스코프 토큰: 프로젝트 1개, Database Read-write만)를 부른다.
//
//   사용:  node scripts/db_query.mjs supabase/xxx.sql        # 파일 실행
//          node scripts/db_query.mjs --sql "select now()"     # 한 줄 실행
//   환경변수: SUPABASE_MGMT_TOKEN (sbp_… 스코프 토큰), [SUPABASE_PROJECT_REF 기본 bjqtuklkskrqzbuxdwxm]
//
// ⚠️ 운영 SQL은 반드시 "내용 보고 → 대표님 승인 → 실행" 순서(2026-09-11 확정). 이 스크립트는 실행 수단일 뿐이다.
// ⚠️ 결과가 여러 문장이면 마지막 문장의 결과만 돌아온다(대시보드 SQL Editor와 같음).

import { readFileSync } from 'node:fs'

const token = process.env.SUPABASE_MGMT_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF || 'bjqtuklkskrqzbuxdwxm'
if (!token) { console.error('SUPABASE_MGMT_TOKEN 환경변수가 없습니다'); process.exit(2) }

const args = process.argv.slice(2)
let query
if (args[0] === '--sql') query = args.slice(1).join(' ')
else if (args[0]) query = readFileSync(args[0], 'utf8')
else { console.error('사용: node scripts/db_query.mjs <file.sql> | --sql "<query>"'); process.exit(2) }

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const text = await res.text()
if (!res.ok) { console.error(`HTTP ${res.status}: ${text.slice(0, 2000)}`); process.exit(1) }
let rows
try { rows = JSON.parse(text) } catch { rows = text }
if (Array.isArray(rows)) {
  console.log(rows.length === 0 ? 'OK (no rows)' : JSON.stringify(rows, null, 2))
} else {
  console.log(rows)
}
