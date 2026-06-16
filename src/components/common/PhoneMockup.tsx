import PhoneLiveBar from '../phone/PhoneLiveBar'
import PhoneVideoArea from '../phone/PhoneVideoArea'
import PhoneCoupon from '../phone/PhoneCoupon'
import PhoneChat from '../phone/PhoneChat'

interface PhoneMockupProps {
  width?: number
  imageSrc?: string
  imageVisible?: boolean
}

export default function PhoneMockup({ width = 220, imageSrc, imageVisible = true }: PhoneMockupProps) {
  return (
    <div
      className="relative rounded-[36px] border-[7px] border-white overflow-hidden bg-white flex-shrink-0"
      style={{ width }}
      role="img"
      aria-label="뷰티관 앱 라이브 화면 미리보기"
    >
      {/* 노치 */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-[#111] rounded-full z-10" aria-hidden="true" />
      <div className="pt-6 flex flex-col">
        <PhoneLiveBar />
        <PhoneVideoArea src={imageSrc} visible={imageVisible} />
        <PhoneCoupon />
        <PhoneChat />
      </div>
    </div>
  )
}
