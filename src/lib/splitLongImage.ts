import { supabase } from './supabase'

/**
 * 긴 이미지 File 1개를 canvas로 세로 조각으로 나눠 webp로 Storage에 업로드하고
 * 공개 URL 배열(위→아래 순서)을 반환한다.
 *
 * @param file      - 원본 이미지 파일
 * @param keyPrefix - Storage 경로 접두사 (예: `${partnerId}/detail_${Date.now()}`)
 * @param onProgress - (done, total) 콜백
 */
export async function splitAndUploadLongImage(
  file: File,
  keyPrefix: string,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const bitmap = await createImageBitmap(file)

  const MAX_W = 1080
  const scale = Math.min(1, MAX_W / bitmap.width)
  const W = Math.round(bitmap.width * scale)
  const H = Math.round(bitmap.height * scale)

  const SLICE_H = 1500
  const count = Math.ceil(H / SLICE_H)
  const urls: string[] = []

  for (let i = 0; i < count; i++) {
    const destH = Math.min(SLICE_H, H - i * SLICE_H)
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = destH
    const ctx = canvas.getContext('2d')!

    ctx.drawImage(
      bitmap,
      0, (i * SLICE_H) / scale, bitmap.width, destH / scale,
      0, 0, W, destH
    )

    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/webp', 0.8)
    )

    const path = `${keyPrefix}/detail_${String(i).padStart(2, '0')}.webp`
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, blob, { upsert: true, contentType: 'image/webp' })

    if (error) throw error

    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    urls.push(data.publicUrl)

    onProgress?.(i + 1, count)
  }

  bitmap.close()
  return urls
}
