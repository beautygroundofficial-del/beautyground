#!/usr/bin/env node
// 라이브 셀러 첫 컨택 DM — 매일 최대 10명 진행 (2026-10-01, 대표님 지시 "하루 10명은 보내야해")
// 사용: node --env-file=.env scripts/seller_outreach_daily.mjs
// 필요 환경변수: GMAIL_USER, GMAIL_APP_PASSWORD
//
// - channel:"email" 후보 → 실제로 그 사람에게 메일을 자동 발송한다(현재 2명뿐).
// - channel:"kakao"/"instagram" 후보 → 카톡/인스타 DM은 자동화가 안 돼서(채팅창이 앱 안에서만
//   열림) 대신 오늘 처리할 사람들을 하나의 다이제스트 메일로 묶어 대표님께 보낸다
//   (사람마다 메일을 따로 보내면 받은편지함이 지저분해져서 묶음). 대표님이 앱에서 한 명씩
//   복사+붙여넣기만 하면 되게.
// - 하루 최대 DAILY_LIMIT명까지 처리(이메일 먼저 소진한 뒤 나머지는 카톡/인스타로 채움).

import nodemailer from 'nodemailer'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const QUEUE_PATH = path.join(__dirname, 'seller_outreach_queue.json')

const GMAIL_USER = process.env.GMAIL_USER || 'beautyground.official@gmail.com'
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD
const DRY_RUN = process.env.DRY_RUN === '1'
if (!DRY_RUN && !GMAIL_APP_PASSWORD) { console.error('GMAIL_APP_PASSWORD 환경변수가 없습니다 (테스트만 하려면 DRY_RUN=1)'); process.exit(2) }

const queue = JSON.parse(readFileSync(QUEUE_PATH, 'utf-8'))
const transporter = DRY_RUN ? null : nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
})
async function send(opts) {
  if (DRY_RUN) { console.log('--- DRY RUN: 아래 메일을 실제로는 보내지 않음 ---\nto:', opts.to, '\nsubject:', opts.subject, '\n', opts.text, '\n---'); return }
  await transporter.sendMail(opts)
}

const SUBJECT = '[뷰티그라운드] 전국 백화점 라이브커머스 진행자 파트너 제안 (제품 제공형 — 장소 무관)'

function buildBody(c) {
  return `안녕하세요, 뷰티 전문 업체 뷰티그라운드입니다.\n${c.first_line}\n\n${queue.common_body}`
}

const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 10)
let didSomething = false
let processed = 0

// 1) 이메일 채널 — 남은 후보 전부(최대 DAILY_LIMIT) 실제로 직접 발송
const emailCandidates = queue.candidates.filter((c) => c.channel === 'email' && !c.sent)
for (const c of emailCandidates) {
  if (processed >= DAILY_LIMIT) break
  try {
    await send({
      from: `"뷰티그라운드" <${GMAIL_USER}>`,
      to: c.contact,
      subject: SUBJECT,
      text: buildBody(c),
    })
    c.sent = true
    c.sent_at = new Date().toISOString()
    console.log(`[이메일 발송 완료] ${c.name} <${c.contact}>`)
    didSomething = true
    processed++
  } catch (e) {
    console.error(`[이메일 발송 실패] ${c.name}:`, e.message)
  }
}

// 2) 카톡/인스타 채널 — 남은 슬롯만큼 뽑아 하나의 다이제스트 메일로 묶어 대표님께 발송
//    (실제 DM은 앱에서 대표님이 직접 보내야 함)
const manualSlots = DAILY_LIMIT - processed
const manualCandidates = queue.candidates.filter((c) => (c.channel === 'kakao' || c.channel === 'instagram') && !c.sent).slice(0, manualSlots)
if (manualCandidates.length > 0) {
  const digestBody = manualCandidates.map((c, i) => (
    `${i + 1}) ${c.name} (${c.channel})\n연락처: ${c.contact}${c.note ? `\n주의: ${c.note}` : ''}\n\n${buildBody(c)}\n`
  )).join('\n──────────────────────\n\n')
  try {
    await send({
      from: `"뷰티그라운드 봇" <${GMAIL_USER}>`,
      to: GMAIL_USER,
      subject: `[오늘의 라이브 셀러 DM ${manualCandidates.length}명] ${manualCandidates.map((c) => c.name).join(', ')}`,
      text: `오늘 보낼 사람 ${manualCandidates.length}명입니다. 한 명씩 복사해서 해당 채널(카톡/인스타)에 직접 붙여넣어 주세요.\n\n${digestBody}`,
    })
    for (const c of manualCandidates) { c.sent = true; c.sent_at = new Date().toISOString() }
    console.log(`[리마인드 다이제스트 발송] ${manualCandidates.map((c) => c.name).join(', ')}`)
    didSomething = true
    processed += manualCandidates.length
  } catch (e) {
    console.error('[리마인드 다이제스트 발송 실패]', e.message)
  }
}

if (processed === 0) console.log('오늘 처리할 후보가 없습니다.')
console.log(`오늘 총 ${processed}명 처리 (이메일 ${emailCandidates.filter((c) => c.sent).length}, 카톡/인스타 ${manualCandidates.length})`)

if (didSomething && !DRY_RUN) {
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf-8')
  console.log('큐 상태 저장 완료')
} else if (didSomething) {
  console.log('(DRY RUN이라 큐 파일은 실제로 저장하지 않음)')
} else {
  console.log('오늘 처리할 후보가 없습니다 — 큐가 모두 소진됐습니다.')
}
