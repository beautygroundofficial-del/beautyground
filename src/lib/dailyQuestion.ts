import { supabase } from './supabase'

// 오늘의 질문 + 토닥토닥 반응 (2026-09-07)
//
// 대표님 지시 "소비자가 놀 수 있는 곳, 휴식을 취하는 곳으로"에 따라 만든 커뮤니티 놀거리.
// 하루 한 개 질문에 한 줄만 답하면 다른 사람 답이 펼쳐진다 — 글을 못 쓰는 사람도 참여가 된다.
//
// ⚠️ 재촉 장치(마감 타이머·당일 소멸·N명 남음)는 의도적으로 넣지 않는다.
// ⚠️ 적립 문구를 앞세우지 않는다 — 포인트를 앞세우면 거래 게시판이 된다.

// ── 반응(좋아요를 대신하는 공감 표시) ────────────────────────────────────
export type ReactionKind = 'pat' | 'same' | 'cheer'
export type ReactionTarget = 'diary' | 'answer'

export const REACTION_META: { kind: ReactionKind; label: string; emoji: string }[] = [
  { kind: 'pat', label: '토닥토닥', emoji: '🤍' },
  { kind: 'same', label: '나도 그래요', emoji: '🙂' },
  { kind: 'cheer', label: '응원해요', emoji: '🌿' },
]

export interface ReactionCounts {
  pat: number
  same: number
  cheer: number
  my_kind: ReactionKind | null
}

// awarded — 이번 클릭으로 받은 포인트. 화면에서 앞세우지 않고, 받았을 때만 조용히 알려준다.
// 자기 글·이미 받은 글·하루 상한 초과는 서버에서 0으로 돌아온다.
export interface ReactionResult extends ReactionCounts {
  awarded: number
}

// 같은 걸 다시 누르면 취소, 다른 걸 누르면 바뀐다. 실패하면 null — 호출부가 이전 상태를 되돌린다.
export async function setReaction(
  target: ReactionTarget,
  targetId: string,
  kind: ReactionKind,
): Promise<ReactionResult | null> {
  const { data, error } = await supabase.rpc('set_reaction', {
    p_target_type: target, p_target_id: targetId, p_kind: kind,
  })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as ReactionResult | null
}

// ── 오늘의 질문 ──────────────────────────────────────────────────────────
export interface TodayQuestion {
  id: string
  ask_date: string
  question: string
  hint: string | null
  answer_count: number
  my_answer: string | null
}

// 오늘 걸린 질문이 없으면 null — 화면에서 카드 자체를 감춘다.
// "오늘은 질문이 없어요"라고 띄우면 그것도 빚처럼 읽힌다.
export async function getTodayQuestion(): Promise<TodayQuestion | null> {
  const { data, error } = await supabase.rpc('get_today_question')
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as TodayQuestion | null
}

export interface QuestionAnswer extends ReactionCounts {
  id: string
  nickname: string | null
  content: string
  created_at: string
  is_mine: boolean
}

export async function getQuestionAnswers(
  questionId: string, limit = 30, offset = 0,
): Promise<QuestionAnswer[]> {
  const { data, error } = await supabase.rpc('get_question_answers', {
    p_question_id: questionId, p_limit: limit, p_offset: offset,
  })
  if (error) return []
  return (data ?? []) as QuestionAnswer[]
}

export interface AnswerResult {
  answer_id: string | null
  awarded: number      // 처음 답할 때만 적립된다(고쳐 쓰기는 0)
  message: string      // 비어 있으면 성공, 값이 있으면 그대로 보여줄 안내 문구
}

// 이미 답한 사람이 다시 부르면 고쳐 쓰기가 된다(질문당 1인 1답).
export async function answerTodayQuestion(
  questionId: string, content: string, nickname?: string | null,
): Promise<AnswerResult> {
  const fail: AnswerResult = { answer_id: null, awarded: 0, message: '잠시 후 다시 시도해 주세요' }
  const { data, error } = await supabase.rpc('answer_today_question', {
    p_question_id: questionId, p_content: content, p_nickname: nickname ?? null,
  })
  if (error) return fail
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? fail) as AnswerResult
}
