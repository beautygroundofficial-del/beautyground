import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppFrame from '../../components/layout/AppFrame'
import BackHeader from '../../components/layout/BackHeader'
import PartnersGate from '../../components/partners/PartnersGate'
import BestProductRow from '../../components/partners/BestProductRow'
import { listBestProducts, type BestProduct } from '../../lib/affiliate'

const PAGE = 30

// 잘 팔리는 제품 전체 — 판매 순. 개인 파트너스 페이지의 TOP 10 [더보기]에서 들어온다.
export default function AppPartnersBest() {
  const navigate = useNavigate()
  const [items, setItems] = useState<BestProduct[]>([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const busy = useRef(false) // 개발모드 이중 실행·연타로 같은 페이지가 두 번 붙는 것 방지
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200) }

  const loadMore = async () => {
    if (busy.current || done) return
    busy.current = true
    setLoading(true)
    const next = await listBestProducts(PAGE, items.length)
    setItems((prev) => {
      const seen = new Set(prev.map((x) => x.id))
      return [...prev, ...next.filter((x) => !seen.has(x.id))]
    })
    if (next.length < PAGE) setDone(true)
    setLoading(false)
    busy.current = false
  }
  useEffect(() => { void loadMore() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PartnersGate title="잘 팔리는 제품">
      {() => (
        <AppFrame>
          <BackHeader title="잘 팔리는 제품" onBack={() => navigate('/app/partners/home')} />
          <section className="px-5 pt-4 pb-10">
            <p className="text-[12px] text-ink-faint mb-1">최근 90일 판매 순 · [내 링크]를 누르면 바로 만들어지고 복사돼요</p>
            <ul className="divide-y divide-rule">
              {items.map((p) => <BestProductRow key={p.id} p={p} onToast={showToast} />)}
            </ul>
            {!done && (
              <button type="button" onClick={() => void loadMore()} disabled={loading}
                className="mt-4 w-full rounded-control border border-rule text-ink text-[13.5px] font-semibold py-3 disabled:opacity-50">
                {loading ? '불러오는 중…' : '더보기'}
              </button>
            )}
          </section>
          {toast && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>}
        </AppFrame>
      )}
    </PartnersGate>
  )
}
