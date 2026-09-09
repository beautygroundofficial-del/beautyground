import { useNavigate } from 'react-router-dom'
import { IconBack } from '../common/Icon'

interface BackHeaderProps {
  title?: string
  rightElement?: React.ReactNode
  onBack?: () => void
  transparent?: boolean
}

export default function BackHeader({ title, rightElement, onBack, transparent = false }: BackHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <header
      className={`flex items-center justify-between px-4 py-3 h-14 sticky top-0 z-50 ${
        transparent ? 'bg-transparent' : 'bg-paper border-b border-rule'
      }`}
    >
      <button
        onClick={handleBack}
        className="w-9 h-9 flex items-center justify-center text-ink focus:outline-none focus-visible:shadow-ring"
        aria-label="뒤로 가기"
      >
        <IconBack className="w-[22px] h-[22px]" />
      </button>
      {title && (
        <h1 className="text-[16px] font-bold text-ink absolute left-1/2 -translate-x-1/2">
          {title}
        </h1>
      )}
      <div className="min-w-9 flex justify-end whitespace-nowrap">
        {rightElement}
      </div>
    </header>
  )
}
