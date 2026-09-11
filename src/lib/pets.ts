import { supabase } from './supabase'
import { uploadCommunityImages } from './diaries'

// 펫 프로필 — 이름·종류·사진 하나. 여러 마리 가능. (2026-09-12, 커뮤니티 로드맵 4-10)
// 대표님: "펫과 같이 걷고 이미지 올리길 장려", "우리 앱에 펫도 강조". 서버는 supabase/pets.sql.
// 누구나 읽을 수 있고(카드에 펫 얼굴을 보여주려고), 쓰기는 본인만(RLS).

export type PetKind = 'dog' | 'cat' | 'other'

export const PET_KINDS: { key: PetKind; label: string; emoji: string }[] = [
  { key: 'dog', label: '강아지', emoji: '🐶' },
  { key: 'cat', label: '고양이', emoji: '🐱' },
  { key: 'other', label: '다른 친구', emoji: '🐾' },
]

export const petEmoji = (kind: string) => PET_KINDS.find((k) => k.key === kind)?.emoji ?? '🐾'

export interface Pet {
  id: string
  user_id: string
  name: string
  kind: PetKind
  photo_url: string | null
  created_at: string
}

// 글에 붙어 오는 펫(피드 RPC 의 pets jsonb)
export interface DiaryPet {
  id: string
  name: string
  kind: PetKind
  photo_url: string | null
}

export async function getMyPets(): Promise<Pet[]> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []
  const { data, error } = await supabase
    .from('pets').select('id, user_id, name, kind, photo_url, created_at')
    .eq('user_id', session.user.id).order('created_at')
  if (error) return []
  return (data ?? []) as Pet[]
}

export async function getUserPets(userId: string): Promise<Pet[]> {
  const { data, error } = await supabase
    .from('pets').select('id, user_id, name, kind, photo_url, created_at')
    .eq('user_id', userId).order('created_at')
  if (error) return []
  return (data ?? []) as Pet[]
}

export async function uploadPetPhoto(file: File): Promise<string | null> {
  const [url] = await uploadCommunityImages([file], 'pets')
  return url ?? null
}

export async function createPet(name: string, kind: PetKind, photoUrl: string | null): Promise<Pet | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data, error } = await supabase
    .from('pets').insert({ user_id: session.user.id, name: name.trim(), kind, photo_url: photoUrl })
    .select('id, user_id, name, kind, photo_url, created_at').single()
  if (error) return null
  return data as Pet
}

export async function updatePet(id: string, patch: { name: string; kind: PetKind; photo_url: string | null }): Promise<boolean> {
  const { error } = await supabase.from('pets').update({ ...patch, name: patch.name.trim(), updated_at: new Date().toISOString() }).eq('id', id)
  return !error
}

export async function deletePet(id: string): Promise<boolean> {
  const { error } = await supabase.from('pets').delete().eq('id', id)
  return !error
}
