import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import BottomNav from '../components/layout/BottomNav'
import Badge from '../components/common/Badge'
import { ALL_LIVE_STREAMS } from '../constants'

const TABS = ['전체', '라이브 중', '예정']

export default function AppLiveList() {
  const [tab, setTab] = useState(0)
  const navigate = useNavigate()

  const filtered = ALL_LIVE_STREAMS.filter((s) => {
    if (tab === 1) return s.isLive
    if (tab === 2) return !s.isLive
    return true
  })

  return (
    <div className="min-h-screen bg-cream-4 pb-20">
      <AppHeader />

      {/* 탭 */}
      <div className="bg-white border-b border-cream-2 flex">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 py-3 text-[14px] font-medium transition-colors relative ${
              tab === i ? 'text-text' : 'text-text-hint'
            }`}
            aria-pressed={tab === i}
          >
            {t}
            {tab === i && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      {/* 섹션 헤더 */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <h1 className="text-[15px] font-bold text-text">
          {tab === 1 ? '진행 중인 라이브' : tab === 2 ? '예정된 라이브' : '전체 라이브'}
        </h1>
        {tab !== 2 && (
          <>
            <span className="w-2 h-2 bg-[#FF4757] rounded-full animate-pulse" aria-hidden="true" />
            <span className="text-[12px] text-text-sub">
              {ALL_LIVE_STREAMS.filter(s => s.isLive).length}개 진행중
            </span>
          </>
        )}
      </div>

      <div className="px-4 flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-text-hint text-[14px]">
            해당하는 라이브가 없습니다.
          </div>
        )}
        {filtered.map((stream) => (
          <button
            key={stream.id}
            onClick={() => navigate(`/app/live/${stream.id}`)}
            className="bg-white rounded-md overflow-hidden border border-cream-2 text-left w-full hover:border-gold/30 transition-colors focus:outline-none focus:shadow-focus"
            aria-label={`${stream.brand} 라이브 방송`}
          >
            {/* 썸네일 */}
            <div
              className="relative h-[160px] flex items-center justify-center"
              style={{ backgroundColor: stream.bgColor }}
            >
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 50%)' }}
                aria-hidden="true"
              />
              <span className="text-7xl opacity-40" aria-hidden="true">💄</span>

              <div className="absolute top-3 left-3 flex items-center gap-2">
                {stream.isLive ? (
                  <Badge type="live" label="LIVE" />
                ) : (
                  <span className="bg-black/50 text-white text-[10px] font-medium px-2 py-0.5 rounded-pill">
                    예정 {stream.scheduledAt}
                  </span>
                )}
              </div>

              {stream.isLive && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/40 rounded-pill px-2 py-1">
                  <span className="text-white/80 text-[10px]" aria-hidden="true">👁</span>
                  <span className="text-white text-[11px]">{stream.viewers.toLocaleString()}</span>
                </div>
              )}

              {/* 하단 상품정보 */}
              <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 z-10">
                <p className="text-white/90 text-[12px] truncate">{stream.productName}</p>
                <p className="text-gold text-[14px] font-bold">{stream.price.toLocaleString('ko-KR')}원</p>
              </div>
            </div>

            {/* 호스트 정보 */}
            <div className="px-3 py-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                style={{ backgroundColor: stream.avatarColor }}
                aria-hidden="true"
              >
                {stream.avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-text truncate">{stream.hostName}</p>
                <p className="text-[11px] text-text-sub">{stream.deptName}</p>
              </div>
              <Badge type="dept" label={stream.deptName} deptKey={stream.deptKey} />
            </div>
          </button>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
