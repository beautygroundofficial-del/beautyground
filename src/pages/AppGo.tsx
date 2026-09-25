import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { storeAffiliateCode, trackAffiliateClick } from '../lib/affiliate'

// 링크 셀러 추적 링크 — /go/{code}
// 클릭을 기록하고 브라우저에 코드를 7일간 기억시킨 뒤 해당 상품 페이지로 보낸다.
// 코드가 없거나 정지된 셀러면 홈으로. (로그인 불필요)
export default function AppGo() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!code) { navigate('/app/home', { replace: true }); return }
      const productId = await trackAffiliateClick(code)
      if (!active) return
      if (!productId) { setFailed(true); setTimeout(() => navigate('/app/home', { replace: true }), 1500); return }
      storeAffiliateCode(code)
      navigate(`/app/product/${productId}`, { replace: true })
    })()
    return () => { active = false }
  }, [code, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <p className="text-[14px] text-ink-soft">{failed ? '유효하지 않은 링크예요. 홈으로 이동합니다.' : '상품으로 이동 중…'}</p>
    </div>
  )
}
