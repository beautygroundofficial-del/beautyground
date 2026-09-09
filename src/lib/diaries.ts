import { supabase } from './supabase'

// 일기(살아가는 이야기) — 유저가 사진과 함께 일상을 남기면 diary_post 미션이 자동 적립된다.
// 적립은 화면에서 claim_mission을 따로 부르지 않고 create_diary RPC 안에서 한 번에 처리한다(누락·중복 방지).

export interface Diary {
  id: string
  user_id: string
  nickname: string | null
  content: string
  images: string[]
  // ⚠️ like_count / liked_by_me 는 2026-09-07 이후 화면에서 쓰지 않는다.
  //    좋아요(평가) 대신 공감 반응(pat/same/cheer)으로 바꿨고, 기존 데이터·함수는
  //    삭제 전 보고 원칙에 따라 지우지 않고 남겨뒀다.
  like_count: number
  liked_by_me: boolean
  is_mine: boolean
  created_at: string
  // 공감 반응 — ReactionCounts 와 같은 모양이라 ReactionBar 에 그대로 넘길 수 있다.
  pat: number
  same: number
  cheer: number
  my_kind: 'pat' | 'same' | 'cheer' | null
  comment_count: number
}

export interface BestDiary {
  id: string
  nickname: string | null
  content: string
  images: string[]
  // 좋아요 수가 아니라 '공감한 사람 수'(1인 1표) — 2026-09-07 기준 변경
  reaction_count: number
  created_at: string
}

export type DiarySort = 'recent' | 'popular'

export async function getDiaryFeed(sort: DiarySort = 'recent', limit = 20, offset = 0): Promise<Diary[]> {
  const { data, error } = await supabase.rpc('get_diary_feed', {
    p_sort: sort, p_limit: limit, p_offset: offset,
  })
  if (error) return []
  return (data ?? []) as Diary[]
}

export async function getMonthlyBestDiaries(limit = 3): Promise<BestDiary[]> {
  const { data, error } = await supabase.rpc('get_monthly_best_diaries', { p_limit: limit })
  if (error) return []
  return (data ?? []) as BestDiary[]
}

export interface CreateDiaryResult {
  diary_id: string | null
  awarded: number
  message: string
}

export async function createDiary(
  content: string, images: string[] = [], nickname?: string | null
): Promise<CreateDiaryResult | null> {
  const { data, error } = await supabase.rpc('create_diary', {
    p_content: content, p_images: images, p_nickname: nickname ?? null,
  })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as CreateDiaryResult | null
}

export async function toggleDiaryLike(diaryId: string): Promise<{ liked: boolean; like_count: number } | null> {
  const { data, error } = await supabase.rpc('toggle_diary_like', { p_diary_id: diaryId })
  if (error) return null
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? null) as { liked: boolean; like_count: number } | null
}

export async function deleteDiary(diaryId: string): Promise<boolean> {
  const { error } = await supabase.from('diaries').delete().eq('id', diaryId)
  return !error
}

// ── 댓글 ───────────────────────────────────────────────────────────────────
// 남의 글에 처음 댓글을 달 때만 comment_give 미션이 적립된다(자기 글·5자 미만·재작성은 0P).
export interface DiaryComment {
  id: string
  nickname: string | null
  content: string
  created_at: string
  is_mine: boolean
}

export async function getDiaryComments(diaryId: string, limit = 50): Promise<DiaryComment[]> {
  const { data, error } = await supabase.rpc('get_diary_comments', {
    p_diary_id: diaryId, p_limit: limit, p_offset: 0,
  })
  if (error) return []
  return (data ?? []) as DiaryComment[]
}

export interface CreateCommentResult {
  comment_id: string | null
  awarded: number
  message: string
}

export async function createDiaryComment(
  diaryId: string, content: string, nickname?: string | null,
): Promise<CreateCommentResult> {
  const fail: CreateCommentResult = { comment_id: null, awarded: 0, message: '잠시 후 다시 시도해 주세요' }
  const { data, error } = await supabase.rpc('create_diary_comment', {
    p_diary_id: diaryId, p_content: content, p_nickname: nickname ?? null,
  })
  if (error) return fail
  const row = Array.isArray(data) ? data[0] : data
  return (row ?? fail) as CreateCommentResult
}

// 본인 댓글만 지워진다(RLS). 실패하면 false.
export async function deleteDiaryComment(commentId: string): Promise<boolean> {
  const { error } = await supabase.from('diary_comments').delete().eq('id', commentId)
  return !error
}

// ── 사진 업로드 ────────────────────────────────────────────────────────────
// Storage 용량(1GB)이 한정돼 있어 원본을 그대로 올리지 않는다. 긴 변 1080px webp로 줄여
// 상품 상세 이미지와 같은 product-images 버킷의 diaries/ 경로에 넣는다.
const MAX_EDGE = 1080

async function shrinkToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/webp', 0.8)
  )
}

export async function uploadDiaryImages(files: File[]): Promise<string[]> {
  return uploadCommunityImages(files, 'diaries')
}

// 게시판(board/) 등 다른 커뮤니티 글도 같은 버킷·같은 축소 규칙으로 올린다.
export async function uploadCommunityImages(files: File[], folder: 'diaries' | 'board'): Promise<string[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []

  const urls: string[] = []
  for (let i = 0; i < files.length; i++) {
    const blob = await shrinkToWebp(files[i])
    const path = `${folder}/${session.user.id}/${Date.now()}_${i}.webp`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, blob, { upsert: true, contentType: 'image/webp' })
    if (error) continue
    urls.push(supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl)
  }
  return urls
}
