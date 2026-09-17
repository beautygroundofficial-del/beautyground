import { supabase } from './supabase'
import type { Partner } from './types'

// 현재 로그인한 사용자의 브랜드(partner) 레코드 조회 (없으면 null)
// user id 는 getSession()(로컬 세션, 네트워크 없음)으로 얻는다 — getUser()는 매번 네트워크
// 검증이라 동시 호출 시 일시적으로 null이 떨어지는 문제가 있다(host.ts의 getMyHost()와 동일 이유).
//
// overridePartnerId — 관리자가 "이 브랜드로 보기"를 눌러 다른 브랜드의 판매자 센터를 조회할 때만
// 쓴다(2026-09-18). partners RLS가 이미 is_admin()이면 아무 행이나 SELECT 허용하므로(admin_ops.sql),
// 관리자가 아닌 사람이 남의 id를 넘겨도 RLS가 빈 결과로 막아준다 — 여기서 별도 권한 체크 불필요.
export async function getMyPartner(overridePartnerId?: string): Promise<Partner | null> {
  if (overridePartnerId) {
    const { data } = await supabase.from('partners').select('*').eq('id', overridePartnerId).maybeSingle()
    if (data) return data as Partner
    // 권한 없거나 존재하지 않는 id면 본인 브랜드로 폴백
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return null

  const { data } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return (data as Partner | null) ?? null
}

// /brand/export 전용 — 판매 파트너 계정과 수출 전용 계정(export_contacts,
// supabase/export_contacts.sql) 둘 다 지원. 판매 파트너면 기존처럼 partners 테이블을 직접
// 읽고(빠름), 아니라면 get_my_export_partner() RPC로 export_contacts를 경유해 조회한다.
// 대시보드/판매내역/정산내역은 여전히 getMyPartner()만 쓰므로 수출 전용 계정에서는 열리지 않는다.
export async function getMyBrandAccess(overridePartnerId?: string): Promise<{ partner: Partner | null; isExportOnly: boolean }> {
  if (overridePartnerId) {
    const { data } = await supabase.from('partners').select('*').eq('id', overridePartnerId).maybeSingle()
    if (data) return { partner: data as Partner, isExportOnly: false }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const userId = session?.user?.id
  if (!userId) return { partner: null, isExportOnly: false }

  const { data: fullPartner } = await supabase.from('partners').select('*').eq('user_id', userId).maybeSingle()
  if (fullPartner) return { partner: fullPartner as Partner, isExportOnly: false }

  const { data: exportPartner } = await supabase.rpc('get_my_export_partner')
  if (exportPartner) return { partner: exportPartner as Partner, isExportOnly: true }

  return { partner: null, isExportOnly: false }
}

// 브랜드 본인의 수출 소개글+인증+수출국가+MOQ 저장 (update_my_partner_export_details RPC,
// supabase/partners_export_details.sql — update_my_partner_export_pitch를 대체)
export async function updateMyExportDetails(details: {
  pitch: string
  pitchEn: string
  certifications: string[]
  countries: string
  moqNotes: string
}): Promise<Partner> {
  const { data, error } = await supabase.rpc('update_my_partner_export_details', {
    p_pitch: details.pitch,
    p_pitch_en: details.pitchEn,
    p_certifications: details.certifications,
    p_countries: details.countries,
    p_moq_notes: details.moqNotes,
  })
  if (error) throw error
  return data as Partner
}

// 브랜드 본인 소유 상품의 "수출 대표상품" 표시 토글 (set_my_product_export_featured RPC,
// supabase/products_export_featured.sql)
export async function setMyProductExportFeatured(productId: string, featured: boolean) {
  const { error } = await supabase.rpc('set_my_product_export_featured', {
    p_product_id: productId,
    p_featured: featured,
  })
  if (error) throw error
}

// 수출용 상품 이미지/설명 저장 (update_my_product_export_content RPC, supabase/products_export_content.sql)
export async function updateMyProductExportContent(
  productId: string,
  imageUrls: string[],
  description: string,
  descriptionEn: string
) {
  const { error } = await supabase.rpc('update_my_product_export_content', {
    p_product_id: productId,
    p_image_urls: imageUrls,
    p_description: description,
    p_description_en: descriptionEn,
  })
  if (error) throw error
}

// 브랜드 BI 로고 저장 (update_my_partner_export_logo RPC, supabase/partners_export_logo.sql)
export async function updateMyExportLogo(logoUrl: string): Promise<Partner> {
  const { data, error } = await supabase.rpc('update_my_partner_export_logo', { p_logo_url: logoUrl })
  if (error) throw error
  return data as Partner
}

// 브랜드 스토리 사진(캡션 없음, 최대 5장) 저장 (update_my_partner_export_story_images RPC,
// supabase/partners_export_story_images.sql)
export async function updateMyExportStoryImages(images: string[]): Promise<Partner> {
  const { data, error } = await supabase.rpc('update_my_partner_export_story_images', { p_images: images })
  if (error) throw error
  return data as Partner
}

// 브라우저에서 이미지 1장을 줄여 webp 로 바꾼 뒤 product-images 버킷의 지정 경로에 올리고 공개 URL 반환.
// 경로 접두사(export/… · seller/…)별로 storage RLS 가 본인 partner_id 폴더만 허용한다.
async function uploadResizedImage(file: File, path: string, maxWidth: number): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/webp', 0.85))
  const { error } = await supabase.storage.from('product-images').upload(path, blob, {
    upsert: true,
    contentType: 'image/webp',
  })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

// 업로드 파일명 — 같은 시각에 여러 장을 올려도 겹치지 않게 난수를 붙인다.
function imageFileName(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`
}

// 수출용 이미지 1장을 product-images 버킷의 export/<partnerId>/... 경로에 업로드하고 공개 URL 반환.
// storage RLS가 이 경로 접두사만 본인 partner_id로 제한(products_export_content.sql).
export async function uploadExportImage(file: File, partnerId: string, folder: string): Promise<string> {
  return uploadResizedImage(file, `export/${partnerId}/${folder}/${imageFileName()}`, 1600)
}

// 셀러센터 상품 사진 1장을 seller/<partnerId>/<folder>/... 경로에 업로드하고 공개 URL 반환
// (folder: thumb=대표사진 · gallery=상품사진 · detail=상세이미지, supabase/brand_product_images.sql).
// 폭 1600px 은 수출용 이미지와 같은 기준 — 상세이미지의 작은 글씨도 읽히는 선.
export async function uploadSellerProductImage(
  file: File,
  partnerId: string,
  folder: 'thumb' | 'gallery' | 'detail',
): Promise<string> {
  return uploadResizedImage(file, `seller/${partnerId}/${folder}/${imageFileName()}`, 1600)
}

// 한글 텍스트를 영문으로 번역 (/api/translate, Gemini 사용 — 로그인 세션 토큰 필요)
export async function translateText(text: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('로그인이 필요합니다.')
  const r = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ text }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || !data.ok) throw new Error(data.reason || '번역에 실패했습니다.')
  return data.translated as string
}
