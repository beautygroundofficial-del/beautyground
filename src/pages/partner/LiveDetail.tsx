import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { IconArrowLeft, IconVideo, IconPackage } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { Live, Product } from '../../lib/types'

const STATUS: Record<Live['status'], { label: string; bg: string; text: string }> = {
  scheduled: { label: '예정',  bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  live:      { label: 'LIVE', bg: 'bg-red-100',    text: 'text-red-600' },
  ended:     { label: '완료',  bg: 'bg-[#f0f0f0]', text: 'text-[#666]' },
}

function fmt(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function LiveDetail() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState<Live | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!id) { setLoading(false); return }
      const { data } = await supabase.from('lives').select('*').eq('id', id).single()
      if (!active) return
      const row = (data as Live | null) ?? null
      setLive(row)
      if (row?.product_ids?.length) {
        const { data: pd } = await supabase.from('products').select('*').in('id', row.product_ids)
        if (!active) return
        setProducts((pd as Product[]) ?? [])
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [id])

  const changeStatus = async (next: Live['status']) => {
    if (!id || updating) return
    setUpdating(true)
    const { error } = await supabase.from('lives').update({ status: next }).eq('id', id)
    if (!error) setLive(prev => prev ? { ...prev, status: next } : prev)
    setUpdating(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  if (!live) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white rounded-[14px] border border-[#e5e0d8] p-10 text-center">
        <p className="text-[16px] font-semibold text-[#111] mb-3">라이브를 찾을 수 없습니다</p>
        <Link to="/partner/live" className="text-[13px] text-[#b8924a] font-medium hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const badge = STATUS[live.status]

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        <Link to="/partner/live" className="flex items-center gap-1.5 text-[13px] text-[#9a9080] hover:text-[#111] transition-colors">
          <IconArrowLeft size={15} />
          라이브 목록
        </Link>
      </div>

      <div className="space-y-6">
        {/* 메인 카드 */}
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] overflow-hidden">
          <div className="aspect-video bg-[#0e0c08] flex items-center justify-center overflow-hidden">
            {live.thumbnail_url
              ? <img src={live.thumbnail_url} alt={live.title} className="w-full h-full object-cover" />
              : <IconVideo size={48} className="text-[#444]" />}
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-[20px] font-bold text-[#111] mb-1">{live.title}</h1>
                <p className="text-[13px] text-[#9a9080]">방송 예정 · {fmt(live.scheduled_at)}</p>
              </div>
              <span className={`shrink-0 text-[12px] font-bold px-3 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>

            <div className="flex gap-3">
              {live.status === 'scheduled' && (
                <button
                  onClick={() => changeStatus('live')}
                  disabled={updating}
                  className="px-6 py-2.5 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors"
                >
                  {updating ? '처리 중...' : '방송 시작'}
                </button>
              )}
              {live.status === 'live' && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-100 text-red-600 rounded-lg text-[13px] font-semibold">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    라이브 방송 중
                  </div>
                  <button
                    onClick={() => changeStatus('ended')}
                    disabled={updating}
                    className="px-6 py-2.5 border border-[#e5e0d8] text-[#555] rounded-lg text-[13px] hover:bg-[#f7f4ef] transition-colors disabled:opacity-60"
                  >
                    {updating ? '처리 중...' : '방송 종료'}
                  </button>
                </>
              )}
              {live.status === 'ended' && (
                <div className="px-4 py-2.5 bg-[#f0f0f0] text-[#666] rounded-lg text-[13px] font-medium">
                  방송이 종료되었습니다
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 영상 송출 */}
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <h3 className="text-[14px] font-bold text-[#111] mb-4">영상 송출</h3>
          {live.stream_url ? (
            <a href={live.stream_url} target="_blank" rel="noreferrer"
              className="text-[13px] text-[#b8924a] hover:underline break-all font-medium">
              {live.stream_url}
            </a>
          ) : (
            <div className="border-2 border-dashed border-[#e5e0d8] rounded-xl p-8 text-center">
              <p className="text-[13px] text-[#9a9080]">영상 송출 연동 예정입니다.</p>
            </div>
          )}
        </div>

        {/* 판매 상품 */}
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
          <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-[#111] mb-4">
            <IconPackage size={15} />
            판매 상품 ({products.length}개)
          </h3>

          {products.length === 0 ? (
            <p className="text-[13px] text-[#9a9080]">등록된 상품이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {products.map(product => (
                <div key={product.id} className="flex items-center gap-4 py-3 border-b border-[#f0ece4] last:border-b-0 last:pb-0">
                  <div className="w-12 h-12 rounded-lg bg-[#f7f4ef] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {product.thumbnail_url
                      ? <img src={product.thumbnail_url} alt={product.name} className="w-full h-full object-cover" />
                      : <span className="text-[18px]">🛍️</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#111] truncate">{product.name}</p>
                    {product.category && <p className="text-[11px] text-[#9a9080]">{product.category}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] font-bold text-[#111]">
                      {(product.sale_price ?? product.price).toLocaleString()}원
                    </p>
                    {product.sale_price != null && product.sale_price < product.price && (
                      <p className="text-[11px] text-[#bbb] line-through">{product.price.toLocaleString()}원</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
