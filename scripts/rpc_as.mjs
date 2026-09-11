#!/usr/bin/env node
// 테스트 계정으로 로그인해 RPC/REST를 부른다 — 브라우저 없이 화면 로직을 검증할 때. (2026-09-11)
//
//   사용:  node scripts/rpc_as.mjs <email> <password> rpc <function> '<json params>'
//          node scripts/rpc_as.mjs <email> <password> select <table> '<query string>'   # 예: 'select=id,content&limit=3'
//          node scripts/rpc_as.mjs anon rpc get_board_feed '{"p_categories":[]}'        # 비로그인
//   환경변수: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (.env 와 같은 값 — 공개용 키)
//
// 예) 구매자 test3 로 하루 이야기 피드:  node scripts/rpc_as.mjs test3@test.com test1234 rpc get_diary_feed '{"p_sort":"recent","p_limit":3}'
// 주의: 실제 운영 DB 에 쓰는 RPC(글쓰기·하트 등)를 부르면 진짜 데이터가 생긴다 — 끝나면 되돌릴 것.

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anon) { console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 없습니다'); process.exit(2) }

const [email, password, mode, name, paramsRaw] = process.argv.slice(2)
if (!email || !mode || !name) {
  console.error('사용: node scripts/rpc_as.mjs <email|anon> <password> rpc <fn> [json] | select <table> [query]')
  process.exit(2)
}

const sb = createClient(url, anon, { auth: { persistSession: false } })
if (email !== 'anon') {
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) { console.error('로그인 실패:', error.message); process.exit(1) }
}

if (mode === 'rpc') {
  const params = paramsRaw ? JSON.parse(paramsRaw) : {}
  const { data, error } = await sb.rpc(name, params)
  if (error) { console.error('RPC 오류:', error); process.exit(1) }
  console.log(JSON.stringify(data, null, 2))
} else if (mode === 'select') {
  const qs = new URLSearchParams(paramsRaw || 'select=*&limit=5')
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(`${url}/rest/v1/${name}?${qs}`, {
    headers: { apikey: anon, Authorization: `Bearer ${session?.access_token ?? anon}` },
  })
  console.log(await res.text())
} else {
  console.error('mode 는 rpc | select'); process.exit(2)
}
