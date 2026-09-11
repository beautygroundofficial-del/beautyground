import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import BottomNav from '../components/layout/BottomNav'
import ViewModeToggle from '../components/layout/ViewModeToggle'
import DesktopProductDetail from '../components/product/DesktopProductDetail'
import { useViewMode } from '../lib/viewMode'
import { supabase } from '../lib/supabase'
import { addToCart } from '../lib/cart'
import { isWished, addWish, removeWish } from '../lib/wishlist'
import { recordView } from '../lib/recentlyViewed'
import { getMyMembership } from '../lib/membership'
import type { Product, ProductOption, ScrapedReview, ReviewSummaryData } from '../lib/types'
import { ALL_PRODUCTS, SHIPPING_NOTICE } from '../constants'
import ProductInfoTable from '../components/product/ProductInfoTable'
import ProductInfoNotice from '../components/product/ProductInfoNotice'
import CategoryTabBar from '../components/product/CategoryTabBar'
import ReviewSummary from '../components/product/ReviewSummary'
import ProductQnA from '../components/product/ProductQnA'
import { useProductQuestions } from '../hooks/useProductQuestions'
import { IconHeart, IconCart, IconMinus, IconPlus } from '../components/common/Icon'
import { IconSend2, IconBrandFacebook, IconBrandX, IconLink } from '@tabler/icons-react'
import ImagePlaceholder from '../components/common/ImagePlaceholder'
import Thumb from '../components/common/Thumb'
import ScrollToTopButton from '../components/common/ScrollToTopButton'
import CartCountBadge from '../components/common/CartCountBadge'

// 소비자 상세 렌더링용 통합 뷰모델 (DB 상품 / 목데이터 공통)
interface ProductView {
  name: string
  brand: string
  partnerId: string | null
  category: string | null
  reviewSummary: ReviewSummaryData | null
  price: number // 판매가
  originalPrice: number | null // 정가 (할인 있을 때만)
  images: string[]
  detailImages: string[]
  description: string | null
  stock: number | null // null = 재고 무제한(목데이터)
  soldOut: boolean
  reviews: ScrapedReview[]
  // 상품정보고시(화장품 표시기재, supabase/product_legal_labels.sql) — 전부 null 가능
  capacityWeight: string | null
  ingredients: string | null
  expiryInfo: string | null
  usageMethod: string | null
  manufacturer: string | null
  responsibleSeller: string | null
  precautions: string | null
  qualityStandard: string | null
  // 목데이터 전용(이미지 없을 때 아이콘 표시)
  thumbIcon?: string
  thumbColor?: string
}

// DB 상품 → 뷰모델
function fromDbProduct(p: Product, brand: string): ProductView {
  const images =
    p.gallery_images && p.gallery_images.length > 0
      ? p.gallery_images
      : p.thumbnail_url
      ? [p.thumbnail_url]
      : []
  const sell = p.sale_price ?? p.price
  const hasDiscount = p.sale_price != null && p.sale_price < p.price
  return {
    name: p.name,
    brand,
    partnerId: p.partner_id ?? null,
    category: p.category ?? null,
    reviewSummary: p.review_summary ?? null,
    price: sell,
    originalPrice: hasDiscount ? p.price : null,
    images,
    detailImages: p.detail_images ?? [],
    description: p.description,
    stock: p.stock,
    soldOut: p.status === 'sold_out' || p.stock <= 0,
    reviews: p.scraped_reviews ?? [],
    capacityWeight: p.capacity_weight,
    ingredients: p.ingredients,
    expiryInfo: p.expiry_info,
    usageMethod: p.usage_method,
    manufacturer: p.manufacturer,
    responsibleSeller: p.responsible_seller,
    precautions: p.precautions,
    qualityStandard: p.quality_standard,
  }
}

