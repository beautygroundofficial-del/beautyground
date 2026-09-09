import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { mergeGuestCartToServer } from './lib/cart'
import { logVisitOnce, syncAttributionToUser } from './lib/attribution'

// 페이지 전체를 React.lazy로 분리한다 — 예전엔 관리자·브랜드·백화점·호스트 포털까지
// 60여 개 페이지가 전부 하나의 JS 번들(1MB+)로 묶여, 홈 화면 첫 방문자도 이 전부를
// 내려받은 뒤에야 화면이 뜨는 구조였음. 모바일 4G 환경에서 번들 로딩만 2초 넘게 걸리는 게
// 확인돼(2026-08-21 실측), 실제 방문 라우트의 코드만 그때그때 받도록 분리(코드 스플리팅).
// 레이아웃/가드 컴포넌트(RequireAdmin 등)는 크기가 작아 그대로 즉시 로드한다.
const AppHome = lazy(() => import('./pages/AppHome'))
const CompanyIntro = lazy(() => import('./pages/CompanyIntro'))
const Export = lazy(() => import('./pages/Export'))
const ExportBrand = lazy(() => import('./pages/ExportBrand'))
const ExportBrands = lazy(() => import('./pages/ExportBrands'))
const ExportProduct = lazy(() => import('./pages/ExportProduct'))
const PartnerHub = lazy(() => import('./pages/PartnerHub'))
const PartnerHubList = lazy(() => import('./pages/PartnerHubList'))
const PartnerHubDetail = lazy(() => import('./pages/PartnerHubDetail'))
const AppCategory = lazy(() => import('./pages/AppCategory'))
const AppSearch = lazy(() => import('./pages/AppSearch'))
const AppCategoryDetail = lazy(() => import('./pages/AppCategoryDetail'))
const AppBrandDetail = lazy(() => import('./pages/AppBrandDetail'))
const AppHostFollow = lazy(() => import('./pages/AppHostFollow'))
const AppProductDetail = lazy(() => import('./pages/AppProductDetail'))
const AppProductReviews = lazy(() => import('./pages/AppProductReviews'))
const AppMyPage = lazy(() => import('./pages/AppMyPage'))
const AppCart = lazy(() => import('./pages/AppCart'))
const AppOrder = lazy(() => import('./pages/AppOrder'))
const AppOrders = lazy(() => import('./pages/AppOrders'))
const StaffPurchase = lazy(() => import('./pages/StaffPurchase'))
const AppGuestOrder = lazy(() => import('./pages/AppGuestOrder'))
const AppLogin = lazy(() => import('./pages/AppLogin'))
const AppSignup = lazy(() => import('./pages/AppSignup'))
const AppNaverCallback = lazy(() => import('./pages/AppNaverCallback'))
const AppAccount = lazy(() => import('./pages/AppAccount'))
const AppAddresses = lazy(() => import('./pages/AppAddresses'))
const AppWishlist = lazy(() => import('./pages/AppWishlist'))
const AppRecentlyViewed = lazy(() => import('./pages/AppRecentlyViewed'))
const AppMyReviews = lazy(() => import('./pages/AppMyReviews'))
const AppBenefits = lazy(() => import('./pages/AppBenefits'))
const AppMissions = lazy(() => import('./pages/AppMissions'))
const AppTodayActivity = lazy(() => import('./pages/AppTodayActivity'))
const AppDiary = lazy(() => import('./pages/AppDiary'))
const AppBoard = lazy(() => import('./pages/AppBoard'))
const AppBoardWrite = lazy(() => import('./pages/AppBoardWrite'))
const AppBoardPost = lazy(() => import('./pages/AppBoardPost'))
const AppSkinTest = lazy(() => import('./pages/AppSkinTest'))

// 법적 고지
const Terms = lazy(() => import('./pages/legal/Terms'))
const Privacy = lazy(() => import('./pages/legal/Privacy'))
const Company = lazy(() => import('./pages/legal/Company'))

