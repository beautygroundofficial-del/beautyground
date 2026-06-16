const CHATS = [
  { nick: '뷰티러버', msg: '피부에 너무 잘 맞아요 💕' },
  { nick: 'BA이지현', msg: '지금 10% 특가 진행 중이에요!', isHost: true },
  { nick: '30대주부', msg: '재구매 결정했어요 ✨' },
]

export default function PhoneChat() {
  return (
    <>
      <div className="bg-[#f9f8f6] px-3 py-2 space-y-1">
        {CHATS.map(({ nick, msg, isHost }) => (
          <p key={nick} className="text-[10px]">
            <span className={`font-bold mr-1 ${isHost ? 'text-gold' : 'text-[#888]'}`}>{nick}</span>
            <span className="text-[#444]">{msg}</span>
          </p>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-t border-[0.5px] border-[#eee]">
        <div className="flex-1 bg-[#f4f2f0] rounded-full px-3 py-1.5 text-[9px] text-[#bbb]">
          채팅 입력...
        </div>
        <span className="text-gold text-sm" aria-hidden="true">↑</span>
      </div>
    </>
  )
}
