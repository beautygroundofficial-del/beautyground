#!/usr/bin/env node
// 라이브 셀러 첫 컨택 DM — 매일 1명씩 진행 (2026-10-01)
// 사용: node --env-file=.env scripts/seller_outreach_daily.mjs
// 필요 환경변수: GMAIL_USER, GMAIL_APP_PASSWORD
//
// - channel:"email" 후보 → 실제로 그 사람에게 메일을 자동 발송한다.
// - channel:"kakao"/"instagram" 후보 → 카톡/인스타 DM은 자동화가 안 돼서(채팅창이 앱 안에서만
//   열림) 대신 대표님(beautyground.official@gmail.com)에게 "오늘 보낼 사람 + 붙여넣을 문구"를
//   메일로 보낸다. 대표님이 앱에서 복사+붙여넣기만 하면 되게.
// - 하루에 이메일 채널 1명 + 카톡/인스타 채널 1명, 총 최대 2명까지만 처리한다(한번에 몰아서
//   보내지 않음 — 대표님 지시: "하루 6~10개만" 원칙과 같은 취지).

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

let didSomething = false

// 1) 이메일 채널 — 실제 후보에게 직접 발송
const emailCandidate = queue.candidates.find((c) => c.channel === 'email' && !c.sent)
if (emailCandidate) {
  try {
    await send({
      from: `"뷰티그라운드" <${GMAIL_USER}>`,
      to: emailCandidate.contact,
      subject: SUBJECT,
      text: buildBody(emailCandidate),
    })
    emailCandidate.sent = true
    emailCandidate.sent_at = new Date().toISOString()
    console.log(`[이메일 발송 완료] ${emailCandidate.name} <${emailCandidate.contact}>`)
    didSomething = true
  } catch (e) {
    console.error(`[이메일 발송 실패] ${emailCandidate.name}:`, e.message)
  }
} else {
  console.log('[이메일 채널] 남은 후보 없음')
}

// 2) 카톡/인스타 채널 — 대표님께 오늘의 대상+문구 리마인드 메일만 발송(실제 DM은 직접 보내셔야 함)
const manualCandidate = queue.candidates.find((c) => (c.channel === 'kakao' || c.channel === 'instagram') && !c.sent)
if (manualCandidate) {
  try {
    await send({
      from: `"뷰티그라운드 봇" <${GMAIL_USER}>`,
      to: GMAIL_USER,
      subject: `[오늘의 라이브 셀러 DM] ${manualCandidate.name} (${manualCandidate.channel})`,
      text: `오늘 보낼 사람: ${manualCandidate.name}\n연락처: ${manualCandidate.contact}${manualCandidate.note ? `\n주의: ${manualCandidate.note}` : ''}\n\n──── 아래 문구를 그대로 붙여넣으세요 ────\n\n${buildBody(manualCandidate)}`,
    })
    manualCandidate.sent = true
    manualCandidate.sent_at = new Date().toISOString()
    console.log(`[리마인드 메일 발송] ${manualCandidate.name}`)
    didSomething = true
  } catch (e) {
    console.error(`[리마인드 메일 실패] ${manualCandidate.name}:`, e.message)
  }
} else {
  console.log('[카톡/인스타 채널] 남은 후보 없음')
}

if (didSomething && !DRY_RUN) {
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf-8')
  console.log('큐 상태 저장 완료')
} else if (didSomething) {
  console.log('(DRY RUN이라 큐 파일은 실제로 저장하지 않음)')
} else {
  console.log('오늘 처리할 후보가 없습니다 — 큐가 모두 소진됐습니다.')
}
