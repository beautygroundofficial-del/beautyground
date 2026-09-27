import { supabase } from './supabase'
import type { Diary } from './diaries'
import type { DiarySort } from './diaries'
import type { NewsItem } from './board'
import type { QuestionAnswer } from './dailyQuestion'

export interface ConversationNews extends Omit<NewsItem, 'kind'> {
  kind: NewsItem['kind'] | 'diary_reply' | 'friend_request'
  comment_id?: string | null
}

export interface AnswerConversation extends QuestionAnswer {
  question_id: string
  question: string
  hint: string | null
  ask_date: string
}

export async function getConversationFeed(sort: DiarySort | 'friends', limit = 30): Promise<Diary[]> {
  const { data, error } = await supabase.rpc(sort === 'friends' ? 'get_friend_diary_feed' : 'get_diary_feed', {
    ...(sort === 'friends' ? {} : { p_sort: sort }), p_limit: limit, p_offset: 0,
  })
  if (error) throw error
  return data ?? []
}

export async function getConversationDiary(id: string): Promise<Diary | null> {
  const { data, error } = await supabase.rpc('get_community_diary', { p_diary_id: id })
  if (error) throw error
  return data?.[0] ?? null
}

export async function getAnswerConversation(id: string): Promise<AnswerConversation | null> {
  const { data, error } = await supabase.rpc('get_community_answer', { p_answer_id: id })
  if (error) throw error
  return data?.[0] ?? null
}

export async function getConversationNews(limit = 50): Promise<ConversationNews[]> {
  const result = await supabase.rpc('get_community_news', { p_limit: limit })
  if (!result.error) return result.data ?? []
  // A preview can run before the reviewed SQL has been applied. Never hide other failures.
  if (!['PGRST202', '42883'].includes(result.error.code)) throw result.error
  const legacy = await supabase.rpc('get_my_news', { p_limit: limit })
  if (legacy.error) throw legacy.error
  return legacy.data ?? []
}

export async function markConversationNewsSeen(seenAt: string): Promise<void> {
  const { error } = await supabase.rpc('mark_community_news_seen', { p_seen_at: seenAt })
  if (error) throw error
  window.dispatchEvent(new Event('bg:news-seen'))
}

export function conversationNewsPath(item: ConversationNews): string {
  const comment = item.comment_id ? `&comment=${encodeURIComponent(item.comment_id)}` : ''
  if (item.kind === 'friend_request') return '/app/friends'
  if (item.target_type === 'friend') return `/app/people/${item.target_id}`
  if (item.target_type === 'board') return `/app/board/${item.target_id}?comments=1${comment}`
  if (item.target_type === 'answer') return `/app/home?answer=${item.target_id}${comment}`
  return `/app/diary?focus=${item.target_id}&comments=${item.target_id}${comment}`
}
