import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { getWishlist, removeWish, type WishlistLine } from '../lib/wishlist'

export default function AppWishlist() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [lines, setLines] = useState<WishlistLine[]>([])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { setLoggedIn(false); setLoading(false); return }
      const list = await getWishlist()
      if (!active) return
      setLines(list)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  const handleRemove = async (line: WishlistLine) => {
    setLines((prev) => prev.filter((l) => l.id !== line.id))
    await removeWish(line.product.id)
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-text-hint text-[14px]">불러오는 중...</div>
  }

  if (!loggedIn) {
    return (
      <AppFrame>
        <BackHeader title="찜 목록" />
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <span className="text-5xl mb-4" aria-hidden="true">🤍</span>
          <p className="text-[15px] text-text-sub mb-6">로그인이 필요해요</p>
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/wishlist' } })}
            className="bg-gold text-white font-semibold text-[14px] px-8 py-3 rounded-pill hover:bg-gold-light transition-colors"
          >
            로그인하기
          </button>
        </div>
      </AppFrame>
    )
  }

  return (
    <AppFrame>
      <BackHeader title="찜 목록" />

      {lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <span className="text-5xl mb-4" aria-hidden="true">🤍</span>
          <p className="text-[16px] font-bold text-text mb-2">찜한 상품이 없어요</p>
          <p className="text-[13px] text-text-sub mb-6">마음에 드는 상품을 찜해보세요</p>
          <button
            onClick={() => navigate('/app/home')}
            className="bg-gold text-white font-semibold text-[14px] px-8 py-3 rounded-pill hover:bg-gold-light transition-colors"
          >
            쇼핑 계속하기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-4">
          {lines.map((line) => {
            const p = line.product
            const sell = p.sale_price ?? p.price
            return (
              <div key={line.id} className="relative">
                <button
                  onClick={() => handleRemove(line)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center text-sm shadow"
                  aria-label="찜 해제"
                >
                  ❤️
                </button>
                <button onClick={() => navigate(`/app/product/${p.id}`)} className="text-left w-full">
                  <div className="aspect-square rounded-lg overflow-hidden bg-cream-3">
                    {p.thumbnail_url ? (
                      <img src={p.thumbnail_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl" aria-hidden="true">💄</div>
                    )}
                  </div>
                  <p className="text-[13px] text-text mt-1.5 line-clamp-1">{p.name}</p>
                  <p className="text-[13px] font-bold text-text mt-0.5">{sell.toLocaleString('ko-KR')}원</p>
                </button>
              </div>
            )
          })}
        </div>
      )}

    </AppFrame>
  )
}
