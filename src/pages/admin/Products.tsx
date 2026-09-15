import { useEffect, useMemo, useState } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import type { Product, ScrapedReview } from '../../lib/types'
import { won } from '../../lib/format'
import { SEASONS } from '../../lib/season'
import Button from '../../components/common/Button'
import { getProductReviews, replyToProductReview, type AdminProductReview } from '../../lib/reviews'

type Filter = Product['status'] | 'all'
type ProductRow = Product & { partners: { brand_name: string } | null }

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'on_sale', label: '판매중' },
  { value: 'sold_out', label: '품절' },
  { value: 'hidden', label: '숨김' },
]

// 강조는 원색 1개(signal-blue)만 — 판매중=파랑, 나머지(품절/숨김)는 회색 톤.
const STATUS_BADGE: Record<Product['status'], { label: string; className: string }> = {
  on_sale: { label: '판매중', className: 'bg-signal-blue/10 text-signal-blue' },
  sold_out: { label: '품절', className: 'bg-quiet text-ink-soft' },
  hidden: { label: '숨김', className: 'bg-quiet text-ink-faint' },
}

export default function AdminProducts() {
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [reviewTarget, setReviewTarget] = useState<ProductRow | null>(null)
  const [seasonTarget, setSeasonTarget] = useState<ProductRow | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('products')
      .select('*, partners(brand_name)')
      .order('created_at', { ascending: false })
      .limit(1000)
    if (err) { setError(`목록 조회 실패: ${err.message}`); setLoading(false); return }
    setProducts((data ?? []) as ProductRow[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  const handleToggleHide = async (product: ProductRow) => {
    const next: Product['status'] = product.status === 'hidden' ? 'on_sale' : 'hidden'
    setBusyId(product.id)
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, status: next } : p)))
    const { error: err } = await supabase.from('products').update({ status: next }).eq('id', product.id)
    setBusyId(null)
    if (err) setError(`상태 변경 실패: ${err.message}`)
  }

  const handleDelete = async (product: ProductRow) => {
    if (!window.confirm(`"${product.name}" 상품을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setBusyId(product.id)
    const { error: err } = await supabase.from('products').delete().eq('id', product.id)
    setBusyId(null)
    if (err) { setError(`삭제 실패: ${err.message}`); return }
    setProducts((prev) => prev.filter((p) => p.id !== product.id))
  }

  const brandOptions = useMemo(() => {
    const names = new Set(products.map((p) => p.partners?.brand_name).filter((n): n is string => !!n))
    return [...names].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [products])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.partners?.brand_name ?? '').toLowerCase().includes(q)
      const matchFilter = filter === 'all' || p.status === filter
      const matchBrand = brandFilter === 'all' || p.partners?.brand_name === brandFilter
      return matchSearch && matchFilter && matchBrand
    })
  }, [products, search, filter, brandFilter])

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">전체 상품 관리</p>
      </header>

      <main className="max-w-[1300px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">전체 상품 관리</h1>
        <p className="text-[13px] text-ink-soft mb-5">모든 브랜드의 상품을 확인·숨김·삭제하고, 등록된 리뷰를 검수할 수 있습니다.</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="상품명·브랜드명 검색"
              className="w-full pl-9 pr-4 py-2.5 border border-rule rounded-control text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors bg-paper"
            />
          </div>
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-rule rounded-control text-[13px] text-ink bg-paper focus:outline-none focus:border-ink transition-colors"
          >
            <option value="all">전체 브랜드</option>
            {brandOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <div className="flex gap-2 flex-wrap">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-2.5 rounded-pill text-[13px] border transition-colors ${
                  filter === value ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{error}</div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">{search || filter !== 'all' || brandFilter !== 'all' ? '조건에 맞는 상품이 없습니다' : '등록된 상품이 없습니다'}</div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">브랜드</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상품명</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">가격</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">재고</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">리뷰</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">계절</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const badge = STATUS_BADGE[p.status]
                  const reviewCount = p.scraped_reviews?.length ?? 0
                  return (
                    <tr key={p.id} className="border-b border-rule last:border-b-0">
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{p.partners?.brand_name ?? '-'}</td>
                      <td className="px-4 py-3 text-ink max-w-[220px] truncate">{p.name}</td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{won(p.sale_price ?? p.price)}</td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{p.stock}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {reviewCount > 0 ? (
                          <button onClick={() => setReviewTarget(p)} className="text-signal-blue underline text-[12px]">{reviewCount}건 관리</button>
                        ) : (
                          <span className="text-ink-faint text-[12px]">0건</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => setSeasonTarget(p)} className="text-[12px] text-ink-soft underline hover:text-ink">
                          {p.season_tags && p.season_tags.length > 0 ? p.season_tags.join(', ') : '미지정'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium ${badge.className}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="inkOutline" size="sm" label={p.status === 'hidden' ? '노출' : '숨김'}
                            disabled={busyId === p.id} onClick={() => void handleToggleHide(p)}
                          />
                          <Button variant="danger" size="sm" label="삭제" disabled={busyId === p.id} onClick={() => void handleDelete(p)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {reviewTarget && (
        <ReviewModal
          product={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onChanged={(reviews) => {
            setProducts((prev) => prev.map((p) => (p.id === reviewTarget.id ? { ...p, scraped_reviews: reviews } : p)))
            setReviewTarget((prev) => (prev ? { ...prev, scraped_reviews: reviews } : prev))
          }}
        />
      )}

      {seasonTarget && (
        <SeasonModal
          product={seasonTarget}
          onClose={() => setSeasonTarget(null)}
          onChanged={(tags) => {
            setProducts((prev) => prev.map((p) => (p.id === seasonTarget.id ? { ...p, season_tags: tags } : p)))
            setSeasonTarget((prev) => (prev ? { ...prev, season_tags: tags } : prev))
          }}
        />
      )}
    </>
  )
}

function SeasonModal({
  product, onClose, onChanged,
}: { product: ProductRow; onClose: () => void; onChanged: (tags: string[]) => void }) {
  const [tags, setTags] = useState<string[]>(product.season_tags ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const toggle = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const save = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('products').update({ season_tags: tags }).eq('id', product.id)
    setBusy(false)
    if (err) { setError(`저장 실패: ${err.message}`); return }
    onChanged(tags)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-paper rounded-md w-full max-w-[360px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <p className="text-[15px] font-bold text-ink truncate">계절 태그 — {product.name}</p>
          <button onClick={onClose} className="shrink-0 text-ink-faint hover:text-ink"><IconX size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[12px] rounded-md px-3 py-2">{error}</div>}
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className={`px-3.5 py-2 rounded-pill text-[13px] border transition-colors ${
                  tags.includes(tag) ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-ink-faint">체크된 태그와 홈의 "지금 시즌"이 겹치면 이 상품이 우선 추천됩니다. 아무것도 선택하지 않으면 계절 구분 없이 노출됩니다.</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-rule">
          <Button variant="inkOutline" size="sm" label="취소" onClick={onClose} disabled={busy} />
          <Button variant="ink" size="sm" label={busy ? '저장 중…' : '저장'} onClick={() => void save()} disabled={busy} />
        </div>
      </div>
    </div>
  )
}

function ReviewModal({
  product, onClose, onChanged,
}: { product: ProductRow; onClose: () => void; onChanged: (reviews: ScrapedReview[]) => void }) {
  const [reviews, setReviews] = useState<ScrapedReview[]>(product.scraped_reviews ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 회원이 실제로 쓴 구매후기(product_reviews) — 2026-09-16 알림 구멍 보완: 답변 기능이 아예 없었음.
  const [memberReviews, setMemberReviews] = useState<AdminProductReview[]>([])
  const [memberLoading, setMemberLoading] = useState(true)
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)

  useEffect(() => {
    let active = true
    setMemberLoading(true)
    getProductReviews(product.id).then((rows) => {
      if (!active) return
      setMemberReviews(rows)
      setMemberLoading(false)
    })
    return () => { active = false }
  }, [product.id])

  const startReply = (r: AdminProductReview) => {
    setReplyTargetId(r.id)
    setReplyDraft(r.replyContent ?? '')
  }

  const submitReply = async (id: string) => {
    if (!replyDraft.trim()) return
    setReplyBusy(true)
    const { error: err } = await replyToProductReview(id, replyDraft.trim())
    setReplyBusy(false)
    if (err) { setError(`답변 등록 실패: ${err}`); return }
    setMemberReviews((prev) => prev.map((r) => (r.id === id ? { ...r, replyContent: replyDraft.trim(), repliedAt: new Date().toISOString() } : r)))
    setReplyTargetId(null)
    setReplyDraft('')
  }

  const removeAt = async (idx: number) => {
    if (!window.confirm('이 리뷰를 삭제할까요?')) return
    setBusy(true)
    setError('')
    const next = reviews.filter((_, i) => i !== idx)
    const summary = product.review_summary
      ? {
          ...product.review_summary,
          count: next.length,
          avg: next.length ? Number((next.reduce((s, r) => s + (r.rating ?? 0), 0) / next.length).toFixed(1)) : null,
        }
      : product.review_summary
    const { error: err } = await supabase.from('products').update({ scraped_reviews: next, review_summary: summary }).eq('id', product.id)
    setBusy(false)
    if (err) { setError(`삭제 실패: ${err.message}`); return }
    setReviews(next)
    onChanged(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-paper rounded-md w-full max-w-[560px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <p className="text-[15px] font-bold text-ink">리뷰 관리 — {product.name}</p>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><IconX size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-[12px] rounded-md px-3 py-2">{error}</div>}

          {/* 회원이 실제로 작성한 구매후기 — 답변 등록/수정. 2026-09-16 이전엔 답변 컬럼 자체가 없었음. */}
          <div>
            <p className="text-[12.5px] font-bold text-ink-faint mb-2">회원 구매후기 ({memberReviews.length})</p>
            {memberLoading ? (
              <p className="text-[13px] text-ink-faint text-center py-6">불러오는 중…</p>
            ) : memberReviews.length === 0 ? (
              <p className="text-[13px] text-ink-faint text-center py-6">아직 작성된 구매후기가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {memberReviews.map((r) => (
                  <div key={r.id} className="border border-rule rounded-md p-3">
                    <div className="flex items-center gap-2 text-[12px] text-ink-soft mb-1">
                      <span className="text-signal-blue font-semibold">★ {r.rating}</span>
                      <span>{r.authorName}</span>
                      <span className="text-ink-faint">{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="text-[13px] text-ink whitespace-pre-wrap break-words">{r.reviewText}</p>

                    {r.replyContent && replyTargetId !== r.id && (
                      <div className="mt-2 ml-3 pl-3 border-l-2 border-rule">
                        <div className="flex items-center gap-2 text-[12px] text-ink-soft mb-1">
                          <span className="font-bold text-signal-blue">A</span>
                          <span className="text-ink-faint">{r.repliedAt ? new Date(r.repliedAt).toLocaleDateString('ko-KR') : ''}</span>
                        </div>
                        <p className="text-[13px] text-ink whitespace-pre-wrap break-words">{r.replyContent}</p>
                        <button onClick={() => startReply(r)} className="mt-1 text-[11px] text-ink-faint underline">답변 수정</button>
                      </div>
                    )}

                    {replyTargetId === r.id ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <textarea
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          rows={2}
                          placeholder="답변을 입력하세요"
                          className="w-full text-[13px] border border-rule rounded-md px-2 py-1.5 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={replyBusy || !replyDraft.trim()}
                            onClick={() => void submitReply(r.id)}
                            className="text-[12px] font-bold text-paper bg-ink px-3 py-1.5 rounded-md disabled:opacity-40"
                          >
                            {replyBusy ? '등록 중…' : '등록'}
                          </button>
                          <button
                            onClick={() => { setReplyTargetId(null); setReplyDraft('') }}
                            className="text-[12px] text-ink-soft px-3 py-1.5"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : !r.replyContent ? (
                      <button onClick={() => startReply(r)} className="mt-2 text-[12px] font-bold text-signal-blue underline">
                        답변 등록
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 스크랩 리뷰(외부 수집분) — 삭제만 가능, 기존 기능 */}
          <div>
            <p className="text-[12.5px] font-bold text-ink-faint mb-2">수집된 리뷰 ({reviews.length})</p>
            {reviews.length === 0 ? (
              <p className="text-[13px] text-ink-faint text-center py-10">남은 리뷰가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((r, i) => (
                  <div key={i} className="border border-rule rounded-md p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[12px] text-ink-soft mb-1">
                          {r.rating != null && <span className="text-signal-blue font-semibold">★ {r.rating}</span>}
                          {r.author && <span>{r.author}</span>}
                          {r.date && <span className="text-ink-faint">{r.date}</span>}
                        </div>
                        <p className="text-[13px] text-ink whitespace-pre-wrap break-words">{r.text}</p>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() => void removeAt(i)}
                        className="shrink-0 text-signal-red text-[12px] underline disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
