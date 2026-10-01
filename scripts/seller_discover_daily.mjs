#!/usr/bin/env node
// 라이브 셀러 자동 발굴 — 매일 아침 신규 후보를 찾아 큐에 보충 (2026-10-01)
// 대표님 지시: "매일 아침 셀러를 찾아서 중복된것은 제외해서 리스트를 만들고 매일 10명씩 보내"
//
// 기준(옵시디언 '라이브커머스 진행자 섭외 후보 리스트' 확정 기준 재사용):
//  - 구독자 4,000~20,000명
//  - 채널명·설명에 뷰티 키워드(화장품/뷰티/스킨케어/향수 등) 포함
//  - 채널 설명에서 연락처(카카오 채널 링크/이메일/인스타)를 추출할 수 있는 채널만(연락 불가하면 의미 없음)
//  - 이미 본 적 있는 채널(seen 파일)·이미 큐에 있는 연락처는 제외
//
// ⚠️ 완전 자동 발굴이라 사람이 직접 라이브 탭까지 확인하던 기존 방식보다 정밀도가 낮을 수 있다
//    (설명란에 뷰티 키워드가 있어도 실제로는 라이브 셀러가 아닌 채널이 섞일 수 있음).
//    큐에 note로 "자동발굴" 표시해두니, 발송 전 가끔 샘플 점검 권장.
//
// 사용: YOUTUBE_DATA_API_KEY=xxx node scripts/seller_discover_daily.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const QUEUE_PATH = path.join(__dirname, 'seller_outreach_queue.json')
const SEEN_PATH = path.join(__dirname, 'seller_outreach_seen_channels.json')

const API_KEY = process.env.YOUTUBE_DATA_API_KEY
if (!API_KEY) { console.error('YOUTUBE_DATA_API_KEY 환경변수가 없습니다'); process.exit(2) }
const GEMINI_KEY = process.env.GEMINI_API_KEY // 없어도 동작은 함(그 경우 키워드 필터만으로 판단)

// 채널 설명(자기소개)만으로는 "여러 브랜드를 소개하는 라이브 셀러"와 "자체 브랜드 채널"을
// 못 가리고, 채널이 지금도 활발한지도 알 수 없다(2026-10-01 1차 테스트에서 수작업 조사 때 이미
// 제외했던 자사 브랜드 채널이 그대로 다시 걸림 — 대표님 지시: "찾은것을 다시 조사해서 우리와
// 맞는지를 확인해야해"). 그래서 최근 실제 올린 영상 제목들까지 같이 보여주고 Gemini로
// ①진짜 여러 브랜드를 소개하는 셀러인지 ②최근에도 활동 중인지 ③맞으면 자연스러운 첫 인사말까지
// 한 번에 판별한다(seed_gen_week_plan.py의 fits_category 판정과 같은 패턴).
async function investigateChannel(title, desc, recentTitles) {
  if (!GEMINI_KEY) return { fits: true, first_line: `${title} 방송 잘 보고 있어요 — 백화점 입점 뷰티 브랜드로 라인업을 넓혀보시면 어떨까 해서 연락드려요.` }
  const videoList = recentTitles.length ? recentTitles.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(최근 영상 없음)'
  const prompt = (
    `유튜브 채널을 실사 조사하듯 꼼꼼히 판단하세요.\n채널명: "${title}"\n채널 자기소개: "${desc.slice(0, 500)}"\n` +
    `최근 올린 영상 제목 ${recentTitles.length}개:\n${videoList}\n\n` +
    '아래 두 조건을 "최근 영상 제목"을 근거로 확인하세요(자기소개 문구만 보고 판단하지 말 것):\n' +
    '1) fits_criteria: 이 채널이 (a) 여러 뷰티 브랜드 상품을 소개·판매하는 라이브커머스 셀러이고 ' +
    '(자기 단일 브랜드만 파는 제조사·브랜드 공식 채널이 아니고), (b) 최근 영상들이 실제로 라이브 방송/제품소개/판매 ' +
    '관련 내용으로 보이며 방치된 채널이 아닌 경우에만 true. 둘 중 하나라도 불확실하면 false(안전하게 제외).\n' +
    '2) fits_criteria가 true일 때만: 최근 영상 중 하나를 구체적으로 언급하며 자연스럽게 연락하는 ' +
    '첫 인사 문장 1개(반말/구어체 섞어서, "~방송 잘 보고 있어요 — 구체적인 영상 내용 언급 — 백화점 입점 뷰티 ' +
    '브랜드로 라인업을 넓혀보시면 어떨까 해서 연락드려요" 형태)\n' +
    '다음 JSON 형식으로만 답하세요: {"fits_criteria": true/false, "first_line": "..."}'
  )
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json' },
      }),
    })
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    const parsed = JSON.parse(text)
    if (parsed.fits_criteria !== true) return { fits: false }
    return { fits: true, first_line: parsed.first_line || `${title} 방송 잘 보고 있어요 — 백화점 입점 뷰티 브랜드로 라인업을 넓혀보시면 어떨까 해서 연락드려요.` }
  } catch (e) {
    console.error(`[Gemini 조사 실패, 안전하게 제외] ${title}:`, e.message)
    return { fits: false }
  }
}

