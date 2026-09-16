#!/usr/bin/env node
// 시딩 게시물 좋아요·댓글 반응 계획 생성 — 2026-09-17 (v3, 사진 종류별 댓글)
// 100개 계정 중 글을 안 올린 계정 중에서 "오늘의 참여 코호트"(20~30명)를 고정으로 뽑고,
// 게시물마다 그 코호트에서 랜덤한 인원·랜덤한 좋아요/댓글 수를 뽑아 분포가 게시물마다 다르게 만든다.
//
// v1의 실수: 모든 게시물에 똑같이 5명/댓글2개를 고정 배정 — 패턴이 다 똑같아 보임(대표님 지적, 수정됨)
// v2의 실수: 댓글 문구가 사진 내용과 무관하게 랜덤 — 공연 일정 칠판 사진에 "오 예쁘네요!" 처럼 안 맞는 경우 발생
//            (대표님 지적: "사진에 내용과 댓글의 내용이 달라"). posts.result.json의 photo_type을 읽어
//            scenery(풍경)/info(정보·간판·칠판)/mood(분위기·골목)/object(사물) 별로 다른 문구풀을 쓰도록 수정.
//
// 사용: node scripts/gen_seed_reactions.mjs <accounts.json> <posts.json> [seed] > <출력경로>.json

import { readFileSync } from 'node:fs'

const COMMENTS_BY_TYPE = {
  scenery: {
    '40대': ['오 예쁘네요!', '힐링되는 사진이다', '저도 나가고 싶어지네요', '사진 잘 찍으셨다', '저장해가요~'],
    '60대': ['나도 저기 가보고싶다', '사진이 참 곱네요', '보기만 해도 편안해지네', '풍경 좋다', '눈이 다 시원하네'],
  },
  info: {
    '40대': ['저장해가요~', '이거 유용하네요', '여기 어디에요?', '가보고 싶어지네요', '정보 감사해요'],
    '60대': ['나도 저기 가보고싶다', '좋은 정보 고마워요', '적어놔야겠다', '이런거 알려줘서 고마워', '한번 가봐야지'],
  },
  mood: {
    '40대': ['분위기 좋다', '저도 그 기분 알아요', '이런 밤 좋죠', '기분전환 되겠어요', '오늘 저도 딱 이 기분이었는데'],
    '60대': ['보니까 마음이 편해지네', '나도 그런 생각 들 때가 있어', '참 좋네요', '이런게 사는 낙이지', '고생 많으셨어요'],
  },
  object: {
    '40대': ['저도 하나 갖고 싶다', '예쁘네요', '어디 건지 궁금하다', '저장!', '완전 좋다 이거'],
    '60대': ['참 곱다', '나도 저런거 있으면 좋겠네', '잘 보고 갑니다', '보기 좋네', '이쁘게 잘 찍었네'],
  },
}
const FALLBACK_TYPE = 'scenery'

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

// 오늘의 참여 코호트 — 100명 중 20~30명만 고정으로 뽑아서 그 안에서만 활동시킨다
const cohortSize = randInt(20, 30)
const cohort = shuffle(pool).slice(0, cohortSize)

const plan = []
for (const post of posts) {
  const typePool = COMMENTS_BY_TYPE[post.photo_type] ?? COMMENTS_BY_TYPE[FALLBACK_TYPE]

  const likeCount = randInt(2, Math.min(18, cohort.length))
  const likers = shuffle(cohort).slice(0, likeCount)
  const commentCount = randInt(0, 4)
  const commenters = new Set(shuffle(likers.length ? likers : cohort).slice(0, commentCount).map((a) => a.email))

  for (const acc of likers) {
    const phraseList = typePool[acc.persona_age] ?? typePool['40대']
    plan.push({
      email: acc.email,
      password: acc.password,
      nickname: acc.nickname,
      post_id: post.post.post_id,
      like: true,
      comment: commenters.has(acc.email) ? phraseList[randInt(0, phraseList.length - 1)] : null,
    })
  }
}

console.error(`코호트 ${cohortSize}명, 총 반응 ${plan.length}건(댓글 ${plan.filter((p) => p.comment).length}건)`)
console.log(JSON.stringify(plan, null, 2))