// 관리자 — 매입 후 직접 판매하는 구조라 브랜드사가 직접 관리하는 파트너센터는 없음(2026-08-08 폐지)
import RequireAdmin from './components/admin/RequireAdmin'
import AdminLayout from './components/admin/AdminLayout'
const AdminHome = lazy(() => import('./pages/admin/Home'))
const AdminHosts = lazy(() => import('./pages/admin/Hosts'))
const AdminCommissionTiers = lazy(() => import('./pages/admin/CommissionTiers'))
const AdminHostSettlements = lazy(() => import('./pages/admin/HostSettlements'))
const AdminPartners = lazy(() => import('./pages/admin/Partners'))
const AdminPartnerSettlements = lazy(() => import('./pages/admin/PartnerSettlements'))
const AdminDeptAccounts = lazy(() => import('./pages/admin/DeptAccounts'))
const AdminMembers = lazy(() => import('./pages/admin/Members'))
const AdminOrders = lazy(() => import('./pages/admin/Orders'))
const AdminShipping = lazy(() => import('./pages/admin/Shipping'))
const AdminProducts = lazy(() => import('./pages/admin/Products'))
const AdminLives = lazy(() => import('./pages/admin/Lives'))
// 방송 지원(운영) 화면 — 진행자가 상품을 못 거는 링크 방식일 때 운영팀이 대신 상품을 걸고 채팅 응대한다.
const AdminLiveSupport = lazy(() => import('./pages/admin/LiveSupport'))
const AdminCoupons = lazy(() => import('./pages/admin/Coupons'))
const AdminCouponGenerator = lazy(() => import('./pages/admin/CouponGenerator'))
const AdminMissions = lazy(() => import('./pages/admin/Missions'))
const AdminDailyQuestions = lazy(() => import('./pages/admin/DailyQuestions'))
const AdminMonthlyPicks = lazy(() => import('./pages/admin/MonthlyPicks'))
const AdminExportInquiries = lazy(() => import('./pages/admin/ExportInquiries'))
const AdminExportBuyers = lazy(() => import('./pages/admin/ExportBuyers'))
const AdminPartnerHubPosts = lazy(() => import('./pages/admin/PartnerHubPosts'))
const AdminMarketing = lazy(() => import('./pages/admin/Marketing'))
const AdminTheme = lazy(() => import('./pages/admin/Theme'))
import { useMallTheme } from './hooks/useMallTheme'

// 진행자(라이브 호스트) 인증/전용 (RequireHostAuth + RequireHost + HostLayout)
const HostRegister = lazy(() => import('./pages/host/Register'))
const HostLogin = lazy(() => import('./pages/host/Login'))
import RequireHostAuth from './components/host/RequireHostAuth'
import RequireHost from './components/host/RequireHost'
import HostLayout from './components/host/HostLayout'
const HostDashboard = lazy(() => import('./pages/host/Dashboard'))
const HostLives = lazy(() => import('./pages/host/Lives'))
const HostLiveSales = lazy(() => import('./pages/host/LiveSales'))
const HostSettlementPage = lazy(() => import('./pages/host/Settlement'))
const HostProfile = lazy(() => import('./pages/host/Profile'))
const HostGoLive = lazy(() => import('./pages/host/GoLive'))

// 브랜드사(파트너) 읽기 전용 포털 (RequireBrandAuth + RequireBrand + BrandLayout)
const BrandLogin = lazy(() => import('./pages/brand/Login'))
const BrandOnboarding = lazy(() => import('./pages/brand/Onboarding'))
const BrandRegister = lazy(() => import('./pages/brand/Register'))
const BrandExportRegister = lazy(() => import('./pages/brand/ExportRegister'))
import RequireBrandAuth from './components/brand/RequireBrandAuth'
import RequireBrand from './components/brand/RequireBrand'
import RequireBrandOrExportContact from './components/brand/RequireBrandOrExportContact'
import BrandLayout from './components/brand/BrandLayout'
const BrandDashboard = lazy(() => import('./pages/brand/Dashboard'))
const BrandProducts = lazy(() => import('./pages/brand/Products'))
const BrandLiveSales = lazy(() => import('./pages/brand/LiveSales'))
const BrandSettlement = lazy(() => import('./pages/brand/Settlement'))
const BrandExport = lazy(() => import('./pages/brand/Export'))

// 백화점 담당자 포털 (RequireDeptAuth + RequireDept) — 2026-08-15: 코드 게이트 대신 지점별 계정 로그인
const DeptLogin = lazy(() => import('./pages/dept/Login'))
const DeptRegister = lazy(() => import('./pages/dept/Register'))
import RequireDeptAuth from './components/dept/RequireDeptAuth'
import RequireDept from './components/dept/RequireDept'
const DeptSales = lazy(() => import('./pages/dept/Sales'))
const DeptLives = lazy(() => import('./pages/dept/Lives'))

// 구매자 라이브 (Supabase 연동)
const LiveMain = lazy(() => import('./pages/LiveMain'))
const LiveSchedule = lazy(() => import('./pages/LiveSchedule'))
const LiveSale = lazy(() => import('./pages/LiveSale'))
const ShopLiveWatch = lazy(() => import('./pages/app/ShopLiveWatch'))
import LiveGate from './components/app/LiveGate'
import ScrollRestoration from './components/layout/ScrollRestoration'

