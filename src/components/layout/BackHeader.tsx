import { useNavigate } from 'react-router-dom'

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
        transparent ? 'bg-transparent' : 'bg-white border-b border-cream-2'
      }`}
    >
      <button
        onClick={handleBack}
        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-cream-2 transition-colors"
        aria-label="뒤로 가기"
      >
        <span className="text-lg" aria-hidden="true">←</span>
      </button>
      {title && (
        <h1 className="text-[16px] font-bold text-text absolute left-1/2 -translate-x-1/2">
          {title}
        </h1>
      )}
      <div className="w-9 flex justify-end">
        {rightElement}
      </div>
    </header>
  )
}