const MIN_SUBS = 4000
const MAX_SUBS = 20000
const DAILY_TARGET = Number(process.env.DISCOVER_TARGET || 10) // 하루 발송량만큼만 보충(쌓아두지 않음)

const BEAUTY_KEYWORDS = ['화장품', '뷰티', '스킨케어', '향수', '코스메틱', '뷰티템']
// 여러 브랜드를 소개하는 "라이브 셀러"인지 신호 — 이게 없으면 자사 브랜드 채널일 가능성이 높음
// (2026-10-01 1차 테스트에서 "원더풀:리프팅 화장품 전문매장"처럼 이미 수작업 조사에서
//  "셀러가 아니라 자체 브랜드"로 걸러냈던 채널이 그대로 다시 잡힌 걸 보고 추가).
const SELLER_SIGNAL_KEYWORDS = ['라이브', '쇼핑', '셀러', '판매', '방송', '공구', '특가']
// 채널명·설명에 이 단어가 있으면 자사 브랜드 매장/제조사일 가능성이 높아 제외
const BRAND_EXCLUDE_KEYWORDS = ['전문매장', '공식몰', '공식스토어', '공식 스토어', 'OFFICIAL STORE', '제조', '브랜드관']
// 창고형(땡처리·재고떨이식 다품목 판매) 셀러 제외 — 백화점 입점 브랜드 파트너십 취지와 안 맞음
// (2026-10-01 대표님 지시: "창고형 셀러는 제외해")
const WAREHOUSE_EXCLUDE_KEYWORDS = ['창고', '땡처리', '재고떨이', '창고정리', '창고라이브', '초특가창고']
const QUERIES = [
  '뷰티 라이브커머스', '화장품 라이브 방송', '뷰티 셀러 라이브', '스킨케어 라이브판매', '코스메틱 라이브',
  '뷰티 인플루언서 라이브', '화장품 공구 라이브', '뷰티 쇼핑 라이브', '향수 라이브 판매', '뷰티템 라이브',
  '화장품 라방', '뷰티 라방 셀러', '스킨케어 공구', '뷰티 특가 라이브',
]

const queue = JSON.parse(readFileSync(QUEUE_PATH, 'utf-8'))
const seen = existsSync(SEEN_PATH) ? JSON.parse(readFileSync(SEEN_PATH, 'utf-8')) : { channel_ids: [] }
const seenSet = new Set(seen.channel_ids)
const existingContacts = new Set(queue.candidates.map((c) => c.contact))

async function searchChannels(query) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=15&relevanceLanguage=ko&regionCode=KR&key=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) { console.error(`[검색 오류] ${query}:`, data.error.message); return [] }
  return (data.items || []).map((i) => i.snippet?.channelId || i.id?.channelId).filter(Boolean)
}

