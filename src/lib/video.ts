// 영상 압축 — 브라우저 안에서 다시 인코딩한다. (2026-09-11)
// 대표님: "압축하는 방법도 있잖아" — 서버(ffmpeg)를 두지 않고, 올리기 전에 폰/PC 브라우저가
// 영상을 재생하면서 캔버스로 받아 MediaRecorder 로 다시 녹화한다(긴 변 1280px, 2Mbps).
// 60초 영상이면 60초쯤 걸린다(실시간 재생) — 그래서 PostComposer 가 진행률을 보여준다.
// 실패하거나 브라우저가 못 하면 원본을 그대로 쓴다(막지 않는다).

export const COMPRESS_MAX_EDGE = 1280
export const COMPRESS_VIDEO_BPS = 2_000_000
export const COMPRESS_AUDIO_BPS = 96_000

const MIME_PREFERENCE = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']

export interface VideoMeta { duration: number; width: number; height: number }

export function probeVideo(file: File): Promise<VideoMeta | null> {
  return new Promise((resolve) => {
    const v = document.createElement('video')
    const url = URL.createObjectURL(file)
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      const meta = { duration: v.duration, width: v.videoWidth, height: v.videoHeight }
      URL.revokeObjectURL(url); resolve(meta)
    }
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    v.src = url
  })
}

export function canCompressVideo(): boolean {
  return typeof MediaRecorder !== 'undefined'
    && typeof HTMLCanvasElement !== 'undefined'
    && 'captureStream' in HTMLCanvasElement.prototype
    && MIME_PREFERENCE.some((m) => MediaRecorder.isTypeSupported(m))
}

// 줄일 필요가 있나 — 크거나(8MB 넘음) 해상도가 높으면(긴 변 1280 초과)
export function shouldCompress(file: File, meta: VideoMeta): boolean {
  return file.size > 8 * 1024 * 1024 || Math.max(meta.width, meta.height) > COMPRESS_MAX_EDGE
}

export async function compressVideo(file: File, onProgress?: (ratio: number) => void): Promise<File> {
  if (!canCompressVideo()) return file
  const mime = MIME_PREFERENCE.find((m) => MediaRecorder.isTypeSupported(m))!
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'

  let audioCtx: AudioContext | null = null
  let raf = 0
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('영상을 읽지 못했어요'))
    })

    const scale = Math.min(1, COMPRESS_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight))
    const w = Math.max(2, Math.round((video.videoWidth * scale) / 2) * 2)
    const h = Math.max(2, Math.round((video.videoHeight * scale) / 2) * 2)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    const stream = canvas.captureStream(30)
    // 소리 — 스피커로 내보내지 않고 녹화 스트림에만 붙인다
    try {
      audioCtx = new AudioContext()
      const src = audioCtx.createMediaElementSource(video)
      const dest = audioCtx.createMediaStreamDestination()
      src.connect(dest)
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t))
    } catch { /* 소리를 못 붙이면 영상만 */ }

    const rec = new MediaRecorder(stream, {
      mimeType: mime, videoBitsPerSecond: COMPRESS_VIDEO_BPS, audioBitsPerSecond: COMPRESS_AUDIO_BPS,
    })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
    const stopped = new Promise<void>((resolve) => { rec.onstop = () => resolve() })

    const draw = () => {
      ctx.drawImage(video, 0, 0, w, h)
      if (video.duration > 0) onProgress?.(Math.min(1, video.currentTime / video.duration))
      raf = requestAnimationFrame(draw)
    }

    rec.start(500)
    try {
      await video.play()
    } catch {
      // 소리 있는 자동재생이 막히면 음소거로 다시(소리는 빠진다)
      video.muted = true
      await video.play()
    }
    draw()
    await new Promise<void>((resolve) => { video.onended = () => resolve() })
    cancelAnimationFrame(raf)
    ctx.drawImage(video, 0, 0, w, h)
    rec.stop()
    await stopped

    const type = mime.split(';')[0]
    const blob = new Blob(chunks, { type })
    const ext = type === 'video/mp4' ? 'mp4' : 'webm'
    const base = file.name.replace(/\.[^.]+$/, '') || 'video'
    const out = new File([blob], `${base}_light.${ext}`, { type })
    onProgress?.(1)
    // 줄인 게 더 크면(이미 작은 영상) 원본을 쓴다
    return out.size > 0 && out.size < file.size ? out : file
  } catch {
    return file
  } finally {
    cancelAnimationFrame(raf)
    URL.revokeObjectURL(url)
    void audioCtx?.close().catch(() => undefined)
  }
}
