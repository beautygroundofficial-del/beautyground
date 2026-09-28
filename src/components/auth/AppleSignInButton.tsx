import { appleLoginEnabled } from '../../lib/appleAuth'

// Apple 공식 버튼 규격(검정 배경 + 흰 로고·텍스트, 모서리·높이는 우리 버튼과 통일). VITE_APPLE_LOGIN=1 일 때만 렌더.
interface Props {
  onClick: () => void
  disabled?: boolean
  label?: string
  size?: 'lg' | 'md'
}

export default function AppleSignInButton({ onClick, disabled = false, label = 'Apple로 시작하기', size = 'lg' }: Props) {
  if (!appleLoginEnabled()) return null
  const cls = size === 'lg'
    ? 'w-full flex items-center justify-center gap-2 rounded-control font-bold text-[16px] py-4 text-paper focus:outline-none focus-visible:shadow-ring disabled:opacity-40'
    : 'w-full flex items-center justify-center gap-2 rounded-control font-bold text-[15px] py-3.5 text-paper focus:outline-none focus-visible:shadow-ring disabled:opacity-40'
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} style={{ backgroundColor: '#000' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#fff" d="M16.37 12.64c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.71-3.19-1.73-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.63 1.11 8.8.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.19-.02 1.94-1.08 2.66-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.29-3.55zM14.18 6.16c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.69-.92 2.68.97.08 1.96-.49 2.56-1.23z" />
      </svg>
      {label}
    </button>
  )
}
