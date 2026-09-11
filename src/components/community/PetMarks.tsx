import { petEmoji, type DiaryPet } from '../../lib/pets'

// 카드에 붙는 펫 표시 — 닉네임 옆 작은 얼굴(사진 없으면 종류 이모지), 걸음 수 옆 "초코와". (2026-09-12)
// 숫자·등수는 붙이지 않는다. 그냥 "이 사람은 이 친구와 산다"가 보이면 된다.

export function PetAvatars({ pets, size = 20 }: { pets: DiaryPet[] | undefined; size?: number }) {
  if (!pets || pets.length === 0) return null
  return (
    <span className="inline-flex items-center -space-x-1.5 shrink-0" aria-label={`함께한 친구 ${pets.map((p) => p.name).join(', ')}`}>
      {pets.slice(0, 3).map((p) => (
        p.photo_url ? (
          <img key={p.id} src={p.photo_url} alt="" width={size} height={size}
            className="rounded-full object-cover border-2 border-paper bg-quiet" style={{ width: size, height: size }} />
        ) : (
          <span key={p.id} className="rounded-full bg-quiet border-2 border-paper inline-flex items-center justify-center"
            style={{ width: size, height: size, fontSize: size * 0.55 }} aria-hidden="true">{petEmoji(p.kind)}</span>
        )
      ))}
    </span>
  )
}

// "🐾 초코와 3,200보" / "🐾 초코·보리와" — 걸음 수가 없으면 이름만
export function petWalkLabel(pets: DiaryPet[] | undefined, steps: number | null | undefined): string | null {
  if (!pets || pets.length === 0) return null
  const names = pets.map((p) => p.name).join('·')
  return steps && steps > 0 ? `${names}와 ${steps.toLocaleString('ko-KR')}보` : `${names}와 함께`
}
