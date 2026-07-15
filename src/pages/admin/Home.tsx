import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { won } from '../../lib/format'
import Button from '../../components/common/Button'
import HomeBody from '../../components/home/HomeBody'
import { useShopLives } from '../../hooks/useShopLives'
import { useShopCategories } from '../../hooks/useShopCategories'
import { useShopProducts } from '../../hooks/useShopProducts'
import { DEFAULT_MARQUEE_ITEMS } from '../../hooks/useHomeSettings'
import type { HeroBanner } from '../../hooks/useHeroBanners'
import type { CategoryThumbnail } from '../../hooks/useCategoryThumbnails'

interface BannerRow {
  id: string
  sort_order: number
  active: boolean
  product_id: string | null
  image_url: string | null
  headline: string | null
  subcopy: string | null
  link_url: string | null
  products: { id: string; name: string; price: number; sale_price: number | null; thumbnail_url: string | null } | null
}

interface ProductOption {
  id: string
  name: string
  thumbnail_url: string | null
}

interface CategoryThumbRow {
  category: string
  image_url: string | null
  product_id: string | null
}

const BANNER_SELECT =
  'id,sort_order,active,product_id,image_url,headline,subcopy,link_url,products(id,name,price,sale_price,thumbnail_url)'

export default function AdminHome() {
  // 마퀴 문구 (draft → 저장)
  const [marqueeItems, setMarqueeItems] = useState<string[]>(DEFAULT_MARQUEE_ITEMS)
  const [marqueeLoaded, setMarqueeLoaded] = useState(false)
  const [savingMarquee, setSavingMarquee] = useState(false)
  const [marqueeSaved, setMarqueeSaved] = useState(false)

  // 히어로 배너 (액션 즉시 저장)
  const [banners, setBanners] = useState<BannerRow[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [customDraft, setCustomDraft] = useState({ image_url: '', headline: '', subcopy: '', link_url: '' })
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 카테고리 대표 이미지
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({})
  const [savingCategory, setSavingCategory] = useState<string | null>(null)

  // 미리보기용 실데이터
  const { lives } = useShopLives()
  const { categories } = useShopCategories()
  const { products: previewProducts, loading: prodLoading } = useShopProducts({ sort: 'latest', pageSize: 10 })

  const load = async () => {
    setLoading(true)
    const [{ data: bannerData }, { data: productData }, { data: settingsData }, { data: categoryData }] =
      await Promise.all([
        supabase.from('hero_banners').select(BANNER_SELECT).order('sort_order', { ascending: true }),
        supabase.from('products').select('id,name,thumbnail_url').eq('status', 'on_sale').order('name', { ascending: true }),
        supabase.from('home_settings').select('marquee_items').eq('id', 1).maybeSingle(),
        supabase.from('category_thumbnails').select('category,image_url,product_id'),
      ])
    setBanners((bannerData ?? []) as unknown as BannerRow[])
    setProducts((productData ?? []) as ProductOption[])
    if (settingsData?.marquee_items && settingsData.marquee_items.length > 0) {
      setMarqueeItems(settingsData.marquee_items)
    }
    const catMap: Record<string, string> = {}
    for (const row of (categoryData ?? []) as CategoryThumbRow[]) {
      if (row.image_url) catMap[row.category] = row.image_url
    }
    setCategoryImages(catMap)
    setMarqueeLoaded(true)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  // --- 마퀴 문구 ---
  const updateMarqueeLine = (idx: number, value: string) => {
    setMarqueeItems((prev) => prev.map((t, i) => (i === idx ? value : t)))
    setMarqueeSaved(false)
  }
  const addMarqueeLine = () => {
    setMarqueeItems((prev) => [...prev, ''])
    setMarqueeSaved(false)
  }
  const removeMarqueeLine = (idx: number) => {
    setMarqueeItems((prev) => prev.filter((_, i) => i !== idx))
    setMarqueeSaved(false)
  }
  const moveMarqueeLine = (idx: number, dir: -1 | 1) => {
    setMarqueeItems((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
    setMarqueeSaved(false)
  }
  const saveMarquee = async () => {
    setSavingMarquee(true)
    setError('')
    const cleaned = marqueeItems.map((t) => t.trim()).filter(Boolean)
    const { error: updErr } = await supabase
      .from('home_settings')
      .update({ marquee_items: cleaned, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (updErr) {
      setError(`마퀴 저장 실패: ${updErr.message}`)
    } else {
      setMarqueeItems(cleaned)
      setMarqueeSaved(true)
    }
    setSavingMarquee(false)
  }

  // --- 히어로 배너 ---
  const nextSortOrder = () => (banners.length > 0 ? Math.max(...banners.map((b) => b.sort_order)) + 1 : 0)

  const addProductBanner = async () => {
    if (!selectedProductId) return
    setError('')
    const { error: insErr } = await supabase
      .from('hero_banners')
      .insert({ product_id: selectedProductId, sort_order: nextSortOrder(), active: true })
    if (insErr) {
      setError(`추가 실패: ${insErr.message}`)
      return
    }
    setSelectedProductId('')
    await load()
  }

  const addCustomBanner = async () => {
    if (!customDraft.image_url.trim()) return
    setError('')
    const { error: insErr } = await supabase.from('hero_banners').insert({
      product_id: null,
      sort_order: nextSortOrder(),
      active: true,
      image_url: customDraft.image_url.trim(),
      headline: customDraft.headline.trim() || null,
      subcopy: customDraft.subcopy.trim() || null,
      link_url: customDraft.link_url.trim() || null,
    })
    if (insErr) {
      setError(`추가 실패: ${insErr.message}`)
      return
    }
    setCustomDraft({ image_url: '', headline: '', subcopy: '', link_url: '' })
    await load()
  }

  const removeBanner = async (id: string) => {
    setBusyId(id)
    setError('')
    const { error: delErr } = await supabase.from('hero_banners').delete().eq('id', id)
    if (delErr) setError(`삭제 실패: ${delErr.message}`)
    setBusyId(null)
    await load()
  }

  const toggleActive = async (row: BannerRow) => {
    setBusyId(row.id)
    setError('')
    const { error: updErr } = await supabase.from('hero_banners').update({ active: !row.active }).eq('id', row.id)
    if (updErr) setError(`변경 실패: ${updErr.message}`)
    setBusyId(null)
    await load()
  }

  const move = async (row: BannerRow, dir: -1 | 1) => {
    const idx = banners.findIndex((b) => b.id === row.id)
    const swapWith = banners[idx + dir]
    if (!swapWith) return
    setBusyId(row.id)
    setError('')
    const { error: e1 } = await supabase.from('hero_banners').update({ sort_order: swapWith.sort_order }).eq('id', row.id)
    const { error: e2 } = await supabase.from('hero_banners').update({ sort_order: row.sort_order }).eq('id', swapWith.id)
    if (e1 || e2) setError(`순서 변경 실패: ${(e1 ?? e2)?.message}`)
    setBusyId(null)
    await load()
  }

  const usedProductIds = new Set(banners.map((b) => b.product_id).filter((v): v is string => !!v))
  const availableProducts = products.filter((p) => !usedProductIds.has(p.id))

  const previewBanners: HeroBanner[] = banners
    .filter((b) => b.active)
    .map((b) => ({
      id: b.id,
      sort_order: b.sort_order,
      product: b.products,
      custom: b.products
        ? null
        : { image_url: b.image_url, headline: b.headline, subcopy: b.subcopy, link_url: b.link_url },
    }))

  const previewCategoryThumbnails: CategoryThumbnail[] = categories.map((c, i) => ({
    category: c,
    imageUrl: categoryImages[c] ?? null,
    sortOrder: i,
  }))

  // --- 카테고리 대표 이미지 ---
  const saveCategoryImage = async (category: string) => {
    setSavingCategory(category)
    setError('')
    const imageUrl = (categoryImages[category] ?? '').trim()
    const { error: upErr } = await supabase
      .from('category_thumbnails')
      .upsert({ category, image_url: imageUrl || null }, { onConflict: 'category' })
    if (upErr) setError(`카테고리 이미지 저장 실패: ${upErr.message}`)
    setSavingCategory(null)
  }

  return (
    <>
      <header className="h-[60px] bg-white border-b border-[#eee] flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-[#111]">홈 화면 관리</p>
      </header>

      <main className="p-8">
        <h1 className="text-[22px] font-bold text-text mb-1">홈 화면 관리</h1>
        <p className="text-[13px] text-text-sub mb-5">
          공지 마퀴·히어로 배너·카테고리 대표 이미지를 수정하면 오른쪽 미리보기에 바로 반영됩니다.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5 max-w-[700px]">
            {error}
          </div>
        )}

      <div className="flex items-start gap-8">
        {/* 왼쪽: 편집 폼 */}
        <div className="flex-1 min-w-0 max-w-[700px]">

        {/* 1) 공지 마퀴 문구 */}
        <section className="bg-white rounded-md border p-4 mb-6" style={{ borderColor: '#e5e0d8' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold text-text">상단 공지 마퀴</h2>
            <Button
              variant="gold"
              size="sm"
              label={savingMarquee ? '저장 중…' : marqueeSaved ? '저장됨 ✓' : '저장'}
              onClick={() => void saveMarquee()}
              disabled={!marqueeLoaded || savingMarquee}
            />
          </div>
          <div className="flex flex-col gap-2">
            {marqueeItems.map((text, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => updateMarqueeLine(idx, e.target.value)}
                  placeholder="공지 문구 입력 (이모지 가능)"
                  className="flex-1 text-[14px] border border-cream-2 rounded-md px-3 py-2"
                />
                <button
                  onClick={() => moveMarqueeLine(idx, -1)}
                  disabled={idx === 0}
                  className="w-7 h-7 flex items-center justify-center text-text-sub disabled:opacity-30"
                  aria-label="위로"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveMarqueeLine(idx, 1)}
                  disabled={idx === marqueeItems.length - 1}
                  className="w-7 h-7 flex items-center justify-center text-text-sub disabled:opacity-30"
                  aria-label="아래로"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeMarqueeLine(idx)}
                  className="w-7 h-7 flex items-center justify-center text-red-500"
                  aria-label="삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={addMarqueeLine} className="mt-3 text-[13px] text-gold font-medium">
            + 문구 추가
          </button>
        </section>

        {/* 2) 히어로 배너 */}
        <section className="mb-6">
          <h2 className="text-[15px] font-bold text-text mb-3">히어로 배너</h2>

          {/* 상품 연결 배너 */}
          <div className="bg-white rounded-md border p-4 mb-3" style={{ borderColor: '#e5e0d8' }}>
            <p className="text-[12px] text-text-sub mb-2">상품 배너 — 상품 이미지·이름·가격을 그대로 노출</p>
            <div className="flex items-center gap-3">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 text-[14px] border border-cream-2 rounded-md px-3 py-2.5 bg-white"
              >
                <option value="">배너에 추가할 상품 선택…</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                variant="gold"
                size="md"
                label="추가"
                onClick={() => void addProductBanner()}
                disabled={!selectedProductId}
              />
            </div>
          </div>

          {/* 커스텀 브랜드 배너 */}
          <div className="bg-white rounded-md border p-4 mb-3" style={{ borderColor: '#e5e0d8' }}>
            <p className="text-[12px] text-text-sub mb-2">브랜드 캠페인 배너 — 이미지+문구 직접 입력</p>
            <div className="flex flex-col gap-2">
              <input
                value={customDraft.image_url}
                onChange={(e) => setCustomDraft((prev) => ({ ...prev, image_url: e.target.value }))}
                placeholder="이미지 URL (필수)"
                className="text-[14px] border border-cream-2 rounded-md px-3 py-2"
              />
              <input
                value={customDraft.headline}
                onChange={(e) => setCustomDraft((prev) => ({ ...prev, headline: e.target.value }))}
                placeholder="메인 문구 (예: 얼굴에, 몸에, 피부에)"
                className="text-[14px] border border-cream-2 rounded-md px-3 py-2"
              />
              <input
                value={customDraft.subcopy}
                onChange={(e) => setCustomDraft((prev) => ({ ...prev, subcopy: e.target.value }))}
                placeholder="보조 문구 (선택)"
                className="text-[14px] border border-cream-2 rounded-md px-3 py-2"
              />
              <input
                value={customDraft.link_url}
                onChange={(e) => setCustomDraft((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="클릭 시 이동할 링크 (선택, 예: /app/category/all)"
                className="text-[14px] border border-cream-2 rounded-md px-3 py-2"
              />
              <Button
                variant="gold"
                size="md"
                label="브랜드 배너 추가"
                onClick={() => void addCustomBanner()}
                disabled={!customDraft.image_url.trim()}
                className="self-start"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-16 text-center text-[14px] text-text-hint">불러오는 중…</div>
          ) : banners.length === 0 ? (
            <div className="py-16 text-center text-[14px] text-text-hint bg-white rounded-md border" style={{ borderColor: '#e5e0d8' }}>
              등록된 배너가 없습니다. 위에서 추가하세요.
            </div>
          ) : (
            <div className="bg-white rounded-md border overflow-hidden" style={{ borderColor: '#e5e0d8' }}>
              {banners.map((row, idx) => {
                const thumb = row.products?.thumbnail_url ?? row.image_url
                const title = row.products?.name ?? row.headline ?? '(브랜드 배너)'
                const subtitle = row.products
                  ? won(row.products.sale_price ?? row.products.price)
                  : row.subcopy ?? ''
                return (
                  <div key={row.id} className="flex items-center gap-3 px-4 py-3 border-b border-cream-2 last:border-b-0">
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-cream-3 flex-shrink-0">
                      {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-text font-medium truncate">{title}</p>
                      <p className="text-[12px] text-text-sub truncate">{subtitle}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => void move(row, -1)}
                        disabled={idx === 0 || busyId === row.id}
                        className="w-7 h-7 flex items-center justify-center text-text-sub disabled:opacity-30"
                        aria-label="위로"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => void move(row, 1)}
                        disabled={idx === banners.length - 1 || busyId === row.id}
                        className="w-7 h-7 flex items-center justify-center text-text-sub disabled:opacity-30"
                        aria-label="아래로"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => void toggleActive(row)}
                      disabled={busyId === row.id}
                      className={`text-[12px] font-medium rounded-pill px-2.5 py-1 ${
                        row.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {row.active ? '노출중' : '숨김'}
                    </button>
                    <Button
                      variant="cancel"
                      size="sm"
                      label="삭제"
                      disabled={busyId === row.id}
                      onClick={() => void removeBanner(row.id)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* 3) 카테고리 대표 이미지 */}
        <section className="mb-6">
          <h2 className="text-[15px] font-bold text-text mb-3">카테고리 대표 이미지</h2>
          <p className="text-[12px] text-text-sub mb-3">
            홈 화면 카테고리 아이콘에 쓸 이미지 URL을 카테고리별로 넣어주세요. 비워두면 기본 아이콘이 표시됩니다.
          </p>
          <div className="bg-white rounded-md border overflow-hidden" style={{ borderColor: '#e5e0d8' }}>
            {categories.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-text-hint">
                판매중 상품이 있는 카테고리가 없습니다.
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat} className="flex items-center gap-3 px-4 py-3 border-b border-cream-2 last:border-b-0">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-cream-3 flex-shrink-0">
                    {categoryImages[cat] ? (
                      <img src={categoryImages[cat]} alt="" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <span className="text-[13px] text-text w-20 flex-shrink-0">{cat}</span>
                  <input
                    value={categoryImages[cat] ?? ''}
                    onChange={(e) => setCategoryImages((prev) => ({ ...prev, [cat]: e.target.value }))}
                    placeholder="이미지 URL"
                    className="flex-1 text-[13px] border border-cream-2 rounded-md px-3 py-1.5"
                  />
                  <Button
                    variant="cancel"
                    size="sm"
                    label={savingCategory === cat ? '저장 중…' : '저장'}
                    onClick={() => void saveCategoryImage(cat)}
                    disabled={savingCategory === cat}
                  />
                </div>
              ))
            )}
          </div>
        </section>

        </div>

        {/* 오른쪽: 실시간 미리보기 (스크롤해도 고정) */}
        <div className="w-[390px] flex-shrink-0 sticky top-[92px]">
          <h2 className="text-[15px] font-bold text-text mb-3">미리보기</h2>
          <div
            className="border-4 border-[#1a1710] rounded-[24px] overflow-hidden"
            style={{ width: 390, height: 720 }}
          >
            <div className="w-full h-full overflow-y-auto bg-cream-4 pointer-events-none">
              <HomeBody
                marqueeItems={marqueeItems.filter((t) => t.trim())}
                banners={previewBanners}
                lives={lives}
                categories={categories}
                categoryThumbnails={previewCategoryThumbnails}
                products={previewProducts}
                prodLoading={prodLoading}
                onProductClick={() => {}}
                onCategoryClick={() => {}}
              />
            </div>
          </div>
        </div>
      </div>
      </main>
    </>
  )
}
