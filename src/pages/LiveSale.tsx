import { Link } from 'react-router-dom'
import AppHeader from '../components/layout/AppHeader'
import AppFrame from '../components/layout/AppFrame'
import AppFooter from '../components/layout/AppFooter'
import PromoBar from '../components/home/PromoBar'
import { comma } from '../lib/format'
import { useSaleProducts } from '../hooks/useSaleProducts'

// /live/sale — 라이브 메인 "할인 특가 → 전체보기" 목적지. 실제 sale_price가 걸린 상품 전체를
// 할인율 높은 순으로 보여준다(useSaleProducts, 홈 화면 "지금 할인중" 레일과 동일 정의).
// 카드 생김새는 LiveMain 할인 특가 그리드와 동일.
export default function LiveSale() {
  const { products, loading } = useSaleProducts(200)

  return (
    <AppFrame>
      <PromoBar />
      <AppHeader promoBarAbove />
      <main className="bg-white pb-8 px-4">
        <div className="pt-5 mb-4">
          <h1 className="text-base font-bold text-black">할인 특가 전체보기</h1>
        </div>
        {loading ? (
          <p className="text-[13px] text-[#666666] py-8 text-center">불러오는 중…</p>
        ) : products.length === 0 ? (
          <p className="text-[13px] text-[#666666] py-8 text-center">현재 할인 중인 상품이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
            {products.map((p) => (
              <Link key={p.id} to={`/app/product/${p.id}`} data-product-id={p.id} className="text-left focus:outline-none focus-visible:shadow-ring">
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-bg-card border border-card-border">
                  {p.thumbnail_url ? (
                    <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <img src="/images/bg-logo-mark.png" alt="" className="w-8 h-8 object-contain opacity-40" />
                    </div>
                  )}
                </div>
                <p className="text-[13px] font-bold text-black line-clamp-2 mt-2 leading-tight">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm font-bold text-brand-pink">{comma(p.sale_price ?? p.price)}원</span>
                  {p.sale_price != null && p.sale_price < p.price && (
                    <span className="text-xs font-bold text-brand-pink">
                      {Math.round((1 - p.sale_price / p.price) * 100)}%
                    </span>
                  )}
                </div>
                {p.sale_price != null && p.sale_price < p.price && (
                  <p className="text-[11px] text-[#666666] line-through mt-0.5">{comma(p.price)}원</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
      <AppFooter />
    </AppFrame>
  )
}
