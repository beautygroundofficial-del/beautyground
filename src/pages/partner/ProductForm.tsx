import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconUpload, IconToggleRight, IconToggleLeft,
  IconArrowUp, IconArrowDown, IconTrash, IconScissors, IconX,
} from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import { splitAndUploadLongImage } from '../../lib/splitLongImage'
import type { Product, ScrapedReview } from '../../lib/types'
import { PRODUCT_CATEGORIES } from '../../lib/types'

const inputCls =
  'w-full border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:border-[#b8924a] transition-colors bg-white'

// /api/find-product 후보 항목
interface FoundCandidate {
  name: string
  url: string
  thumbnail: string | null
  score: number
}

// /api/scrape-product 응답 data (필요 필드만)
interface ScrapeResult {
  name?: string | null
  price?: number | null
  sale_price?: number | null
  description?: string | null
  summary?: string | null
  thumbnail_url?: string | null
  category?: string | null
  gallery?: unknown
  images?: unknown
  detail_images?: unknown
}

export default function ProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  // 대표 이미지 업로드
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 자동 분할 업로드
  const splitFileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState<boolean>(isEdit)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [liveEnabled, setLiveEnabled] = useState(false)

  // 파트너 정보
  const [partnerId, setPartnerId] = useState<string>('')

  // 대표 이미지 업로드 상태
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // 분할 업로드 상태
  const [splitProgress, setSplitProgress] = useState<{ done: number; total: number } | null>(null)
  const [splitError, setSplitError] = useState('')

  // 상품 필드
  const [name, setName] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [salePrice, setSalePrice] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [stock, setStock] = useState<string>('100')
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [status, setStatus] = useState<Product['status']>('on_sale')
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [detailImages, setDetailImages] = useState<string[]>([])

  // 상품 페이지 URL 자동 기입
  const [pageUrl, setPageUrl] = useState<string>('')
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 사이트 주소 + 제목 자동 등록 (방법 2)
  const [siteUrl, setSiteUrl] = useState<string>('')
  const [findTitle, setFindTitle] = useState<string>('')
  const [finding, setFinding] = useState(false)
  const [findMsg, setFindMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [candidates, setCandidates] = useState<FoundCandidate[]>([])
  const [showCandidates, setShowCandidates] = useState(false)
  const [autofillBanner, setAutofillBanner] = useState<string>('')

  // 수집한 리뷰
  const [scrapedReviews, setScrapedReviews] = useState<ScrapedReview[]>([])
  const [reviewsHidden, setReviewsHidden] = useState(false)

  // 파트너 ID 미리 가져오기
  useEffect(() => {
    getMyPartner().then(p => { if (p) setPartnerId(p.id) })
  }, [])

  // 수정 모드: 기존 상품 로드
  useEffect(() => {
    if (!isEdit) return
    let active = true
    supabase.from('products').select('*').eq('id', id).single().then(({ data }) => {
      if (!active || !data) return
      const p = data as Product
      setName(p.name)
      setPrice(String(p.price))
      setSalePrice(p.sale_price != null ? String(p.sale_price) : '')
      setCategory(p.category ?? '')
      setStock(String(p.stock))
      setThumbnailUrl(p.thumbnail_url ?? '')
      setDescription(p.description ?? '')
      setStatus(p.status)
      setGalleryImages(p.gallery_images ?? [])
      setDetailImages(p.detail_images ?? [])
      setScrapedReviews(p.scraped_reviews ?? [])
      setLoading(false)
    })
    return () => { active = false }
  }, [id, isEdit])

  // ── 대표 이미지 업로드 ──────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setUploadError('')
    if (!file.type.startsWith('image/')) { setUploadError('이미지 파일만 업로드할 수 있습니다.'); return }
    if (file.size > 5 * 1024 * 1024) { setUploadError('이미지는 5MB 이하만 업로드할 수 있습니다.'); return }
    setUploading(true)
    const folder = partnerId || 'temp'
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${folder}/${Date.now()}_${safeName}`
    const { error: uploadErr } = await supabase.storage.from('product-images').upload(path, file)
    if (uploadErr) { setUploadError('업로드에 실패했습니다. 다시 시도해 주세요.'); setUploading(false); return }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setThumbnailUrl(data.publicUrl)
    setUploading(false)
  }

  // ── 자동 분할 업로드 ────────────────────────────────────────────────────────
  const handleSplitFile = async (file: File) => {
    setSplitError('')
    if (!file.type.startsWith('image/')) { setSplitError('이미지 파일만 선택해 주세요.'); return }
    setSplitProgress({ done: 0, total: 0 })
    try {
      const keyPrefix = partnerId
        ? `${partnerId}/detail_${Date.now()}`
        : `temp/detail_${Date.now()}`
      const urls = await splitAndUploadLongImage(file, keyPrefix, (done, total) => {
        setSplitProgress({ done, total })
      })
      setDetailImages(prev => [...prev, ...urls])
    } catch {
      setSplitError('이미지 분할 업로드에 실패했습니다. Storage 버킷 설정을 확인해 주세요.')
    } finally {
      setSplitProgress(null)
    }
  }

  // ── 대표 이미지 갤러리 조작 ──────────────────────────────────────────────────
  const addGalleryImage = () => setGalleryImages(prev => [...prev, ''])
  const removeGalleryImage = (i: number) =>
    setGalleryImages(prev => prev.filter((_, idx) => idx !== i))
  const updateGalleryImage = (i: number, val: string) =>
    setGalleryImages(prev => prev.map((u, idx) => idx === i ? val : u))
  const moveGalleryImage = (i: number, dir: -1 | 1) => {
    setGalleryImages(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // ── 상세 이미지 목록 조작 ────────────────────────────────────────────────────
  const addDetailImage = () => setDetailImages(prev => [...prev, ''])
  const removeDetailImage = (i: number) =>
    setDetailImages(prev => prev.filter((_, idx) => idx !== i))
  const updateDetailImage = (i: number, val: string) =>
    setDetailImages(prev => prev.map((u, idx) => idx === i ? val : u))
  const moveDetailImage = (i: number, dir: -1 | 1) => {
    setDetailImages(prev => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // ── 스크랩 결과(d)를 폼에 반영 → 채운 항목 수 반환 ────────────────────────────
  const toStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((u): u is string => typeof u === 'string' && u.trim() !== '') : []

  const applyScrapeData = (d: ScrapeResult): { filled: number; imgCount: number } => {
    let filled = 0
    // 재고가 비어있거나 0 이면 기본 100 으로 채움(사용자가 입력해 둔 값은 유지)
    setStock(prev => (!prev.trim() || Number(prev) === 0 ? '100' : prev))
    // 값이 null/빈 항목은 기존값 유지
    if (d.name) { setName(d.name); filled++ }
    if (d.category && (PRODUCT_CATEGORIES as readonly string[]).includes(d.category)) { setCategory(d.category); filled++ }
    if (d.price != null) { setPrice(String(d.price)); filled++ }
    if (d.sale_price != null) { setSalePrice(String(d.sale_price)); filled++ }
    const desc = (d.summary && d.summary.trim()) || d.description
    if (desc) { setDescription(desc); filled++ }

    // 대표 이미지 갤러리: 스크랩한 갤러리(없으면 전체 이미지)를 갤러리 영역에 채움
    const gallery = toStrArr(d.gallery)
    const imgs = gallery.length > 0 ? gallery : toStrArr(d.images)
    if (imgs.length > 0) {
      setThumbnailUrl(imgs[0]) // 대표 = 갤러리 첫 장
      setUploadError('')
      setGalleryImages(prev => {
        const existing = prev.filter(u => u.trim() !== '')
        const seen = new Set(existing)
        const added = imgs.filter(u => !seen.has(u))
        return [...existing, ...added]
      })
      filled++
    } else if (d.thumbnail_url) {
      setThumbnailUrl(d.thumbnail_url)
      setUploadError('')
      filled++
    }

    // 상세 이미지: 스크랩한 상세컷을 상세 이미지 목록에 append (중복 제거)
    const details = toStrArr(d.detail_images)
    if (details.length > 0) {
      setDetailImages(prev => {
        const existing = prev.filter(u => u.trim() !== '')
        const seen = new Set(existing)
        const added = details.filter(u => !seen.has(u))
        return [...existing, ...added]
      })
      filled++
    }

    return { filled, imgCount: imgs.length }
  }

  // 상품 상세 URL → /api/scrape-product 호출 → 폼 반영 (성공 시 채운 항목 수 반환)
  const scrapeUrlToForm = async (url: string): Promise<{ filled: number; imgCount: number } | null> => {
    const resp = await fetch('/api/scrape-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const json = await resp.json()
    if (!json?.ok || !json?.data) return null
    return applyScrapeData(json.data as ScrapeResult)
  }

  // 리뷰 사진 총 장수 계산
  const countPhotos = (reviews: ScrapedReview[]): number =>
    reviews.reduce((n, r) => n + (r.photos?.length ?? (r.photo ? 1 : 0)), 0)

  // 상품 상세 URL → /api/scrape-reviews 호출 → 리뷰 state 반영 (리뷰/사진 개수 반환)
  const fetchReviews = async (url: string): Promise<{ count: number; photos: number }> => {
    try {
      const resp = await fetch('/api/scrape-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl: url }),
      })
      const json = await resp.json()
      const reviews: ScrapedReview[] = Array.isArray(json?.reviews) ? json.reviews : []
      setScrapedReviews(reviews)
      return { count: reviews.length, photos: countPhotos(reviews) }
    } catch {
      setScrapedReviews([])
      return { count: 0, photos: 0 }
    }
  }

  // ── 상품 페이지 URL → 자동 기입 (방법 1) ─────────────────────────────────────
  const handleScrape = async () => {
    const target = pageUrl.trim()
    if (!target) { setScrapeMsg({ type: 'err', text: '상품 페이지 URL 을 입력해 주세요.' }); return }
    setScraping(true)
    setScrapeMsg(null)
    try {
      const result = await scrapeUrlToForm(target)
      if (!result) {
        setScrapeMsg({ type: 'err', text: '자동 불러오기 실패. 직접 입력해 주세요.' })
        return
      }
      const rv = await fetchReviews(target)
      const imgNote = result.imgCount > 1 ? ` (대표 이미지 ${result.imgCount}장)` : ''
      const photoNote = rv.photos > 0 ? ` · 사진 ${rv.photos}장` : ''
      const reviewNote = rv.count > 0 ? ` · 리뷰 ${rv.count}개 수집됨${photoNote}` : ''
      setScrapeMsg({ type: 'ok', text: `불러왔어요. 확인 후 등록/수정하세요.${imgNote}${reviewNote}` })
    } catch {
      setScrapeMsg({ type: 'err', text: '자동 불러오기 실패. 직접 입력해 주세요.' })
    } finally {
      setScraping(false)
    }
  }

  // ── 사이트 주소 + 제목 → 자동 등록 (방법 2) ──────────────────────────────────
  // 선택된 상품 상세 URL 을 스크랩해 폼에 반영하고 안내 배너 표시
  const applyFromUrl = async (url: string) => {
    setFinding(true)
    setFindMsg(null)
    try {
      const result = await scrapeUrlToForm(url)
      if (!result) {
        setFindMsg({ type: 'err', text: '상세 정보를 불러오지 못했습니다. 상품 페이지 URL 을 직접 넣어 주세요.' })
        return
      }
      const rv = await fetchReviews(url)
      const photoNote = rv.photos > 0 ? ` (사진 ${rv.photos}장)` : ''
      const reviewNote = rv.count > 0 ? ` 리뷰 ${rv.count}개도 함께 수집했습니다.${photoNote}` : ''
      setAutofillBanner(`${result.filled}개 항목을 자동으로 채웠습니다.${reviewNote} 확인 후 수정하고 등록해 주세요.`)
    } catch {
      setFindMsg({ type: 'err', text: '상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setFinding(false)
    }
  }

  const handleFind = async () => {
    const site = siteUrl.trim()
    const title = findTitle.trim()
    if (!site) { setFindMsg({ type: 'err', text: '업체 사이트 주소를 입력해 주세요.' }); return }
    if (!title) { setFindMsg({ type: 'err', text: '상품 제목을 입력해 주세요.' }); return }
    setFinding(true)
    setFindMsg(null)
    setAutofillBanner('')
    setCandidates([])
    setShowCandidates(false)
    try {
      const resp = await fetch('/api/find-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: site, title }),
      })
      const json = await resp.json()

      if (json?.error === 'SEARCH_UNSUPPORTED') {
        setFindMsg({ type: 'err', text: '이 사이트는 자동 검색이 안 됩니다. 상품 페이지 URL 을 직접 붙여넣어 주세요.' })
        return
      }
      if (json?.best?.url) {
        await applyFromUrl(json.best.url) // 내부에서 finding false 처리
        return
      }
      const cands: FoundCandidate[] = Array.isArray(json?.candidates) ? json.candidates : []
      if (cands.length > 0) {
        setCandidates(cands)
        setShowCandidates(true)
        return
      }
      setFindMsg({ type: 'err', text: '일치하는 상품을 찾지 못했습니다. 제목을 더 정확히 입력하거나 상품 URL 을 직접 넣어 주세요.' })
    } catch {
      setFindMsg({ type: 'err', text: '자동 불러오기에 실패했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setFinding(false)
    }
  }

  // 후보 모달에서 상품 1개 선택
  const chooseCandidate = async (url: string) => {
    setShowCandidates(false)
    await applyFromUrl(url)
  }

  // ── 폼 제출 ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('상품명을 입력해 주세요.'); return }
    const priceNum = Number(price)
    if (!price || Number.isNaN(priceNum) || priceNum < 0) { setError('정가를 0 이상 숫자로 입력해 주세요.'); return }
    const stockNum = Number(stock)
    if (Number.isNaN(stockNum) || stockNum < 0) { setError('재고를 0 이상 숫자로 입력해 주세요.'); return }

    const gallery = galleryImages.filter(u => u.trim() !== '')
    const payload = {
      name: name.trim(),
      price: priceNum,
      sale_price: salePrice ? Number(salePrice) : null,
      category: category || null,
      thumbnail_url: (thumbnailUrl.trim() || gallery[0]) || null, // 목록 대표컷 = 갤러리 첫 장
      description: description || null,
      stock: stockNum,
      status,
      gallery_images: gallery,
      detail_images: detailImages.filter(u => u.trim() !== ''),
      // "리뷰 표시 안 함" 체크 시 저장하지 않음(null)
      scraped_reviews: reviewsHidden || scrapedReviews.length === 0 ? null : scrapedReviews,
    }

    setSubmitting(true)
    if (isEdit) {
      const { error: err } = await supabase.from('products').update(payload).eq('id', id)
      if (err) { setError(err.message); setSubmitting(false); return }
    } else {
      const partner = await getMyPartner()
      if (!partner) { setError('입점 승인된 파트너만 상품을 등록할 수 있습니다.'); setSubmitting(false); return }
      const { error: err } = await supabase.from('products').insert({ ...payload, partner_id: partner.id })
      if (err) { setError(err.message); setSubmitting(false); return }
    }
    navigate('/partner/products')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 자동 기입 안내 배너 */}
      {autofillBanner && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-[#b8924a]/40 bg-[#fdf9f5] px-4 py-3">
          <p className="text-[12px] font-medium text-[#8a6a2f]">{autofillBanner}</p>
          <button
            type="button"
            onClick={() => setAutofillBanner('')}
            className="shrink-0 text-[#b8924a] hover:text-[#8a6a2f]"
            title="닫기"
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      {/* ── 2컬럼: 대표이미지 + 상품정보 ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">

        {/* 좌측: 대표 이미지 + 라이브 특가 */}
        <div className="space-y-4">
          <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
            <h3 className="text-[13px] font-bold text-[#111] mb-4">상품 이미지 (대표)</h3>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
                e.target.value = ''
              }}
            />

            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file && !uploading) handleFileUpload(file)
              }}
              className={`w-full aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center mb-3 overflow-hidden transition-colors select-none ${
                uploading ? 'cursor-wait border-[#e5e0d8] bg-[#f7f4ef]'
                : dragOver ? 'cursor-copy border-[#b8924a] bg-[#fdf9f5]'
                : thumbnailUrl ? 'cursor-pointer border-[#e5e0d8] bg-[#f7f4ef]'
                : 'cursor-pointer border-[#e5e0d8] bg-[#f7f4ef] hover:border-[#b8924a] hover:bg-[#fdf9f5]'
              }`}
            >
              {uploading ? (
                <p className="text-[13px] text-[#9a9080]">업로드 중...</p>
              ) : thumbnailUrl ? (
                <img src={thumbnailUrl} alt="썸네일" className="w-full h-full object-cover" />
              ) : (
                <>
                  <IconUpload size={28} className="text-[#d0c9be] mb-2" />
                  <p className="text-[13px] font-medium text-[#9a9080]">클릭 또는 드래그</p>
                  <p className="text-[11px] text-[#bbb] mt-1">대표 이미지 업로드 (5MB 이하)</p>
                </>
              )}
            </div>

            {uploadError && <p className="text-[11px] text-red-500 mb-3">{uploadError}</p>}

            <label className="block text-[11px] font-semibold text-[#9a9080] mb-1.5">
              이미지 URL 직접 입력
            </label>
            <input
              type="text"
              value={thumbnailUrl}
              onChange={e => { setThumbnailUrl(e.target.value); setUploadError('') }}
              placeholder="https://...jpg (이미지 파일 주소)"
              className={inputCls}
            />
          </div>

          <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-[#111]">라이브 전용 특가</p>
                <p className="text-[11px] text-[#9a9080] mt-0.5">라이브 예약 시 설정 가능</p>
              </div>
              <button type="button" onClick={() => setLiveEnabled(!liveEnabled)}>
                {liveEnabled
                  ? <IconToggleRight size={30} className="text-[#b8924a]" />
                  : <IconToggleLeft size={30} className="text-[#d0c9be]" />}
              </button>
            </div>
          </div>
        </div>

        {/* 우측: 상품 정보 */}
        <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6 space-y-5">
          <h3 className="text-[13px] font-bold text-[#111]">상품 정보</h3>

          {/* 상품 페이지 URL 자동 기입 */}
          <div className="rounded-xl border border-[#e5e0d8] bg-[#faf8f4] p-4">
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">상품 페이지 URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pageUrl}
                onChange={e => setPageUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleScrape() } }}
                placeholder="상품 페이지 URL 붙여넣기 (예: https://...Detail/...)"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={handleScrape}
                disabled={scraping}
                className="shrink-0 px-4 py-2.5 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors whitespace-nowrap"
              >
                {scraping ? '불러오는 중...' : '불러오기'}
              </button>
            </div>
            <p className="text-[11px] text-[#9a9080] mt-1.5 leading-relaxed">
              상품 페이지 주소를 넣으면 상품명·가격·설명·이미지가 자동 입력됩니다.
              (이미지 파일 주소가 아니라 상품 페이지 주소)
            </p>
            {scrapeMsg && (
              <p className={`text-[11px] mt-1.5 font-medium ${scrapeMsg.type === 'ok' ? 'text-[#085041]' : 'text-red-500'}`}>
                {scrapeMsg.text}
              </p>
            )}
          </div>

          {/* 방법 2: 사이트 주소 + 상품명으로 자동 등록 */}
          <div className="rounded-xl border border-[#e5e0d8] bg-[#faf8f4] p-4">
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">사이트 + 상품명으로 자동 등록</label>
            <input
              type="text"
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://makeuphelper.co.kr"
              className={`${inputCls} mb-2`}
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={findTitle}
                onChange={e => setFindTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleFind() } }}
                placeholder="상품 제목 입력"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={handleFind}
                disabled={finding}
                className="shrink-0 px-4 py-2.5 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
              >
                {finding && (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {finding ? '불러오는 중...' : '자동 불러오기'}
              </button>
            </div>
            <p className="text-[11px] text-[#9a9080] mt-1.5 leading-relaxed">
              업체 사이트 주소와 상품 제목만 넣으면 상품을 찾아 정보·이미지를 자동으로 채웁니다.
            </p>
            {findMsg && (
              <p className={`text-[11px] mt-1.5 font-medium ${findMsg.type === 'ok' ? 'text-[#085041]' : 'text-red-500'}`}>
                {findMsg.text}
              </p>
            )}
          </div>

          {/* 수집한 리뷰 상태 + 표시 여부 */}
          {scrapedReviews.length > 0 && (
            <div className="rounded-xl border border-[#e5e0d8] bg-[#faf8f4] p-4 flex items-center justify-between gap-3">
              <p className="text-[12px] font-semibold text-[#555]">
                리뷰 {scrapedReviews.length}개 수집됨
                {countPhotos(scrapedReviews) > 0 && <span> · 사진 {countPhotos(scrapedReviews)}장</span>}
                <span className="ml-1.5 font-normal text-[#9a9080]">상품 상세에 흐르는 후기로 표시됩니다.</span>
              </p>
              <label className="shrink-0 flex items-center gap-1.5 text-[11px] text-[#9a9080] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reviewsHidden}
                  onChange={e => setReviewsHidden(e.target.checked)}
                  className="accent-[#b8924a]"
                />
                리뷰 표시 안 함
              </label>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">상품명 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="상품명 입력" className={inputCls} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">카테고리</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
              <option value="">선택 안 함</option>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#555] mb-1.5">정가 (원) *</label>
              <input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#555] mb-1.5">판매가 (원)</label>
              <input type="number" min={0} value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="선택" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">재고 수량</label>
            <input type="number" min={0} value={stock} onChange={e => setStock(e.target.value)} placeholder="0" className={inputCls} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">판매 상태</label>
            <select value={status} onChange={e => setStatus(e.target.value as Product['status'])} className={inputCls}>
              <option value="on_sale">판매중</option>
              <option value="sold_out">품절</option>
              <option value="hidden">숨김</option>
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">상품 설명</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={5}
              placeholder="상품 설명을 입력하세요"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
      </div>

      {/* ── 대표 이미지 (여러 장) 갤러리 ─────────────────────────────────────── */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <h3 className="text-[13px] font-bold text-[#111] mb-1">대표 이미지 (여러 장)</h3>
        <p className="text-[11px] text-[#9a9080] mb-4">
          상세 화면에서 상단 큰 이미지 + 썸네일 줄로 표시됩니다. 첫 번째 이미지가 목록 카드 대표컷으로 사용됩니다.
        </p>

        <div className="space-y-2 mb-3">
          {galleryImages.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-12 h-12 shrink-0 rounded-lg bg-[#f7f4ef] border border-[#e5e0d8] overflow-hidden flex items-center justify-center text-[10px] text-[#bbb] relative">
                {url.trim()
                  ? <img src={url} alt={`대표 ${i + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : `${i + 1}`}
                {i === 0 && url.trim() && (
                  <span className="absolute bottom-0 inset-x-0 bg-[#b8924a] text-white text-[8px] text-center leading-tight">대표</span>
                )}
              </div>
              <input
                type="text"
                value={url}
                onChange={e => updateGalleryImage(i, e.target.value)}
                placeholder="이미지 주소 붙여넣기"
                className={`${inputCls} flex-1`}
              />
              <button type="button" onClick={() => moveGalleryImage(i, -1)} disabled={i === 0} className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-[#9a9080] hover:border-[#b8924a] hover:text-[#b8924a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="위로">
                <IconArrowUp size={13} />
              </button>
              <button type="button" onClick={() => moveGalleryImage(i, 1)} disabled={i === galleryImages.length - 1} className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-[#9a9080] hover:border-[#b8924a] hover:text-[#b8924a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="아래로">
                <IconArrowDown size={13} />
              </button>
              <button type="button" onClick={() => removeGalleryImage(i)} className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-red-400 hover:border-red-300 transition-colors" title="삭제">
                <IconTrash size={13} />
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={addGalleryImage} className="text-[12px] text-[#b8924a] font-medium border border-[#b8924a] rounded-lg px-4 py-1.5 hover:bg-[#fdf9f5] transition-colors">
          + 이미지 추가
        </button>
      </div>

      {/* ── 상세 이미지 (여러 장) ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <h3 className="text-[13px] font-bold text-[#111] mb-4">상세 이미지 (여러 장)</h3>

        {/* PART B: 긴 이미지 자동 분할 업로드 */}
        <input
          ref={splitFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleSplitFile(file)
            e.target.value = ''
          }}
        />
        <div
          onClick={() => !splitProgress && splitFileRef.current?.click()}
          className={`w-full rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center mb-5 transition-colors select-none ${
            splitProgress
              ? 'cursor-wait border-[#e5e0d8] bg-[#f7f4ef]'
              : 'cursor-pointer border-[#e5e0d8] hover:border-[#b8924a] hover:bg-[#fdf9f5]'
          }`}
        >
          {splitProgress ? (
            <div className="text-center">
              <p className="text-[13px] font-medium text-[#b8924a] mb-1">분할 업로드 중...</p>
              <p className="text-[12px] text-[#9a9080]">
                {splitProgress.total === 0
                  ? '이미지 분석 중...'
                  : `${splitProgress.done} / ${splitProgress.total} 조각`}
              </p>
            </div>
          ) : (
            <>
              <IconScissors size={24} className="text-[#d0c9be] mb-2" />
              <p className="text-[13px] font-medium text-[#9a9080]">긴 상세이미지 올려서 자동 분할</p>
              <p className="text-[11px] text-[#bbb] mt-1">
                1장의 긴 이미지를 {Math.floor(1500)}px 조각으로 잘라 업로드 → 지연로딩 적용
              </p>
            </>
          )}
        </div>

        {splitError && (
          <p className="text-[11px] text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{splitError}</p>
        )}

        {/* URL 행 목록 */}
        <div className="space-y-2 mb-3">
          {detailImages.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* 미리보기 */}
              <div className="w-12 h-12 shrink-0 rounded-lg bg-[#f7f4ef] border border-[#e5e0d8] overflow-hidden flex items-center justify-center text-[10px] text-[#bbb]">
                {url.trim()
                  ? <img src={url} alt={`상세 ${i + 1}`} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : `${i + 1}`}
              </div>

              {/* URL 입력 */}
              <input
                type="text"
                value={url}
                onChange={e => updateDetailImage(i, e.target.value)}
                placeholder="이미지 주소 붙여넣기"
                className={`${inputCls} flex-1`}
              />

              {/* 위/아래/삭제 */}
              <button
                type="button"
                onClick={() => moveDetailImage(i, -1)}
                disabled={i === 0}
                className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-[#9a9080] hover:border-[#b8924a] hover:text-[#b8924a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="위로"
              >
                <IconArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => moveDetailImage(i, 1)}
                disabled={i === detailImages.length - 1}
                className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-[#9a9080] hover:border-[#b8924a] hover:text-[#b8924a] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="아래로"
              >
                <IconArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => removeDetailImage(i)}
                className="w-7 h-7 flex items-center justify-center rounded border border-[#e5e0d8] text-red-400 hover:border-red-300 transition-colors"
                title="삭제"
              >
                <IconTrash size={13} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addDetailImage}
          className="text-[12px] text-[#b8924a] font-medium border border-[#b8924a] rounded-lg px-4 py-1.5 hover:bg-[#fdf9f5] transition-colors"
        >
          + 이미지 추가
        </button>
      </div>

      {/* ── 에러 + 제출 버튼 ────────────────────────────────────────────────── */}
      {error && (
        <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{error}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate('/partner/products')}
          className="px-6 py-2.5 border border-[#e5e0d8] text-[#555] rounded-lg text-[13px] hover:bg-[#f7f4ef] transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={submitting || uploading || !!splitProgress}
          className="flex-1 py-2.5 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors"
        >
          {submitting ? '저장 중...' : isEdit ? '수정하기' : '등록하기'}
        </button>
      </div>

      {/* ── 후보 상품 선택 모달 ─────────────────────────────────────────────── */}
      {showCandidates && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowCandidates(false)}
        >
          <div
            className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[14px] font-bold text-[#111]">상품을 선택해 주세요</h3>
              <button type="button" onClick={() => setShowCandidates(false)} className="text-[#9a9080] hover:text-[#111]" title="닫기">
                <IconX size={18} />
              </button>
            </div>
            <p className="text-[11px] text-[#9a9080] mb-4">제목과 비슷한 상품이 여러 개 있습니다. 등록할 상품을 골라 주세요.</p>
            <div className="space-y-2">
              {candidates.map((c, i) => (
                <button
                  key={`${c.url}-${i}`}
                  type="button"
                  onClick={() => chooseCandidate(c.url)}
                  className="w-full flex items-center gap-3 rounded-xl border border-[#e5e0d8] p-2.5 text-left hover:border-[#b8924a] hover:bg-[#fdf9f5] transition-colors"
                >
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-[#f7f4ef] border border-[#e5e0d8] overflow-hidden flex items-center justify-center text-[10px] text-[#bbb]">
                    {c.thumbnail
                      ? <img src={c.thumbnail} alt={c.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : '이미지'}
                  </div>
                  <span className="flex-1 text-[12px] text-[#111] leading-snug line-clamp-2">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