async function getChannelDetails(ids) {
  if (ids.length === 0) return []
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${ids.join(',')}&key=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.error) { console.error('[채널조회 오류]', data.error.message); return [] }
  return data.items || []
}

// 자기소개 문구만 믿지 않고, 실제 최근 올린 영상 제목까지 가져와서 Gemini 판별 근거로 쓴다
// (대표님 지시: "찾은것을 다시 조사해서 우리와 맞는지를 확인해야해").
async function getRecentVideoTitles(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=date&maxResults=5&key=${API_KEY}`
  try {
    const res = await fetch(url)
    const data = await res.json()
    if (data.error) return []
    return (data.items || []).map((i) => i.snippet?.title).filter(Boolean)
  } catch {
    return []
  }
}

function extractContact(description) {
  const kakaoMatch = description.match(/pf\.kakao\.com\/[A-Za-z0-9_/]+/)
  if (kakaoMatch) return { channel: 'kakao', contact: kakaoMatch[0] }
  const igMatch = description.match(/instagram\.com\/[A-Za-z0-9_.]+/)
  if (igMatch) return { channel: 'instagram', contact: `Instagram ${igMatch[0]}` }
  const emailMatch = description.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (emailMatch) return { channel: 'email', contact: emailMatch[0] }
  return null
}

const found = []
const channelIdSet = new Set()

for (const q of QUERIES) {
  if (found.length >= DAILY_TARGET) break
  const ids = await searchChannels(q)
  const newIds = ids.filter((id) => !seenSet.has(id) && !channelIdSet.has(id))
  if (newIds.length === 0) continue
  const details = await getChannelDetails(newIds)
  for (const ch of details) {
    channelIdSet.add(ch.id)
    seenSet.add(ch.id)
    const subs = Number(ch.statistics?.subscriberCount || 0)
    const desc = ch.snippet?.description || ''
    const title = ch.snippet?.title || ''
    const hitsBeauty = BEAUTY_KEYWORDS.some((k) => desc.includes(k) || title.includes(k))
    const looksLikeBrand = BRAND_EXCLUDE_KEYWORDS.some((k) => desc.includes(k) || title.includes(k))
    const looksLikeWarehouse = WAREHOUSE_EXCLUDE_KEYWORDS.some((k) => desc.includes(k) || title.includes(k))
    if (subs < MIN_SUBS || subs > MAX_SUBS || !hitsBeauty || looksLikeBrand || looksLikeWarehouse) continue
    const contact = extractContact(desc)
    if (!contact || existingContacts.has(contact.contact)) continue
    const recentTitles = await getRecentVideoTitles(ch.id)
    const looksLikeWarehouseByVideos = recentTitles.some((t) => WAREHOUSE_EXCLUDE_KEYWORDS.some((k) => t.includes(k)))
    if (looksLikeWarehouseByVideos) { console.log(`  [창고형 제외] ${title}`); continue }
    const result = await investigateChannel(title, desc, recentTitles)
    if (!result.fits) { console.log(`  [Gemini 조사 결과 제외] ${title}`); continue }
    found.push({
      name: title,
      channel: contact.channel,
      contact: contact.contact,
      first_line: result.first_line,
      note: `자동발굴(구독자 ${subs.toLocaleString()}명, 최근영상 ${recentTitles.length}개 확인함) — 발송 전 샘플 점검 권장`,
      sent: false,
      source: 'youtube',
    })
    existingContacts.add(contact.contact)
    if (found.length >= DAILY_TARGET) break
  }
}

if (found.length > 0) {
  queue.candidates.push(...found)
  writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf-8')
  console.log(`[신규 후보 ${found.length}명 추가]`, found.map((f) => `${f.name}(${f.channel})`).join(', '))
} else {
  console.log('신규 후보를 못 찾았습니다(기준에 맞는 채널 없음 또는 전부 중복).')
}
writeFileSync(SEEN_PATH, JSON.stringify({ channel_ids: [...seenSet] }, null, 2), 'utf-8')
console.log(`seen 채널 누적 ${seenSet.size}개`)
