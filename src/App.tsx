import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import WebHome from './pages/WebHome'
import AppHome from './pages/AppHome'
import AppLiveList from './pages/AppLiveList'
import AppLiveDetail from './pages/AppLiveDetail'
import AppCategory from './pages/AppCategory'
import AppCategoryDetail from './pages/AppCategoryDetail'
import AppBrandDetail from './pages/AppBrandDetail'
import AppProductDetail from './pages/AppProductDetail'
import AppMyPage from './pages/AppMyPage'
import AppCart from './pages/AppCart'
import AppOrder from './pages/AppOrder'
import PartnerRegister from './pages/PartnerRegister'
import PartnerApplyComplete from './pages/PartnerApplyComplete'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 웹 홈페이지 */}
        <Route path="/" element={<WebHome />} />

        {/* 입점 신청 */}
        <Route path="/partner/register" element={<PartnerRegister />} />
        <Route path="/partner/apply/complete" element={<PartnerApplyComplete />} />

        {/* 앱 UI */}
        <Route path="/app/home" element={<AppHome />} />
        <Route path="/app/live" element={<AppLiveList />} />
        <Route path="/app/live/:id" element={<AppLiveDetail />} />
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
