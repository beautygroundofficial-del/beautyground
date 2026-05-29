export default function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 260, height: 520 }}>
      {/* 폰 외형 */}
      <div
        className="absolute inset-0 rounded-[40px] border-[6px] border-white/15 overflow-hidden"
        style={{ backgroundColor: '#1a1710' }}
      >
        {/* 노치 */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-full z-10" aria-hidden="true" />

        {/* 라이브 화면 미리보기 */}
        <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#2a1a2e' }}>
          {/* 상단 호스트 정보 */}
          <div className="flex items-center gap-2 px-4 pt-10 pb-3">
            <div className="w-8 h-8 rounded-full bg-[#993556] flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
              설
            </div>
            <div>
              <p className="text-white text-[11px] font-medium">설화수 공식 BA</p>
              <p className="text-white/60 text-[10px]">현대백화점관</p>
            </div>
            <div className="ml-auto bg-[#FF4757] text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
              LIVE
            </div>
          </div>

          {/* 중앙 아이콘 */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-6xl opacity-30" aria-hidden="true">💄</div>
          </div>

          {/* 채팅 영역 */}
          <div className="px-3 pb-2 space-y-1">
            {[
              { user: '뷰티러버', msg: '피부에 너무 잘 맞아요 💕' },
              { user: '스킨케어queen', msg: '가격이 어떻게 되나요?' },
              { user: '30대주부', msg: '쿠폰 쓸 수 있나요?' },
            ].map(({ user, msg }) => (
              <p key={user} className="text-[10px] text-white/70">
                <span className="text-gold font-medium">{user}</span>{' '}
                {msg}
              </p>
            ))}
          </div>

          {/* 상품 하단 바 */}
          <div className="mx-3 mb-4 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 flex items-center justify-between border border-white/10">
            <div>
              <p className="text-white/80 text-[10px]">자음생 에센스 크림 60ml</p>
              <p className="text-gold text-[12px] font-bold">320,000원</p>
            </div>
            <div className="bg-gold text-white text-[10px] font-semibold rounded-full px-2.5 py-1">
              구매
            </div>
          </div>
        </div>
      </div>

      {/* 측면 버튼 */}
      <div
        className="absolute right-[-8px] top-24 w-[5px] h-10 rounded-r-full"
        style={{ backgroundColor: '#333' }}
        aria-hidden="true"
      />
      <div
        className="absolute left-[-8px] top-20 w-[5px] h-8 rounded-l-full"
        style={{ backgroundColor: '#333' }}
        aria-hidden="true"
      />
    </div>
  )
}
