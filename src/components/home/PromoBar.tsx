import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// 상단 프로모션 띠 — 대표님 확정 시안(2026-08-08) 두 개를 2초마다 교대 노출.
// ① 검정 바탕 + 카카오 노랑 아이콘: 적립금·카카오 친구추가 혜택
// ② 청록 바탕: 신규회원 48시간 반값 찬스
// 두 항목 모두 /app/benefits(혜택 페이지)로 연결 — 로그인 여부와 무관하게 눌러서 들어가면
// 회원가입 적립금·카카오 친구추가 혜택이 전부 보이고 그 자리에서 받을 수 있다(2026-08-08 대표님 지시).
const ROTATE_MS = 2000

interface PromoItem {
  key: string
  message: string
  href: string
  bgClass: string
  withKakao?: boolean
}

const ITEMS: PromoItem[] = [
  {
    key: 'kakao',
    message: '적립금 받기 + 카카오 친구추가 혜택 보러가기',
    href: '/app/benefits',
    bgClass: 'bg-[#0F0F0F]',
    withKakao: true,
  },
  {
    key: 'signup',
    message: '회원가입하면, 단 48시간! 신규회원 혜택 반값 찬스♥',
    href: '/app/signup',
    bgClass: 'bg-[#2E8B7E]',
  },
]

// 카카오톡 말풍선 심볼 — 노랑 원형 배지 안에 다크브라운 심볼 (카카오 브랜드 고유색이라 팔레트 예외)
function KakaoBadge() {
  return (
    <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#FEE500] shrink-0">
      <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#3C1E1E"
          d="M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.66 1.79 5 4.5 6.34-.2.72-.72 2.62-.82 3.03-.13.5.18.5.39.36.16-.11 2.53-1.72 3.56-2.42.44.06.9.09 1.37.09 5.25 0 9.5-3.36 9.5-7.5S17.25 3.5 12 3.5Z"
        />
      </svg>
    </span>
  )
}

export default function PromoBar() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % ITEMS.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [])

  const item = ITEMS[idx]

  return (
    <Link
      to={item.href}
      className={`sticky top-0 z-50 flex items-center justify-center gap-2 h-[34px] px-4 overflow-hidden transition-colors duration-300 ${item.bgClass}`}
      aria-label={item.message}
    >
      <span key={item.key} className="flex items-center gap-2 text-[12.5px] font-bold text-white animate-fade-in">
        {item.withKakao && <KakaoBadge />}
        <span className="text-center truncate">{item.message}</span>
        <span className="flex items-center gap-1 ml-1" aria-hidden="true">
          {ITEMS.map((it) => (
            <span
              key={it.key}
              className={`w-1 h-1 rounded-full ${it.key === item.key ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </span>
      </span>
    </Link>
  )
}
