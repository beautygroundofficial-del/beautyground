import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconSearch } from '../common/Icon'
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
  // TODO: 테스트용 임의값 — 실제 팔로워 집계 연결 전까지 하드코딩(대표님 지시 2026-09-10)
  const followerCount = 7321

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const authUser = data.user
      if (!authUser) return
      const meta = authUser.user_metadata as { name?: string } | undefined
      setName(meta?.name || authUser.email?.split('@')[0] || null)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <header
      className={`bg-paper flex items-center justify-between px-4 py-2 min-h-14 border-b border-rule sticky z-50 ${
        promoBarAbove ? 'top-[34px]' : 'top-0'
      }`}
    >
      <Link to="/app/home" className="flex flex-col justify-center min-w-0 gap-0.5">
        {name ? (
          <span className="font-sans text-[16px] font-bold text-ink tracking-[-0.01em] truncate">
            환영합니다, {name}님
          </span>
        ) : (
          <img src="/images/logo-gold.png" alt="뷰티그라운드" className="h-8 w-auto object-contain" />
        )}
        <span className="text-[11px] font-medium text-ink-soft tracking-[-0.01em]">
          {followerCount.toLocaleString()}명 👥
        </span>
      </Link>
      <Link
        to="/app/search"
        aria-label="검색"
        className="w-10 h-10 rounded-pill border border-rule flex items-center justify-center text-ink focus:outline-none focus-visible:shadow-ring"
      >
        <IconSearch className="w-[18px] h-[18px]" />
      </Link>
    </header>
  )
}
