export default function PhoneLiveBar() {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-[#111]">
      <div className="flex items-center gap-2">
        <span className="bg-gold text-white text-[8px] font-bold px-1.5 py-0.5 rounded-sm">LIVE</span>
        <span className="text-white text-[10px] font-medium">설화수 공식 BA</span>
      </div>
      <span className="text-[#888] text-[9px]">👁 3,243명</span>
    </div>
  )
}
