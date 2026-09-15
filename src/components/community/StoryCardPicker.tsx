import { useMemo, useRef, useState } from 'react'

// 사진 대신 "카드로 남기기" — 사진 올리기 부담스러운 날에도 글을 남길 수 있게.
// 2026-09-15 대표님 지시("무료 섬네일 가져다 써서 팀원들 글 넣어 만들어") 실행.
// 일러스트 출처: unDraw(undraw.co) — 라이선스 확인 완료(undraw.co/license 원문):
// "You do not need to ask permission from or provide credit to the creator or unDraw."
// 출처 표기 의무 없음·무료·상업적 이용 가능. public/story-cards/*.svg 로 자산만 가져옴(원본 그대로 재배포 아님).
const TEMPLATES = [
  { key: 'family', label: '육아', file: 'family.svg' },
  { key: 'couple', label: '부부', file: 'couple.svg' },
  { key: 'grandma', label: '부모님', file: 'grandma.svg' },
  { key: 'jogging', label: '건강', file: 'jogging.svg' },
  { key: 'relax', label: '갱년기', file: 'relax.svg' },
  { key: 'confident', label: '피부', file: 'confident.svg' },
  { key: 'meditating', label: '마음', file: 'meditating.svg' },
  { key: 'cleanup', label: '살림', file: 'cleanup.svg' },
  { key: 'savings', label: '절약', file: 'savings.svg' },
  { key: 'coffee', label: '잡담', file: 'coffee.svg' },
] as const

const CARD_W = 800
const CARD_H = 1422 // 1080:1920 비율 유지

interface Props {
  onGenerate: (file: File) => void
  onCancel: () => void
}

export default function StoryCardPicker({ onGenerate, onCancel }: Props) {
  const [selected, setSelected] = useState<(typeof TEMPLATES)[number]>(TEMPLATES[0])
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const wrapped = useMemo(() => wrapLines(caption, 14), [caption])

  const make = async () => {
    if (!caption.trim()) return
    setBusy(true)
    try {
      const canvas = canvasRef.current!
      canvas.width = CARD_W
      canvas.height = CARD_H
      const ctx = canvas.getContext('2d')!

      // 배경 — 종이톤
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, CARD_W, CARD_H)
      ctx.strokeStyle = '#E3E5E9'
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, CARD_W - 2, CARD_H - 2)

      // 일러스트
      const img = new Image()
      img.src = `/story-cards/${selected.file}`
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject })
      const maxW = CARD_W * 0.72
      const maxH = CARD_H * 0.4
      const scale = Math.min(maxW / img.width, maxH / img.height)
      const iw = img.width * scale
      const ih = img.height * scale
      ctx.drawImage(img, (CARD_W - iw) / 2, CARD_H * 0.14, iw, ih)

      // 카테고리 라벨
      ctx.fillStyle = '#8E9199'
      ctx.font = '600 22px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(selected.label.toUpperCase(), CARD_W / 2, CARD_H * 0.58)

      // 캡션(직접 입력한 글)
      ctx.fillStyle = '#1a1e36'
      ctx.font = '700 34px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'
      ctx.textAlign = 'center'
      const lineHeight = 50
      const startY = CARD_H * 0.66
      wrapped.forEach((line, i) => ctx.fillText(line, CARD_W / 2, startY + i * lineHeight))

      // 브랜드 워터마크
      ctx.fillStyle = '#8E9199'
      ctx.font = '500 18px "Malgun Gothic","Apple SD Gothic Neo",sans-serif'
      ctx.fillText('BEAUTY GROUND · 이야기', CARD_W / 2, CARD_H - 40)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.92))
      if (!blob) return
      onGenerate(new File([blob], `story-card-${Date.now()}.png`, { type: 'image/png' }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-card border border-rule bg-paper p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13.5px] font-bold text-ink">카드로 남기기</h3>
        <button type="button" onClick={onCancel} className="text-[12px] text-ink-faint focus:outline-none focus-visible:shadow-ring">취소</button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSelected(t)}
            aria-pressed={selected.key === t.key}
            className={`shrink-0 w-16 flex flex-col items-center gap-1 rounded-lg border px-2 py-2 focus:outline-none focus-visible:shadow-ring ${
              selected.key === t.key ? 'border-ink bg-quiet' : 'border-rule bg-paper'}`}
          >
            <img src={`/story-cards/${t.file}`} alt={t.label} className="w-10 h-10 object-contain" />
            <span className="text-[10.5px] text-ink-soft">{t.label}</span>
          </button>
        ))}
      </div>

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 60))}
        placeholder="카드에 넣을 한두 줄을 적어주세요"
        rows={2}
        className="w-full mt-3 resize-none text-[14px] leading-[1.7] text-ink placeholder:text-ink-faint border border-rule rounded-lg px-3 py-2 focus:outline-none focus-visible:shadow-ring"
      />
      <p className="text-[11px] text-ink-faint mt-1 text-right">{caption.length}/60</p>

      <button
        type="button"
        onClick={() => void make()}
        disabled={!caption.trim() || busy}
        className="w-full mt-2 py-2.5 rounded-control bg-ink text-paper text-[13.5px] font-semibold disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
      >
        {busy ? '만드는 중…' : '카드 만들기'}
      </button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

function wrapLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxCharsPerLine && cur) { lines.push(cur); cur = w } else { cur = next }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 4)
}
