#!/usr/bin/env node
// 시딩 게시물 좋아요·댓글 반응 계획 생성 — 2026-09-17
// seed_posts.result.json(방금 올린 게시물 목록)과 seed_accounts.json(계정 페르소나)을 읽어,
// 글을 올리지 않은 계정 중 일부가 자연스럽게 좋아요·댓글을 남기도록 하는 계획을 만든다.
// 매 게시물당 좋아요 3~5개, 그 중 1~2개는 댓글도 함께. 같은 계정이 매번 똑같은 문구를 쓰지 않게 페르소나별 문구 풀에서 뽑는다.
//
// 사용: node scripts/gen_seed_reactions.mjs <accounts.json> <posts.json> > <출력경로>.json

import { readFileSync } from 'node:fs'

const COMMENTS_40 = [
  '저도 완전 공감이에요ㅠㅠ', '오 예쁘네요!', '힐링되는 사진이다', '저장해가요~',
  '진짜 그런 날 있죠', '오늘 저도 딱 이 기분이었는데', '완전 좋다 이거', '저도 나가고 싶어지네요',
]
const COMMENTS_60 = [
  '참 좋네요', '나도 저기 가보고싶다', '고생 많으셨어요', '보기만 해도 편안해지네',
  '맞아요 그럴때 있지', '사진이 참 곱네요', '이런게 사는 낙이지', '건강 잘 챙기세요',
]

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260917)
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

const [accountsPath, postsPath] = process.argv.slice(2)
const accountData = JSON.parse(readFileSync(accountsPath, 'utf-8'))
const posts = JSON.parse(readFileSync(postsPath, 'utf-8'))
const posterEmails = new Set(posts.map(p => p.email))
const reactors = accountData.accounts.filter(a => !posterEmails.has(a.email))

const plan = []
for (const post of posts) {
  if (!post.ok) continue
  const picks = shuffle(reactors).slice(0, 5)
  picks.forEach((acc, idx) => {
    const withComment = idx < 2
    const pool = acc.persona_age === '40대' ? COMMENTS_40 : COMMENTS_60
    plan.push({
      email: acc.email,
      password: acc.password,
      nickname: acc.nickname,
      post_id: post.post.post_id,
      like: true,
      comment: withComment ? pool[Math.floor(rand() * pool.length)] : null,
    })
  })
}

console.log(JSON.stringify(plan, null, 2))
