import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import ProductCard from '../components/product/ProductCard'
import Badge from '../components/common/Badge'
import { BRANDS, ALL_LIVE_STREAMS } from '../constants'

export default function AppBrandDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'products' | 'live'>('products')

  const brand = BRANDS.find(b => b.id === Number(id))
  const liveStreams = ALL_LIVE_STREAMS.filter(s => s.brand === brand?.name)

  if (!brand) {
    return (
      <div className="min-h-screen bg-cream-4 flex items-center justify-center">
        <p className="text-text-hint">브랜드를 찾을 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-4 pb-20">
      <BackHeader
        title=""
        transparent
        rightElement={
          <button aria-label="공유" className="text-xl text-white">
            <span aria-hidden="true">↗</span>
          </button>
        }
      />

      {/* 브랜드 헤더 */}
      <div
        className="relative -mt-14 pt-20 pb-8 px-5 flex flex-col items-center text-center"
        style={{ backgroundColor: brand.bgColor }}
      >
        <div
          className="w-20 h-20 rounded-[24px] flex items-center justify-center text-4xl mb-3"
          style={{ backgroundColor: `${brand.accentColor}33` }}
          aria-hidden="true"
        >
          {brand.icon}
        </div>
        <Badge type="dept" label={brand.deptName} deptKey={brand.deptKey} className="mb-2" />
        <h1
          className="font-serif text-[24px] font-bold"
          style={{ color: brand.textColor }}
        >
          {brand.name}
        </h1>
        <p className="text-[13px] mt-1.5 max-w-xs leading-relaxed" style={{ color: `${brand.textColor}99` }}>
          {brand.description}
        </p>
        <div className="flex items-center gap-5 mt-5">
          <div className="text-center">
            <p className="text-[18px] font-bold" style={{ color: brand.textColor }}>{brand.productCount}</p>
            <p className="text-[11px]" style={{ color: `${brand.textColor}80` }}>상품</p>
          </div>
          <div className="w-px h-8 bg-white/20" aria-hidden="true" />
          <div className="text-center">
            <p className="text-[18px] font-bold" style={{ color: brand.textColor }}>{liveStreams.length}</p>
            <p className="text-[11px]" style={{ color: `${brand.textColor}80` }}>라이브</p>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white border-b border-cream-2 flex sticky top-0 z-10">
        {(['products', 'live'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[14px] font-medium relative ${tab === t ? 'text-text' : 'text-text-hint'}`}
            aria-pressed={tab === t}
          >
            {t === 'products' ? `상품 (${brand.products.length})` : `라이브 (${liveStreams.length})`}
            {tab === t && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gold rounded-full" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        {tab === 'products' && (
          <div className="grid grid-cols-2 gap-3">
            {brand.products.length === 0 ? (
              <p className="col-span-2 text-center py-10 text-text-hint text-[14px]">상품이 준비 중입니다.</p>
            ) : (
              brand.products.map(product => (
                <button
                  key={product.id}
                  onClick={() => navigate(`/app/product/${product.id}`)}
                  className="text-left focus:outline-none focus:shadow-focus rounded-md"
                  aria-label={`${product.brand} ${product.name}`}
                >
                  <ProductCard {...product} />
                </button>
              ))
            )}
          </div>
        )}
        {tab === 'live' && (
          <div className="flex flex-col gap-3">
            {liveStreams.length === 0 ? (
              <p className="text-center py-10 text-text-hint text-[14px]">예정된 라이브가 없습니다.</p>
            ) : (
              liveStreams.map(stream => (
                <button
                  key={stream.id}
                  onClick={() => navigate(`/app/live/${stream.id}`)}
                  className="bg-white rounded-md p-4 border border-cream-2 flex items-center gap-3 text-left w-full hover:border-gold/30 transition-colors focus:outline-none focus:shadow-focus"
                  aria-label={`${stream.brand} 라이브`}
                >
                  <div
                    className="w-12 h-12 rounded-md flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: stream.bgColor }}
                    aria-hidden="true"
                  >
                    💄
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {stream.isLive
                        ? <Badge type="live" label="LIVE" />
                        : <span className="text-[10px] text-text-sub bg-cream-2 px-2 py-0.5 rounded-pill">{stream.scheduledAt}</span>
                      }
                    </div>
                    <p className="text-[13px] font-semibold text-text truncate">{stream.productName}</p>
                    <p className="text-gold text-[12px] font-bold">{stream.price.toLocaleString('ko-KR')}원</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
