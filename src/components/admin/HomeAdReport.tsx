import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Row {
  campaign_id: string; campaign_name: string; product_name: string; active: boolean
  starts_at: string; ends_at: string; impressions: number; popup_opens: number; product_clicks: number
}
const rate = (count: number, total: number) => total ? `${(count / total * 100).toFixed(1)}%` : '—'

export default function HomeAdReport() {
  const [days, setDays] = useState(7)
  const [version, setVersion] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    const to = new Date()
    void supabase.rpc('admin_home_ad_summary', { p_from: new Date(to.getTime() - days * 86400000).toISOString(), p_to: to.toISOString() }).then(({ data, error: failure }) => {
      if (!active) return
      setLoading(false)
      if (failure) { setRows([]); setError('광고 집계를 불러오지 못했습니다. 집계 기능 적용 여부와 관리자 권한을 확인해 주세요.'); return }
      setRows(data ?? [])
    })
    return () => { active = false }
  }, [days, version])
  const toggle = async (row: Row) => {
    setBusy(true); setError('')
    const { data, error: failure } = await supabase.from('home_ad_campaigns').update({ active: !row.active }).eq('id', row.campaign_id).select('id')
    setBusy(false)
    if (failure || !data?.length) { setError('광고 상태를 변경하지 못했습니다. 관리자 권한과 다른 진행 광고를 확인해 주세요.'); return }
    setVersion(value => value + 1)
  }
  const csv = () => {
    const escape = (value: unknown) => `"${String(value).replace(/^[=+@\-]/, "'$&").replace(/"/g, '""')}"`
    const lines = [['캠페인', '상품', '조회기간(최근 일)', '노출', '팝업열기', '상품클릭', '팝업열기율', '상품클릭률'], ...rows.map(row => [row.campaign_name, row.product_name, days, row.impressions, row.popup_opens, row.product_clicks, rate(row.popup_opens, row.impressions), rate(row.product_clicks, row.impressions)])]
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.map(line => line.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `home-ad-pilot-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="mb-8 rounded-lg border border-rule bg-paper p-5" aria-label="홈 상품 광고 집계">
    <h2 className="text-[20px] font-bold text-ink">홈 상품 광고 · 자체 테스트</h2>
    <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">주제별 이야기 아래 광고 카드 → 소개 팝업 → 상품 상세의 반응을 확인합니다.</p>
    <div className="my-4 flex flex-wrap gap-2">
      {[7, 30, 90].map(value => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={`min-h-11 rounded border border-rule px-3 text-[13px] ${days === value ? 'bg-ink text-paper' : 'text-ink'}`}>최근 {value}일</button>)}
      <button type="button" onClick={() => setVersion(value => value + 1)} className="min-h-11 rounded border border-rule px-3 text-[13px]">새로고침</button>
      <button type="button" onClick={csv} disabled={loading || !!error || !rows.length} className="min-h-11 rounded border border-rule px-3 text-[13px] disabled:opacity-40">CSV 다운로드</button>
    </div>
    {error && <p role="alert" className="mb-3 text-[13px] text-red-700">{error}</p>}
    {loading ? <p className="text-[14px]">불러오는 중…</p> : !error && rows.length === 0 ? <p className="text-[14px]">등록된 광고가 없습니다.</p> : rows.map(row => {
      const expired = new Date(row.ends_at).getTime() <= Date.now()
      return <div key={row.campaign_id} className="mb-4 rounded border border-rule p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{row.campaign_name}</h3><p className="mt-1 text-[13px] text-ink-soft">{row.product_name}</p><p className="mt-1 text-[12px] text-ink-soft">{new Date(row.starts_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} ~ {new Date(row.ends_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국 시간)</p></div><button type="button" disabled={busy || expired} onClick={() => void toggle(row)} className="min-h-11 rounded border border-rule px-3 text-[13px] disabled:opacity-40">{expired ? '기간 종료' : row.active ? '광고 중지' : '광고 재개'}</button></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">{[['노출', row.impressions], ['팝업 열기', row.popup_opens], ['상품 상세 클릭', row.product_clicks], ['팝업 열기율', rate(row.popup_opens, row.impressions)], ['상품 클릭률', rate(row.product_clicks, row.impressions)]].map(([label, value]) => <div key={label} className="rounded bg-quiet p-3"><dt className="text-[12px] text-ink-soft">{label}</dt><dd className="mt-1 text-[20px] font-bold">{value}</dd></div>)}</dl>
      </div>
    })}
    <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">노출: 카드가 화면에 절반 이상 1초 표시되거나 직접 눌린 경우. 동일 탭·한국 날짜·광고별 각 항목은 1회 집계하며, 로그인한 관리자와 로컬 미리보기는 제외합니다. 사람 수·전체 클릭 횟수와 다릅니다. 구매 전환·매출 기여·부정 트래픽 검증은 포함하지 않은 테스트 지표이며 광고비 정산용이 아닙니다.</p>
  </section>
}
