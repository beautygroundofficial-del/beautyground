#!/usr/bin/env node
// 시딩 게시물 좋아요·댓글 반응 계획 생성 — 2026-09-17 (v2, 분포 편차 반영)
// 100개 계정 중 글을 안 올린 계정 중에서 "오늘의 참여 코호트"(20~30명)를 고정으로 뽑고,
// 게시물마다 그 코호트에서 랜덤한 인원·랜덤한 좋아요/댓글 수를 뽑아 분포가 게시물마다 다르게 만든다.
// (v1의 실수: 모든 게시물에 똑같이 5명/댓글2개를 고정 배정해서 패턴이 다 똑같아 보였음 — 대표님 지적으로 수정)
//
// 사용: node scripts/gen_seed_reactions.mjs <accounts.json> <posts.json> [seed] > <출력경로>.json

import { readFileSync } from 'node:fs'

const COMMENTS_40 = [
  '저도 완전 공감이에요ㅠㅠ', '오 예쁘네요!', '힐링되는 사진이다', '저장해가요~',
  '진짜 그런 날 있죠', '오늘 저도 딱 이 기분이었는데', '완전 좋다 이거', '저도 나가고 싶어지네요',
  '오늘 하루도 화이팅', '이 사진 뭔가 좋다', '공감 백만개', '저만 그런거 아니었네요',
]
const COMMENTS_60 = [
  '참 좋네요', '나도 저기 가보고싶다', '고생 많으셨어요', '보기만 해도 편안해지네',
  '맞아요 그럴때 있지', '사진이 참 곱네요', '이런게 사는 낙이지', '건강 잘 챙기세요',
  '오늘도 좋은 하루 되시길', '나도 그런 생각 들 때가 있어', '보니까 마음이 편해지네', '잘 보고 갑니다',
]

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const seedArg = Number(process.argv[4]) || 20260917
const rand = mulberry32(seedArg)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}
function randInt(min, max) { return min + Math.floor(rand() * (max - min + 1)) }

const [accountsPath, postsPath] = process.argv.slice(2)
const accountData = JSON.parse(readFileSync(accountsPath, 'utf-8'))
const posts = JSON.parse(readFileSync(postsPath, 'utf-8')).filter((p) => p.ok)
const posterEmails = new Set(posts.map((p) => p.email))
const pool = accountData.accounts.filter((a) => !posterEmails.has(a.email))

// 오늘의 참여 코호트 — 100명 중 20~30명(여기선 27명)만 고정으로 뽑아서 그 안에서만 활동시킨다
const cohortSize = randInt(20, 30)
const cohort = shuffle(pool).slice(0, cohortSize)

const plan = []
for (const post of posts) {
  // 게시물마다 좋아요 인원·댓글 인원을 독립적으로 랜덤화 — 다 다르게 보이도록
  const likeCount = randInt(2, Math.min(18, cohort.length))
  const likers = shuffle(cohort).slice(0, likeCount)
  const commentCount = randInt(0, 4)
  const commenters = new Set(shuffle(likers.length ? likers : cohort).slice(0, commentCount).map((a) => a.email))

  for (const acc of likers) {
    const pool2 = acc.persona_age === '40대' ? COMMENTS_40 : COMMENTS_60
    plan.push({
      email: acc.email,
      password: acc.password,
      nickname: acc.nickname,
      post_id: post.post.post_id,
      like: true,
      comment: commenters.has(acc.email) ? pool2[randInt(0, pool2.length - 1)] : null,
    })
  }
}

console.error(`코호트 ${cohortSize}명, 총 반응 ${plan.length}건(댓글 ${plan.filter((p) => p.comment).length}건)`)
console.log(JSON.stringify(plan, null, 2))
