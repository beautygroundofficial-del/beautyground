import { IconHeart, IconMessage, IconShare } from '@tabler/icons-react'

interface PhoneVideoAreaProps {
  src?: string
  visible?: boolean
}

export default function PhoneVideoArea({ src, visible = true }: PhoneVideoAreaProps) {
  return (
    <div className="relative bg-[#1c1c1c] h-[150px] overflow-hidden">
      {src && (
        <img
          src={src}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            animation: 'nolling 8s ease-in-out infinite',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease',
          }}
        />
      )}

      {/* LIVE 뱃지 */}
      <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-white text-[8px] font-bold tracking-wide">LIVE</span>
      </div>

      {/* 상호작용 아이콘 */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2.5">
        <div className="flex flex-col items-center gap-0.5">
          <IconHeart size={13} color="white" />
          <span className="text-[7px] text-white/80">1.2만</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <IconMessage size={13} color="white" />
          <span className="text-[7px] text-white/80">344</span>
        </div>
        <IconShare size={13} color="white" />
      </div>
    </div>
  )
}
