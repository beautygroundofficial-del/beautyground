import { useNavigate } from 'react-router-dom'
import { IconBack } from '../common/Icon'

interface BackHeaderProps {
  title?: string
  rightElement?: React.ReactNode
  onBack?: () => void
  transparent?: boolean
  // PromoBar(높이 34px)가 바로 위에 스크롤 고정되어 있으면, 그만큼 아래로 내려 붙는다.
  promoBarAbove?: boolean
}

export default function BackHeader({
  title,
  rightElement,
  onBack,
  transparent = false,
  promoBarAbove = false,
}: BackHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <header
      className={`flex items-center justify-between px-4 py-3 h-14 sticky z-50 ${
        promoBarAbove ? 'top-[34px]' : 'top-0'
      } ${transparent ? 'bg-transparent' : 'bg-paper border-b border-rule'}`}
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
      <div className="w-9 flex justify-end">
        {rightElement}
      </div>
    </header>
  )
}