// 목데이터 상품 → 뷰모델
function fromMock(m: (typeof ALL_PRODUCTS)[number]): ProductView {
  return {
    name: m.name,
    brand: m.brand,
    partnerId: null,
    category: null,
    reviewSummary: null,
    price: m.price,
    originalPrice: m.originalPrice ?? null,
    images: [],
    detailImages: [],
    description: null,
    stock: null,
    soldOut: false,
    reviews: [],
    capacityWeight: null,
    ingredients: null,
    expiryInfo: null,
    usageMethod: null,
    manufacturer: null,
    responsibleSeller: null,
    precautions: null,
    qualityStandard: null,
    thumbIcon: m.thumbIcon,
    thumbColor: m.thumbColor,
  }
}

export default function AppProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { mode, isDesktop, toggle } = useViewMode()
  const [quantity, setQuantity] = useState(1)
  const [options, setOptions] = useState<ProductOption[]>([])
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [activeTab, setActiveTab] = useState(0)
  const [activeImg, setActiveImg] = useState(0)
  const [wished, setWished] = useState(false)
  const { questions: qnaQuestions } = useProductQuestions(id)

  // 공유 — 라이브 시청화면과 동일 패턴(자체 소형 메뉴: 카카오=링크복사 대체·페이스북·X·링크복사)
  // 모바일에 공유 수단이 없다는 대표님 지적(2026-08-13)으로 추가
  const [shareOpen, setShareOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1600)
    } catch {
      /* 클립보드 권한 없는 환경 — 무시 */
    }
    setShareOpen(false)
  }
  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank', 'noopener,width=600,height=500')
    setShareOpen(false)
  }
  const shareToX = () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(view?.name ?? '뷰티그라운드')}`, '_blank', 'noopener,width=600,height=500')
    setShareOpen(false)
  }
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ProductView | null>(null)
  const [toast, setToast] = useState('')
  // 내 등급 적립률 — 비로그인/조회실패면 최저등급(BASIC) 적립률로 안전하게 표시
  const [rewardRate, setRewardRate] = useState(1)

  useEffect(() => {
    let active = true
    getMyMembership().then((m) => { if (active) setRewardRate(m.tier.rewardRate) })
    return () => { active = false }
  }, [])

  // DB 상품 우선 로드, 숫자 id(목데이터)면 목데이터 폴백
  useEffect(() => {
    let active = true
    const isNumeric = !!id && /^\d+$/.test(id)

    async function load() {
      if (id && !isNumeric) {
        const { data } = await supabase.from('products').select('*').eq('id', id).single()
        if (data) {
          const p = data as Product
          let brand = ''
          if (p.partner_id) {
            const { data: pt } = await supabase.from('partners').select('brand_name').eq('id', p.partner_id).single()
            brand = (pt as { brand_name?: string } | null)?.brand_name ?? ''
          }
          if (active) { setView(fromDbProduct(p, brand)); setLoading(false) }
          isWished(id).then((w) => { if (active) setWished(w) })
          void recordView(id)
          supabase
            .from('product_options')
            .select('*')
            .eq('product_id', id)
            .order('sort_order', { ascending: true })
            .then(({ data: opts }) => { if (active) setOptions((opts ?? []) as ProductOption[]) })
          return
        }
      }
      // 폴백: 목데이터
      const mock = ALL_PRODUCTS.find(p => p.id === Number(id))
      if (active) { setView(mock ? fromMock(mock) : null); setLoading(false) }
    }

    load()
    return () => { active = false }
  }, [id])

  // 비로그인 상태로 "구매하기"를 눌러 로그인 페이지로 갔다가(?intent=buy 태그) 로그인 완료 후
  // 이 페이지로 돌아오면, 다시 누르게 하지 않고 자동으로 주문서까지 이어간다.
  useEffect(() => {
    if (loading || !view || !id) return
    if (new URLSearchParams(location.search).get('intent') !== 'buy') return
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active || !session) return
      navigate('/app/order', {
        replace: true,
        state: {
          items: [
            {
              product_id: id,
              name: view.name,
              price: view.price,
              quantity,
              thumbnail: view.images[0] ?? null,
            },
          ],
        },
      })
    })()
    return () => { active = false }
  }, [loading, view, id, quantity, location.search, navigate])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(''), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        {isDesktop ? (
          <div className="max-w-[1280px] mx-auto px-6 py-24 flex items-center justify-center">
            <p className="text-ink-faint text-[14px]">불러오는 중...</p>
          </div>
        ) : (
          <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center">
            <p className="text-ink-faint text-[14px]">불러오는 중...</p>
          </div>
        )}
      </div>
    )
  }

  if (!view) {
    return (
      <div className="min-h-screen bg-quiet md:py-6">
        <ViewModeToggle mode={mode} onToggle={toggle} />
        {isDesktop ? (
          <div className="max-w-[1280px] mx-auto px-6 py-24 flex items-center justify-center">
            <p className="text-ink-faint">상품을 찾을 수 없습니다.</p>
          </div>
        ) : (
          <div className="max-w-[480px] mx-auto bg-paper min-h-screen flex items-center justify-center">
            <p className="text-ink-faint">상품을 찾을 수 없습니다.</p>
          </div>
        )}
      </div>
    )
  }

  const discountRate = view.originalPrice
    ? Math.round((1 - view.price / view.originalPrice) * 100)
    : 0
  const maxQty = view.stock != null ? Math.max(1, view.stock) : 99
  const total = view.price * quantity
  const isDbProduct = !!id && !/^\d+$/.test(id)

  // 비로그인이면 로그인 페이지로 보내고, 로그인 후 원래 페이지로 복귀
  // intent를 넘기면 로그인 완료 후 그 의도(예: 구매)를 자동으로 이어간다
  const requireLogin = async (intent?: string): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return true
    const qs = intent ? `?intent=${intent}` : ''
    navigate('/app/login', { state: { from: `/app/product/${id}${qs}` } })
    return false
  }

  const onBuy = async () => {
    if (!isDbProduct || !id) { showToast('목데이터 상품은 구매할 수 없습니다'); return }
    if (options.length > 0 && !selectedOption) { showToast('옵션을 선택해 주세요'); return }
    // 바로구매도 장바구니에 같이 담아 헤더 카트 배지 숫자가 즉시 반영되게 함(전환율 개선,
    // 2026-08-23 대표님 지시) + 결제 중단 시 상품이 장바구니에 남아있는 부가효과.
    // 이미 장바구니에 같은 상품이 있으면 수량이 합산되는데, 결제 완료 시 이 cart_item_id
    // 행 전체가 삭제되므로 "장바구니에 미리 담아둔 수량"과 "지금 바로구매하는 수량"이 겹치는
    // 극히 드문 경우엔 장바구니의 기존 수량까지 함께 삭제된다(알려진 한계, 낮은 우선순위).
    const optionLabel = selectedOption || null
    const { cartItemId } = await addToCart(id, quantity, optionLabel)
    // 비회원 구매 허용(2026-08-18) — 로그인 없이 바로 주문서로 (장바구니·찜은 회원 전용 유지)
    navigate('/app/order', {
      state: {
        items: [
          {
            product_id: id,
            name: view.name,
            price: view.price,
            quantity,
            thumbnail: view.images[0] ?? null,
            cart_item_id: cartItemId,
            option_label: optionLabel,
          },
        ],
      },
    })
  }

  const onAddToCart = async () => {
    if (!isDbProduct || !id) { showToast('목데이터 상품은 담을 수 없습니다'); return }
    if (options.length > 0 && !selectedOption) { showToast('옵션을 선택해 주세요'); return }
    // 장바구니는 로그인 없이 담을 수 있다(게스트 장바구니). 로그인은 결제 시점에만.
    const { error } = await addToCart(id, quantity, selectedOption || null)
    showToast(error ? '장바구니 담기에 실패했습니다' : '장바구니에 담았습니다')
  }

  const toggleWish = async () => {
    if (!isDbProduct || !id) return
    if (!(await requireLogin())) return
    const next = !wished
    setWished(next)
    if (next) {
      const { error } = await addWish(id)
      if (error) setWished(!next)
    } else {
      await removeWish(id)
    }
  }

  if (isDesktop) {
    return (
      <>
        <ViewModeToggle mode={mode} onToggle={toggle} />
        <DesktopProductDetail
          id={id}
          view={view}
          discountRate={discountRate}
          quantity={quantity}
          setQuantity={setQuantity}
          maxQty={maxQty}
          total={total}
          wished={wished}
          toggleWish={toggleWish}
          options={options}
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          onBuy={onBuy}
          onAddToCart={onAddToCart}
          rewardRate={rewardRate}
        />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-quiet md:py-6">
    <ViewModeToggle mode={mode} onToggle={toggle} />
    <div
      className="max-w-[480px] mx-auto bg-paper min-h-screen md:min-h-0 md:border md:border-rule"
      style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom))' }}
    >
      <BackHeader
        rightElement={
          <div className="flex items-center gap-3 text-ink">
            <div className="relative">
              <button onClick={() => setShareOpen((v) => !v)} aria-label="공유" className="focus:outline-none focus-visible:shadow-ring flex items-center">
                <IconSend2 size={21} />
              </button>
              {shareCopied && (
                <span className="absolute right-0 top-9 whitespace-nowrap bg-ink text-paper text-[11px] px-2.5 py-1 rounded-md z-50">
                  링크를 복사했어요
                </span>
              )}
              {shareOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />
                  <div className="absolute right-0 top-9 z-50 bg-white rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.25)] p-2.5 flex items-center gap-2">
                    <button type="button" onClick={() => void copyShareLink()} aria-label="카카오톡 공유(링크 복사)" className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#FEE500' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="rgba(0,0,0,0.85)" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.85C22 6.54 17.52 3 12 3z" />
                      </svg>
                    </button>
                    <button type="button" onClick={shareToFacebook} aria-label="페이스북 공유" className="w-11 h-11 rounded-full bg-[#1877F2] flex items-center justify-center shrink-0">
                      <IconBrandFacebook size={20} className="text-white" />
                    </button>
                    <button type="button" onClick={shareToX} aria-label="X 공유" className="w-11 h-11 rounded-full bg-black flex items-center justify-center shrink-0">
                      <IconBrandX size={18} className="text-white" />
                    </button>
                    <button type="button" onClick={() => void copyShareLink()} aria-label="링크 복사" className="w-11 h-11 rounded-full bg-quiet flex items-center justify-center shrink-0">
                      <IconLink size={18} className="text-ink" />
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={toggleWish} aria-label={wished ? '찜 해제' : '찜하기'} className="focus:outline-none focus-visible:shadow-ring">
              <IconHeart filled={wished} className={`w-[22px] h-[22px] ${wished ? 'text-accent' : ''}`} />
            </button>
            <button onClick={() => navigate('/app/cart')} aria-label="장바구니" className="relative focus:outline-none focus-visible:shadow-ring">
              <IconCart />
              <CartCountBadge />
            </button>
          </div>
        }
      />

      {/* 상단 고정 카테고리 바 (스크롤해도 헤더 아래에 고정) */}
      <CategoryTabBar active={view.category} />

      {/* 다른 /app/* 페이지와 동일하게 항상 480px 단일 컬럼 (데스크톱 전용 2컬럼 레이아웃 폐기) */}
      {view.images.length > 0 ? (
        <div className="px-4 pt-4">
          <div className="aspect-square max-h-[560px] rounded-card bg-quiet flex items-center justify-center overflow-hidden">
            <Thumb
              src={view.images[Math.min(activeImg, view.images.length - 1)]}
              alt={view.name}
              size={800}
              loading="eager"
              className="w-full h-full object-contain"
            />
          </div>
          {view.images.length > 1 && (
            <div className="flex justify-center gap-1.5 pt-3">
              {view.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`h-[6px] rounded-pill transition-all focus:outline-none focus-visible:shadow-ring ${i === activeImg ? 'w-6 bg-accent' : 'w-[6px] bg-rule'}`}
                  aria-label={`${i + 1}번째 이미지`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <ImagePlaceholder className="aspect-square w-full rounded-card" />
      )}

      <div className="px-4 pt-5 pb-4">
        {view.brand && (
          view.partnerId ? (
            <Link to={`/app/brand/${view.partnerId}`} className="text-[13px] text-ink-soft underline underline-offset-2">
              {view.brand}
            </Link>
          ) : (
            <p className="text-[13px] text-ink-soft">{view.brand}</p>
          )
        )}
        <h1 className="text-[18px] font-bold text-ink mt-1 leading-tight">{view.name}</h1>

        {/* 가격 */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[24px] font-bold tabular-nums text-ink">
            {view.price.toLocaleString('ko-KR')}원
          </span>
          {view.originalPrice && (
            <span className="text-ink-faint text-[15px] tabular-nums line-through">
              {view.originalPrice.toLocaleString('ko-KR')}원
            </span>
          )}
          {discountRate > 0 && (
            <span className="rounded-pill bg-accent-lite px-2 py-0.5 text-[13px] font-bold tabular-nums text-accent-ink">
              -{discountRate}%
            </span>
          )}
        </div>

        {view.soldOut && (
          <p className="mt-2 inline-block text-[12px] font-bold tracking-[0.04em] text-paper bg-ink px-2.5 py-1">
            일시 품절
          </p>
        )}

        {/* 상품 정보 테이블 (적립금·브랜드·제조국·배송비) — 소비자가/판매가는 위 가격 표시로 대체 */}
        <ProductInfoTable
          consumerPrice={view.originalPrice ?? view.price}
          salePrice={view.price}
          brand={view.brand || undefined}
          partnerId={view.partnerId}
          showPrice={false}
          rewardRate={rewardRate}
          className="mt-4"
        />

        {/* 옵션 선택 (색상 등) — 있는 상품만 노출, 선택 전엔 담기/구매 불가 */}
        {options.length > 0 && (
          <div className="mt-5 pt-4 border-t border-rule">
            <label htmlFor="product-option" className="text-[14px] font-bold text-ink block mb-2">옵션</label>
            <select
              id="product-option"
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              className="w-full rounded-control bg-paper border border-rule px-3.5 py-3 text-[14px] text-ink focus:outline-none focus-visible:shadow-ring"
            >
              <option value="">옵션을 선택해 주세요</option>
              {options.map((o) => (
                <option key={o.id} value={o.label} disabled={!o.in_stock}>
                  {o.label}{!o.in_stock ? ' (품절)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 수량 선택 */}
        <div className="mt-5 flex items-center justify-between py-4 border-t border-b border-rule">
          <span className="text-[14px] font-bold text-ink">수량</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-9 h-9 rounded-pill border border-rule flex items-center justify-center text-ink disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
              aria-label="수량 감소"
              disabled={quantity <= 1 || view.soldOut}
            >
              <IconMinus className="w-4 h-4" />
            </button>
            <span className="text-[16px] font-bold tabular-nums text-ink w-6 text-center" aria-live="polite">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
              className="w-9 h-9 rounded-pill border border-rule flex items-center justify-center text-ink disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
              aria-label="수량 증가"
              disabled={quantity >= maxQty || view.soldOut}
            >
              <IconPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 배송 안내 */}
        <p className="text-[12px] text-ink-faint mt-3">{SHIPPING_NOTICE}</p>
      </div>

      {/* 상세정보 / 리뷰 / 결제·배송·교환·반품정보 / 상품문의 — 4탭 통합 (PG 심사 대응,
          브랜드 자사몰 참고 구조). 배송/교환/환불 규정은 전자상거래법상 상품마다 상시
          고지해야 하므로 갤러리 이미지 유무와 무관하게 항상 노출한다. */}
      <div className="border-t border-rule">
        <div className="flex justify-between border-b border-rule">
          {[
            '상세정보',
            `리뷰 (${(view.reviewSummary?.count ?? 0).toLocaleString('ko-KR')})`,
            '결제/배송/교환·반품정보',
            `상품문의 (${qnaQuestions.length.toLocaleString('ko-KR')})`,
          ].map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`shrink-0 px-2 py-3 text-[12px] font-bold text-center whitespace-nowrap relative focus:outline-none focus-visible:shadow-ring ${activeTab === i ? 'text-ink' : 'text-ink-faint'}`}
              aria-pressed={activeTab === i}
            >
              {tab}
              {activeTab === i && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-ink" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>

        {activeTab === 0 && (
          <div>
            <div className="px-4 py-5 text-[13px] text-ink-soft leading-relaxed">
              <p>{view.description ?? `${view.brand} ${view.name} 상품입니다.`}</p>
            </div>
            <ProductInfoNotice info={view} />
            {view.detailImages.length > 0 && (
              <div>
                {view.detailImages.map((url, i) => (
                  <img key={i} src={url} alt={`상세 이미지 ${i + 1}`} loading="lazy" className="w-full h-auto block" />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 1 && <ReviewSummary summary={view.reviewSummary} productId={id} />}

        {activeTab === 2 && (
          <div className="px-4 py-5 text-[13px] text-ink-soft leading-relaxed space-y-2">
            <p>• 결제수단: 신용카드</p>
            <p>• 배송기간: 주문 후 1~2 영업일 출고</p>
            <p>• {SHIPPING_NOTICE}</p>
            <p>• 주문취소: 상품 발송 전 마이페이지 또는 고객센터를 통해 즉시 취소 가능</p>
            <p>• 교환/반품: 상품 수령 후 7일 이내 가능 (단순 변심 시 왕복 배송비 고객 부담, 개봉·사용한 상품은 제한될 수 있음)</p>
            <p>• 환불: 반품 상품 확인 후 3영업일 이내 결제수단으로 환급</p>
          </div>
        )}

        {activeTab === 3 && id && <ProductQnA productId={id} />}
      </div>

      {/* 맨 위로 버튼 (긴 상세페이지 스크롤 시 노출, 하단 구매 바 위에 배치) */}
      <ScrollToTopButton />

      {/* 하단 sticky 구매 바 (하단 네비 바로 위에 쌓임, 모든 화면 폭에서 동일) */}
      <div
        className="fixed left-0 right-0 z-40"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-[480px] mx-auto bg-paper border-t border-rule px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="shrink-0">
              <p className="text-[10px] text-ink-faint leading-none mb-0.5">수량 {quantity}</p>
              <p className="text-[15px] font-bold tabular-nums text-ink leading-none">{total.toLocaleString('ko-KR')}원</p>
            </div>
            <button
              onClick={toggleWish}
              aria-label={wished ? '찜 해제' : '찜하기'}
              className="shrink-0 rounded-pill border border-rule text-ink px-3.5 py-3 focus:outline-none focus-visible:shadow-ring"
            >
              <IconHeart filled={wished} className={`w-5 h-5 ${wished ? 'text-accent' : ''}`} />
            </button>
            <button
              onClick={onAddToCart}
              disabled={view.soldOut || (options.length > 0 && !selectedOption)}
              className="shrink-0 rounded-pill border border-rule text-ink font-bold text-[13px] px-4 py-3 disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
              aria-label="장바구니 담기"
            >
              <IconCart className="w-5 h-5" />
            </button>
            <button
              onClick={onBuy}
              disabled={view.soldOut || (options.length > 0 && !selectedOption)}
              className="flex-1 rounded-pill bg-accent text-paper font-bold text-[14px] py-3 disabled:opacity-40 focus:outline-none focus-visible:shadow-ring"
            >
              {view.soldOut ? '일시 품절' : options.length > 0 && !selectedOption ? '옵션을 선택해 주세요' : '구매하기'}
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-control bg-ink text-paper text-[13px] px-4 py-2.5">
          {toast}
        </div>
      )}

      <BottomNav />
    </div>
    </div>
  )
}
