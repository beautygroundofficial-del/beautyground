import { appleLoginEnabled } from '../../lib/appleAuth'

// Apple 공식 버튼 규격(검정 배경 + 흰 로고·텍스트, 모서리·높이는 우리 버튼과 통일). VITE_APPLE_LOGIN=1 일 때만 렌더.
// 로고 path는 Apple 최신 워드마크 글리프(2026-10-09 갱신 — 기존 path는 16px 기준이라 24px 박스에서 작고 성기게 보였음).
const APPLE_GLYPH_PATH =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.41-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zm3.391-3.104c.832-1.013 1.388-2.42 1.235-3.828-1.197.052-2.645.805-3.51 1.818-.762.89-1.434 2.323-1.255 3.683 1.336.104 2.698-.68 3.53-1.673z'

interface Props {
  onClick: () => void
  disabled?: boolean
  label?: string
  size?: 'lg' | 'md' | 'icon'
}

export default function AppleSignInButton({ onClick, disabled = false, label = 'Apple로 시작하기', size = 'lg' }: Props) {
  if (!appleLoginEnabled()) return null

  if (size === 'icon') {
    // 카카오·네이버와 짝맞춘 동그란 아이콘 버튼(2026-10-09, "꽉 찬 느낌" 해소 — 바 3개 → 아이콘 한 줄)
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="flex flex-col items-center gap-1.5 focus:outline-none disabled:opacity-40"
      >
        <span
          className="w-16 h-16 rounded-full flex items-center justify-center focus-visible:shadow-ring"
          style={{ backgroundColor: '#000' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" d={APPLE_GLYPH_PATH} />
          </svg>
        </span>
        <span className="text-[11.5px] text-ink-soft">Apple</span>
      </button>
    )
  }

  const cls = size === 'lg'
    ? 'w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 text-paper focus:outline-none focus-visible:shadow-ring disabled:opacity-40'
    : 'w-full flex items-center justify-center gap-2 rounded-control font-bold text-[15px] py-3.5 text-paper focus:outline-none focus-visible:shadow-ring disabled:opacity-40'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} style={{ backgroundColor: '#000' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#fff" d={APPLE_GLYPH_PATH} />
      </svg>
      {label}
    </button>
  )
}
