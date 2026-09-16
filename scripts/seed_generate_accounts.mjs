#!/usr/bin/env node
// 커뮤니티 시딩용 계정 100개 페르소나 생성 — 2026-09-17
// 계정 자체는 안 만들고, 이메일/닉네임/연령대 페르소나/카테고리 배정/좋아요·댓글 로테이션 코호트(A~E)만
// 결정론적으로 생성해서 JSON으로 출력한다. 매번 새로 기획하지 않도록 규칙을 코드에 고정.
//
// 사용: node scripts/seed_generate_accounts.mjs > <출력경로>.json
// ⚠️ 출력 JSON에 계정 비밀번호(랜덤 생성)가 평문으로 들어간다 — 절대 커밋하지 말 것(리포 밖/스크래치패드에만 저장).

import { randomBytes } from 'node:crypto'
function randomPassword() {
  return randomBytes(12).toString('base64').replace(/[+/=]/g, 'x') + 'Aa1!'
}

const CATEGORY_WEIGHTS = {
  // [40대 비중, 60대 비중] — 합 1.0
  kids: [0.8, 0.2],       // 육아
  spouse: [0.5, 0.5],     // 부부
  parents: [0.7, 0.3],    // 부모님
  body: [0.3, 0.7],       // 건강
  menopause: [0.15, 0.85],// 갱년기
  skin: [0.7, 0.3],       // 피부
  mind: [0.5, 0.5],       // 마음
  living: [0.3, 0.7],     // 살림
  eco: [0.35, 0.65],      // 절약
  chat: [0.75, 0.25],     // 잡담
}
const CATEGORIES = Object.keys(CATEGORY_WEIGHTS)

const NICK_40 = [
  '민준맘', '서연맘', '워킹맘일기', '도담도담', '소풍가자', '커피한잔', '오후의여유',
  '달콤한하루', '웃는하루', '분주한일상', '작은행복', '알뜰살림꾼', '동네언니',
  '오늘도맑음', '하루한줄', '느린오후', '봄날처럼', '살짝수다', '자유부인',
  '햇살가득', '퇴근길에', '주말엔집콕', '냉장고파먹기', '베란다텃밭', '아이키우는중',
]
const NICK_60 = [
  '은경씨', '행복한할매', '인생은아름다워', '느긋하게', '손주바라기', '여유로운오후',
  '정든동네', '장미꽃길', '고향의봄', '지혜로운하루', '다정한이웃', '옛날생각',
  '세월의흔적', '인생2막', '느티나무그늘', '작은텃밭', '고운노을', '마음의양식',
  '건강이최고', '정겨운수다', '오십견이겨내기', '갱년기극복중', '동창모임', '경로당총무',
]

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260917) // 고정 시드 — 재실행해도 같은 결과

function pick(arr) { return arr[Math.floor(rand() * arr.length)] }
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const TOTAL = 100
const COHORTS = ['A', 'B', 'C', 'D', 'E'] // 20명씩, 좋아요·댓글 로테이션용
const usedNick = new Set()
const accounts = []

for (let i = 1; i <= TOTAL; i++) {
  // 연령 페르소나: 카테고리 가중치 평균으로 전체 40:60 비율을 대략 맞춤(카테고리 2~3개 배정 후 평균)
  const shuffledCats = shuffle(CATEGORIES)
  const myCats = shuffledCats.slice(0, 2 + (i % 2)) // 2개 또는 3개
  const avg60 = myCats.reduce((s, c) => s + CATEGORY_WEIGHTS[c][1], 0) / myCats.length
  const persona = rand() < avg60 ? '60대' : '40대'

  let nick
  do {
    nick = pick(persona === '40대' ? NICK_40 : NICK_60) + String(i).padStart(2, '0')
  } while (usedNick.has(nick))
  usedNick.add(nick)

  const id = String(i).padStart(3, '0')
  accounts.push({
    seq: i,
    email: `bgseed${id}@beautyground.co.kr`,
    password: randomPassword(),
    nickname: nick,
    persona_age: persona,
    categories: myCats,
    cohort: COHORTS[i % COHORTS.length],
    is_seed: true,
    seed_batch: 'community-2026-09-17',
  })
}

console.log(JSON.stringify({ generated_at: new Date().toISOString(), total: TOTAL, cohorts: COHORTS, accounts }, null, 2))