export default function App() {
  // 홈 테마(시그널 3색) — /admin/theme 저장값 또는 ?themePreview= 값을 CSS 변수로 적용
  useMallTheme()

  // 신규 가입 환영 안내 — 카카오 OAuth는 콜백 후 바로 앱으로 돌아와 "가입이 된 건지" 알 수 없다는
  // 매장 직원 피드백(2026-08-13)으로 추가. 계정 생성 5분 이내의 첫 SIGNED_IN에서 1회만 노출.
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null)

  // 로그인 시(카카오 포함) 게스트 장바구니를 서버 장바구니로 합친다.
  // 게스트 카트가 비어있으면 no-op이라 SIGNED_IN이 여러 번 떠도 안전.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        void mergeGuestCartToServer()
        void syncAttributionToUser()

        const user = session?.user
        if (user?.created_at) {
          const isNew = Date.now() - new Date(user.created_at).getTime() < 5 * 60 * 1000
          const shownKey = `bg_welcome_shown:${user.id}`
          if (isNew && !localStorage.getItem(shownKey)) {
            localStorage.setItem(shownKey, '1')
            setWelcomeToast('회원가입이 완료되었습니다. 환영합니다! 🎉')
            setTimeout(() => setWelcomeToast(null), 4000)
          }
        }
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // 유입경로 방문 로그 — 광고/검색/SNS 어디서 들어왔는지 최초 1회 기록(마케팅 센터에서 집계).
  useEffect(() => { void logVisitOnce() }, [])

  return (
    <BrowserRouter>
      <ScrollRestoration />
      {welcomeToast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 top-5 z-[100] rounded-pill bg-ink text-paper text-[14px] font-bold px-5 py-3 shadow-card"
          role="status"
        >
          {welcomeToast}
        </div>
      )}
      <Suspense fallback={null}>
      <Routes>
        {/* 메인 = 소비자 쇼핑 홈. /partners·/proposal(예전 "입점 브랜드 모집" B2B 랜딩페이지)은
            매입 후 직접 판매하는 구조로 확정되며 완전 삭제(2026-08-10) — PG(NHN KCP) 심사에서
            "중개플랫폼"으로 오인되는 근거가 될 수 있었음. */}
        <Route path="/" element={<AppHome />} />
        <Route path="/company" element={<CompanyIntro />} />
        {/* 해외 바이어용 영문 카탈로그+문의 페이지 — beautyground가 직접 수출자(재판매자)로서
            보유 브랜드를 제안하는 채널. 브랜드 입점신청(중개 성격)과는 다름(2026-08-15).
            /export/products(전체 상품)·/export/products/:id(상세)는 2026-08-16 추가 —
            아몬드뷰티(aamondbeauty.com) 상품상세 구조를 참고해 순서 재구성. */}
        <Route path="/export" element={<Export />} />
        <Route path="/export/brands" element={<ExportBrands />} />
        {/* 브랜드별 수출 미니페이지 — 브랜드가 가입해 수출 프로필을 채운 경우에만 열림(틀만 제공 원칙).
            구 상세 틀(/export/products·/export/brands, 아몬드뷰티 참고 구조)은 혼동 방지 위해 2026-08-17 삭제(대표님 지시) — git 이력에 보존됨 */}
        <Route path="/x/:key" element={<ExportBrand />} />
        {/* 상품 단위 수출 상세 — /x/:key 하위 중첩(별도 독립 라우트가 아님, 2026-08-25 확정).
            가격·MOQ·스펙 없음, 갤러리·설명은 온라인몰 products 데이터 재사용, Inquire는 /export 문의폼 프리필로 연결 */}
        <Route path="/x/:key/products/:productId" element={<ExportProduct />} />
        {/* 브랜드 파트너 허브(2026-08-24) — 입점·비입점 브랜드 누구나 로그인 없이 열람하는 정보
            페이지(정부지원사업/백화점 입점/브랜드 운영정보 + /export 링크). 신청·입점 폼이 전혀
            없는 일방향 정보 제공 페이지라, 2026-08-10에 PG 심사에서 "중개플랫폼"으로 오인되어
            삭제된 옛 /partners·/proposal("입점 브랜드 모집", 신청 폼이 있었음)과는 이름만 같고
            성격이 다르다 — 헷갈리지 말 것. */}
        <Route path="/partners" element={<PartnerHub />} />
        <Route path="/partners/:category" element={<PartnerHubList />} />
        <Route path="/partners/:category/:id" element={<PartnerHubDetail />} />

        {/* 직원 전용 구매 — 로그인 + 직원 등급(app_staff)일 때만 접근, 카드결제 없이 무통장입금 전용.
            2026-08-19 비밀 링크(/staff/:key)로 시작 → 2026-08-20 회원등급 방식으로 전환(관리자 회원관리에서 지정) */}
        <Route path="/app/staff-buy" element={<StaffPurchase />} />

        {/* 법적 고지 */}
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/about" element={<Company />} />

        {/* 관리자 (매입 후 직접 판매 구조라 브랜드사가 상품/방송을 직접 등록하는 파트너센터는 없음 — 2026-08-08 폐지.
            단 브랜드가 자기 판매실적·정산만 읽기 전용으로 보는 /brand/* 포털은 별도로 존재 — 아래 참조) */}
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/home" element={<AdminHome />} />
            <Route path="/admin/hosts" element={<AdminHosts />} />
            <Route path="/admin/commission-tiers" element={<AdminCommissionTiers />} />
            <Route path="/admin/host-settlements" element={<AdminHostSettlements />} />
            <Route path="/admin/partners" element={<AdminPartners />} />
            <Route path="/admin/partner-settlements" element={<AdminPartnerSettlements />} />
            <Route path="/admin/dept-accounts" element={<AdminDeptAccounts />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/shipping" element={<AdminShipping />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/lives" element={<AdminLives />} />
            <Route path="/admin/lives/:id/support" element={<AdminLiveSupport />} />
            <Route path="/admin/coupons" element={<AdminCoupons />} />
            <Route path="/admin/coupon-generator" element={<AdminCouponGenerator />} />
            <Route path="/admin/missions" element={<AdminMissions />} />
            <Route path="/admin/daily-questions" element={<AdminDailyQuestions />} />
            <Route path="/admin/monthly-picks" element={<AdminMonthlyPicks />} />
            <Route path="/admin/export-inquiries" element={<AdminExportInquiries />} />
            <Route path="/admin/export-buyers" element={<AdminExportBuyers />} />
            <Route path="/admin/partner-hub-posts" element={<AdminPartnerHubPosts />} />
            <Route path="/admin/marketing" element={<AdminMarketing />} />
            <Route path="/admin/theme" element={<AdminTheme />} />
          </Route>
        </Route>

        {/* 진행자(라이브 호스트): 회원가입 → 승인 → 로그인.
            라이브커머스를 온라인몰과 분리해 공개 노출하지 않기로 해(2026-07-31)
            링크가 없어도 직접 URL로 열리던 이 두 페이지도 관리자 전용으로 막음. */}
        <Route path="/host/register" element={<LiveGate><HostRegister /></LiveGate>} />
        <Route path="/host/login" element={<LiveGate><HostLogin /></LiveGate>} />

        {/* 진행자 섭외용 전용 링크 — 접근 코드 없이 바로 회원가입 화면으로.
            대표님이 섭외 대상에게 직접 이 링크를 보내는 용도(2026-08-26). */}
        <Route path="/host/join" element={<HostRegister />} />

        {/* 링크 하나로 방송 송출(2026-08-20) — 계정 없이 lives.host_token 링크만으로 접근.
            토큰 자체가 인증 수단이라 LiveGate로 한 번 더 감싸지 않음(불필요한 마찰). */}
        <Route path="/host/go/:token" element={<HostGoLive />} />

        <Route element={<RequireHostAuth />}>
          {/* RequireHost: 로그인만으로는 일반 고객도 URL 직접입력으로 페이지 껍데기가 열렸기에,
              hosts 테이블에 실제 본인 레코드가 있는지 한 번 더 확인 (2026-08-03 추가) */}
          <Route element={<RequireHost />}>
            <Route element={<HostLayout />}>
              <Route path="/host/dashboard" element={<HostDashboard />} />
              <Route path="/host/lives" element={<HostLives />} />
              <Route path="/host/live/:id" element={<HostLiveSales />} />
              <Route path="/host/settlement" element={<HostSettlementPage />} />
              <Route path="/host/profile" element={<HostProfile />} />
            </Route>
          </Route>
        </Route>

        {/* 브랜드사(파트너) — 읽기 전용 포털. 상품/방송 등록 권한은 없음(그건 폐지된 파트너센터의
            영역), 자기 라이브 판매실적·정산만 조회(2026-08-15). 자체 회원가입 없음 — 계정은
            관리자가 /admin/partners에서 이메일로 연결.
            /brand/export는 판매 파트너 계정뿐 아니라 "수출 전용 계정"(export_contacts)도 접근
            가능 — 단, 수출 전용 계정은 대시보드/판매내역/정산내역(RequireBrand, 판매 파트너만)에는
            접근할 수 없다(2026-08-16, 라이브 판매실적 비공개 원칙). */}
        <Route path="/brand/login" element={<BrandLogin />} />
        {/* OTP 첫 로그인 계정의 새 브랜드 생성(셀프 가입) — pending 상태로 생성, 관리자 승인 후 공개 */}
        <Route path="/brand/onboarding" element={<BrandOnboarding />} />
        <Route path="/brand/register/:id" element={<BrandRegister />} />
        <Route path="/brand/export-register/:id" element={<BrandExportRegister />} />
        <Route element={<RequireBrandAuth />}>
          <Route element={<BrandLayout />}>
            <Route element={<RequireBrand />}>
              <Route path="/brand/dashboard" element={<BrandDashboard />} />
              <Route path="/brand/products" element={<BrandProducts />} />
              <Route path="/brand/sales" element={<BrandLiveSales />} />
              <Route path="/brand/settlement" element={<BrandSettlement />} />
            </Route>
            <Route element={<RequireBrandOrExportContact />}>
              <Route path="/brand/export" element={<BrandExport />} />
            </Route>
          </Route>
        </Route>

        {/* 앱 UI */}
        <Route path="/app" element={<Navigate to="/app/home" replace />} />
        <Route path="/app/home" element={<AppHome />} />
        {/* 2026-08-12 대표님 지시로 재구축 — 젠스파크 디자인 기준, 실데이터 바로 연결.
            게이트 없이 공개(온라인몰 메인과 별개의 독립 진입점). */}
        <Route path="/live" element={<LiveMain />} />
        <Route path="/live/schedule" element={<LiveSchedule />} />
        <Route path="/live/sale" element={<LiveSale />} />
        {/* 백화점 지역 담당자용 — 지점별 계정 로그인(2026-08-15, 예전 코드 게이트 대체) */}
        <Route path="/dept/login" element={<DeptLogin />} />
        <Route path="/dept/register/:id" element={<DeptRegister />} />
        <Route path="/dept/register" element={<DeptRegister />} />
        <Route element={<RequireDeptAuth />}>
          <Route element={<RequireDept />}>
            <Route path="/dept/sales" element={<DeptSales />} />
            <Route path="/dept/lives" element={<DeptLives />} />
          </Route>
        </Route>
        <Route path="/app/live/:id" element={<ShopLiveWatch />} />
        <Route path="/app/category" element={<AppCategory />} />
        <Route path="/app/search" element={<AppSearch />} />
        <Route path="/app/category/:id" element={<AppCategoryDetail />} />
        <Route path="/app/brand/:id" element={<AppBrandDetail />} />
        <Route path="/app/host/:id/follow" element={<AppHostFollow />} />
        <Route path="/app/product/:id" element={<AppProductDetail />} />
        <Route path="/app/product/:id/reviews" element={<AppProductReviews />} />
        <Route path="/app/mypage" element={<AppMyPage />} />
        <Route path="/app/cart" element={<AppCart />} />
        <Route path="/app/order" element={<AppOrder />} />
        <Route path="/app/orders" element={<AppOrders />} />
        <Route path="/app/guest-order" element={<AppGuestOrder />} />
        <Route path="/app/login" element={<AppLogin />} />
        <Route path="/app/signup" element={<AppSignup />} />
        {/* 이메일 가입 버튼은 뺐지만(2026-08-15, 카카오만 신규가입), URL 직접 접근으로
            새 이메일 계정이 만들어지는 뒷문을 막기 위해 라우트 자체를 리다이렉트 —
            AppSignupEmail.tsx 코드는 나중에 되살릴 수 있게 남겨둠. */}
        <Route path="/app/signup/email" element={<Navigate to="/app/signup" replace />} />
        <Route path="/app/auth/naver/callback" element={<AppNaverCallback />} />
        <Route path="/app/account" element={<AppAccount />} />
        <Route path="/app/addresses" element={<AppAddresses />} />
        <Route path="/app/wishlist" element={<AppWishlist />} />
        <Route path="/app/recently-viewed" element={<AppRecentlyViewed />} />
        <Route path="/app/my-reviews" element={<AppMyReviews />} />
        <Route path="/app/benefits" element={<AppBenefits />} />
        <Route path="/app/missions" element={<AppMissions />} />
        <Route path="/app/today" element={<AppTodayActivity />} />
        <Route path="/app/diary" element={<AppDiary />} />
        <Route path="/app/board" element={<AppBoard />} />
        <Route path="/app/board/write" element={<AppBoardWrite />} />
        <Route path="/app/board/:id" element={<AppBoardPost />} />
        <Route path="/app/skin-test" element={<AppSkinTest />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
