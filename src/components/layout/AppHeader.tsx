import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconSearch, IconUser } from '../common/Icon'
import { supabase } from '../../lib/supabase'

// 소비자 앱 공통 상단바: 로그인 시 "환영합니다, {이름}님" 인사말, 비로그인 시 워드마크(뷰티그라운드).
// 우측은 돋보기(검색 진입) 하나만 — 찜·장바구니는 하단 탭으로 옮겨졌다. 카테고리 탐색은
// 하단 탭 "카테고리"에 이미 있어서, 돋보기는 진짜 키워드 검색(/app/search)으로 분리(2026-08-10).
// 온라인몰과 라이브커머스를 당분간 분리하기로 해(대표님 지시 2026-07-29) 로고 이미지와
// "LIVE COMMERCE" 영문 표기를 뺐다 — 이 화면은 라이브 얘기를 하지 않는다.
interface Props {
  // PromoBar(높이 34px)가 바로 위에 스크롤 고정되어 있으면, 그만큼 아래로 내려 붙는다.
  promoBarAbove?: boolean
}

export default function AppHeader({ promoBarAbove = false }: Props) {
  const [name, setName] = useState<string | null>(null)
  // 2026-09-10 임시 하드코딩(7321) → 2026-09-13 대표님 지시 "7,321명을 기준으로 앞으로
  // 회원가입이 되면 카운트 늘려나가라"로 전환. get_member_count() RPC = 7321 + (2026-09-13 이후 실제 가입자 수).
  // 기준값을 초기 state로 둬서, RPC 응답 전에도 깜빡임 없이 바로 보인다.
  const [followerCount, setFollowerCount] = useState(7321)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const authUser = data.user
      if (!authUser) return
      const meta = authUser.user_metadata as { name?: string } | undefined
      setName(meta?.name || authUser.email?.split('@')[0] || null)
    })
    supabase.rpc('get_member_count').then(({ data, error }) => {
      if (active && !error && typeof data === 'number') setFollowerCount(data)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <header
      className={`bg-paper flex items-center justify-between px-4 h-14 border-b border-rule sticky z-50 ${
        promoBarAbove ? 'top-[34px]' : 'top-0'
      }`}
    >
      <Link to="/app/home" className="flex items-center min-w-0">
        {name ? (
          <span className="font-sans text-[16px] font-bold text-ink tracking-[-0.01em] truncate">
            환영합니다, {name}님
          </span>
        ) : (
          <img src="/images/logo-gold.png" alt="뷰티그라운드" className="h-8 w-auto object-contain" />
        )}
      </Link>
      <div className="flex items-center gap-3">
        {/* 팔로워 수 — 색 이모지 대신 사람 하나 외곽선 아이콘(2026-09-11 대표님 "색상 말고 사람 하나만 외곽선으로") */}
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft tracking-[-0.01em] whitespace-nowrap">
          {followerCount.toLocaleString()}명
          <IconUser className="w-[15px] h-[15px]" />
        </span>
        <Link
          to="/app/search"
          aria-label="검색"
          className="w-10 h-10 rounded-pill border border-rule flex items-center justify-center text-ink focus:outline-none focus-visible:shadow-ring"
        >
          <IconSearch className="w-[18px] h-[18px]" />
        </Link>
      </div>
    </header>
  )
}
