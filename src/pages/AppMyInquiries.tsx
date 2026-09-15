import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import { getMyInquiries, type MyInquiry } from '../lib/inquiries'
import ImagePlaceholder from '../components/common/ImagePlaceholder'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// "내 문의·리뷰 답변" — 2026-09-16 대표님 지시. 상품문의(product_questions)에 답이 달리거나
// 구매후기(product_reviews)에 브랜드/관리자 답변이 달려도, 그 상품 상세를 우연히 재방문해야만
// 발견할 수 있었던 알림 구멍을 메운다. 마이페이지에서 한 화면에 모아 보여준다.
export default function AppMyInquiries() {
  const navigate = useNavigate()
  const { mode, toggle } = useViewMode()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [items, setItems] = useState<MyInquiry[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { setLoggedIn(false); setLoading(false); return }
      const list = await getMyInquiries()
      if (!active) return
      setItems(list)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center text-ink-faint text-[14px]">불러오는 중...</div>
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <AppFrame>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <BackHeader title="내 문의·리뷰 답변" />
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <p className="text-[15px] text-ink-soft mb-6">로그인이 필요해요</p>
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/my-inquiries' } })}
            className="rounded-control bg-ink text-paper font-bold text-[14px] px-8 py-3 focus:outline-none focus-visible:shadow-ring"
          >
            로그인하기
          </button>
        </div>
      </AppFrame>
    )
  }

  return (
    <AppFrame>
      <ViewModeToggle mode={mode} onToggle={toggle} />
      <BackHeader title="내 문의·리뷰 답변" />

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <p className="text-[14px] text-ink-soft">아직 남긴 문의나 리뷰가 없어요</p>
        </div>
      ) : (
        <div className="px-4 pt-4">
          <div className="border border-rule divide-y divide-rule">
            {items.map((item) => {
              const answered = !!item.answer
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  onClick={() => item.product && navigate(`/app/product/${item.productId}`)}
                  className="w-full text-left p-3 flex items-start gap-3 focus:outline-none focus-visible:shadow-ring"
                >
                  <div className="w-14 h-14 shrink-0 overflow-hidden bg-quiet">
                    {item.product?.thumbnail_url ? (
                      <img src={item.product.thumbnail_url} alt={item.product.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlaceholder />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-1.5 py-0.5 bg-quiet text-ink-soft">
                        {item.kind === 'question' ? '문의' : '리뷰'}
                      </span>
                      <p className="text-[12.5px] text-ink-soft line-clamp-1">{item.product?.name ?? '삭제된 상품'}</p>
                    </div>
                    <p className="text-[13px] text-ink mt-1 line-clamp-2">
                      {item.isSecret && !answered ? '🔒 비밀글' : item.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-ink-faint tabular-nums">{formatDate(item.createdAt)}</span>
                      {answered ? (
                        <span className="text-[11px] font-bold text-signal-blue">답변 완료</span>
                      ) : (
                        <span className="text-[11px] text-ink-faint">답변 대기중</span>
                      )}
                    </div>
                    {answered && (
                      <div className="mt-1.5 ml-1 pl-2 border-l-2 border-rule">
                        <p className="text-[12.5px] text-ink-soft line-clamp-2">{item.answer}</p>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </AppFrame>
  )
}
