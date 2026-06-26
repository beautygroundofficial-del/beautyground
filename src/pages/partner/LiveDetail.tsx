import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Live, Product } from '../../lib/types'
import { won, formatDateTime } from '../../lib/format'
import Button from '../../components/common/Button'

const cardStyle = { borderColor: '#e5e0d8', borderWidth: '0.5px' }

const statusMeta: Record<Live['status'], { label: string; className: string }> = {
  scheduled: { label: '예정', className: 'bg-gold/10 text-gold' },
  live: { label: 'LIVE', className: 'bg-red-100 text-red-600' },
  ended: { label: '종료', className: 'bg-cream-3 text-text-sub' },
}

export default function LiveDetail() {
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState<boolean>(true)
  const [live, setLive] = useState<Live | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [updating, setUpdating] = useState<boolean>(false)

  useEffect(() => {
    let active = true

    const load = async () => {
      if (!id) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('lives')
        .select('*')
        .eq('id', id)
        .single()

      if (!active) return

      const row = (data as Live | null) ?? null
      setLive(row)

      if (row?.product_ids?.length) {
        const { data: productData } = await supabase
          .from('products')
          .select('*')
          .in('id', row.product_ids)

        if (!active) return
        setProducts((productData as Product[]) ?? [])
      }

      setLoading(false)
    }

    load()
    return () => {
      active = false
    }
  }, [id])

  const changeStatus = async (newStatus: Live['status']) => {
    if (!id || updating) return
    setUpdating(true)

    const { error } = await supabase
      .from('lives')
      .update({ status: newStatus })
      .eq('id', id)

    if (!error) {
      setLive((prev) => (prev ? { ...prev, status: newStatus } : prev))
    }
    setUpdating(false)
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text mb-6">라이브 상세</h1>
        <div
          className="bg-white rounded-md border p-8 text-center text-[14px] text-text-sub"
          style={cardStyle}
        >
          불러오는 중…
        </div>
      </div>
    )
  }

  if (!live) {
    return (
      <div>
        <h1 className="text-[22px] font-bold text-text mb-6">라이브 상세</h1>
        <div
          className="bg-white rounded-md border p-8 text-center"
          style={cardStyle}
        >
          <p className="text-[15px] font-medium text-text">
            라이브를 찾을 수 없습니다
          </p>
          <Link
            to="/partner/live"
            className="inline-block mt-3 text-[13px] text-gold font-medium hover:underline"
          >
            라이브 목록으로
          </Link>
        </div>
      </div>
    )
  }

  const status = statusMeta[live.status]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold text-text">라이브 상세</h1>
        <Link
          to="/partner/live"
          className="text-[13px] text-text-sub hover:text-text transition"
        >
          ← 목록으로
        </Link>
      </div>

      <div className="space-y-6">
        {/* 기본 정보 */}
        <div className="bg-white rounded-md border p-6" style={cardStyle}>
          <div className="flex items-start gap-4">
            {live.thumbnail_url ? (
              <img
                src={live.thumbnail_url}
                alt={live.title}
                className="w-20 h-20 rounded-md object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-md bg-cream flex items-center justify-center text-[28px] flex-shrink-0">
                📺
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-[18px] font-bold text-text truncate">
                  {live.title}
                </h2>
                <span
                  className={`inline-block px-2 py-0.5 rounded-pill text-[12px] font-medium flex-shrink-0 ${status.className}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="text-[13px] text-text-sub">
                방송 일시 · {formatDateTime(live.scheduled_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            {live.status === 'live' ? (
              <Button
                variant="outline"
                size="md"
                label={updating ? '처리 중…' : '방송 종료'}
                onClick={() => changeStatus('ended')}
                disabled={updating}
              />
            ) : (
              <Button
                variant="gold"
                size="md"
                label={updating ? '처리 중…' : '방송 시작'}
                onClick={() => changeStatus('live')}
                disabled={updating}
              />
            )}
          </div>
        </div>

        {/* 영상 송출 */}
        <div className="bg-white rounded-md border p-6" style={cardStyle}>
          <h3 className="text-[15px] font-semibold text-text mb-3">영상 송출</h3>
          {live.stream_url ? (
            <a
              href={live.stream_url}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] text-gold font-medium hover:underline break-all"
            >
              {live.stream_url}
            </a>
          ) : (
            <div
              className="border border-dashed rounded-md p-6 text-center text-[13px] text-text-hint"
              style={{ borderColor: '#e5e0d8' }}
            >
              영상 송출 연동 예정 (stream_url)
            </div>
          )}
        </div>

        {/* 판매 상품 */}
        <div className="bg-white rounded-md border p-6" style={cardStyle}>
          <h3 className="text-[15px] font-semibold text-text mb-3">판매 상품</h3>
          {products.length === 0 ? (
            <p className="text-[13px] text-text-sub">등록된 상품이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-4 pb-3 border-b last:border-b-0 last:pb-0"
                  style={{ borderColor: '#f0ece4' }}
                >
                  {product.thumbnail_url ? (
                    <img
                      src={product.thumbnail_url}
                      alt={product.name}
                      className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-cream flex items-center justify-center text-[18px] flex-shrink-0">
                      🛍️
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-text truncate">
                      {product.name}
                    </p>
                  </div>
                  <span className="text-[14px] font-semibold text-text flex-shrink-0">
                    {won(product.sale_price ?? product.price)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
