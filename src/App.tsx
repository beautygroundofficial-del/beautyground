import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import WebHome from './pages/WebHome'
import AppHome from './pages/AppHome'
import AppCategory from './pages/AppCategory'
import AppCategoryDetail from './pages/AppCategoryDetail'
import AppBrandDetail from './pages/AppBrandDetail'
import AppProductDetail from './pages/AppProductDetail'
import AppMyPage from './pages/AppMyPage'
import AppCart from './pages/AppCart'
import AppOrder from './pages/AppOrder'

// 파트너 인증/입점
import PartnerRegister from './pages/partner/Register'
import PartnerLogin from './pages/partner/Login'
import PartnerApply from './pages/partner/Apply'
import PartnerApplyComplete from './pages/partner/ApplyComplete'

// 파트너 전용 (RequireAuth + PartnerLayout)
import RequireAuth from './components/partner/RequireAuth'
import PartnerLayout from './components/partner/PartnerLayout'
import PartnerDashboard from './pages/partner/Dashboard'
import PartnerProducts from './pages/partner/Products'
import ProductForm from './pages/partner/ProductForm'
import PartnerLives from './pages/partner/Lives'
import LiveForm from './pages/partner/LiveForm'
import LiveDetail from './pages/partner/LiveDetail'
import PartnerOrders from './pages/partner/Orders'
import PartnerSettlement from './pages/partner/Settlement'
import PartnerProfile from './pages/partner/Profile'

// 관리자
import AdminApplications from './pages/admin/Applications'

// 구매자 라이브 (Supabase 연동)
import ShopLiveList from './pages/app/ShopLiveList'
import ShopLiveWatch from './pages/app/ShopLiveWatch'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 웹 홈페이지 */}
        <Route path="/" element={<WebHome />} />

        {/* 입점: 회원가입 → 신청 → 완료 */}
        <Route path="/partner/register" element={<PartnerRegister />} />
        <Route path="/partner/login" element={<PartnerLogin />} />
        <Route path="/partner/apply" element={<PartnerApply />} />
        <Route path="/partner/apply/complete" element={<PartnerApplyComplete />} />

        {/* 파트너 전용 + 관리자 (로그인 필요) */}
        <Route element={<RequireAuth />}>
          <Route element={<PartnerLayout />}>
            <Route path="/partner/dashboard" element={<PartnerDashboard />} />
            <Route path="/partner/products" element={<PartnerProducts />} />
            <Route path="/partner/products/new" element={<ProductForm />} />
            <Route path="/partner/products/:id/edit" element={<ProductForm />} />
            <Route path="/partner/live" element={<PartnerLives />} />
            <Route path="/partner/live/new" element={<LiveForm />} />
            <Route path="/partner/live/:id" element={<LiveDetail />} />
            <Route path="/partner/orders" element={<PartnerOrders />} />
            <Route path="/partner/settlement" element={<PartnerSettlement />} />
            <Route path="/partner/profile" element={<PartnerProfile />} />
          </Route>
          <Route path="/admin/applications" element={<AdminApplications />} />
        </Route>

        {/* 앱 UI */}
        <Route path="/app/home" element={<AppHome />} />
        <Route path="/app/live" element={<ShopLiveList />} />
        <Route path="/app/live/:id" element={<ShopLiveWatch />} />
        <Route path="/app/category" element={<AppCategory />} />
        <Route path="/app/category/:id" element={<AppCategoryDetail />} />
        <Route path="/app/brand/:id" element={<AppBrandDetail />} />
        <Route path="/app/product/:id" element={<AppProductDetail />} />
        <Route path="/app/mypage" element={<AppMyPage />} />
        <Route path="/app/cart" element={<AppCart />} />
        <Route path="/app/order" element={<AppOrder />} />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
