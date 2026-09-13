import { useEffect, useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { supabase } from '../../lib/supabase'
import Button from '../../components/common/Button'

// 관리자 쿠폰 생성기 — ERP 가격 쇼카드(브랜드·제품 선택→미리보기→인쇄)와 같은 흐름을
// "회원 대상 쿠폰(시크릿/월별 이벤트 등)" 에 맞게 적용: 조건 입력 → 배너 미리보기 →
// 이미지로 저장 + 대상 회원에게 일괄 발급 + 웹 푸시 발송까지 한 화면에서 처리한다.
// 백엔드: supabase/admin_coupon_generator.sql (coupon_templates/user_coupons 재사용,
// admin_create_coupon_template/admin_issue_coupon RPC), 발송은 api/live-input.ts(pushAction:'sendCoupon').

type CampaignType = 'secret' | 'event' | 'general'
type DiscountType = 'amount' | 'percent' | 'free_shipping'
type Target = 'all' | 'mall' | 'live' | 'self' | 'selected'

interface MemberRow {
  id: string
  email: string
  name: string
  mall_order_count: number
  live_order_count: number
}

const CAMPAIGN_TYPES: { key: CampaignType; label: string; badge: string }[] = [
  { key: 'secret', label: '시크릿 쿠폰', badge: 'SECRET' },
  { key: 'event', label: '월별 이벤트', badge: 'EVENT' },
  { key: 'general', label: '일반 쿠폰', badge: '쿠폰' },
]

const TARGETS: { key: Target; label: string }[] = [
  { key: 'self', label: '테스트(나에게만)' },
  { key: 'all', label: '전체 회원' },
  { key: 'mall', label: '쇼핑몰 구매 회원' },
  { key: 'live', label: '라이브 구매 회원' },
  { key: 'selected', label: '회원 선택' },
]

const inputCls =
  'w-full border border-rule rounded-control px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors bg-paper'
const lbl = 'block text-[12px] font-semibold text-ink-soft mb-1.5'
const card = 'bg-paper border border-rule p-6'

export default function AdminCouponGenerator() {
  const [campaignType, setCampaignType] = useState<CampaignType>('event')
  const [label, setLabel] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('amount')
  const [discountValue, setDiscountValue] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [minOrderAmount, setMinOrderAmount] = useState('0')
  const [expiresDays, setExpiresDays] = useState('30')
  const [target, setTarget] = useState<Target>('self')

  const [members, setMembers] = useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (target !== 'selected' || members.length > 0 || membersLoading) return
    setMembersLoading(true)
    supabase.rpc('admin_list_members').then(({ data, error }) => {
      if (!error) setMembers((data ?? []) as MemberRow[])
      setMembersLoading(false)
    })
  }, [target, members.length, membersLoading])

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => m.email?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))
  }, [members, memberQuery])

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ targeted: number; sent: number } | null>(null)

  const previewRef = useRef<HTMLDivElement>(null)
  const campaign = CAMPAIGN_TYPES.find((c) => c.key === campaignType)!

  const discountLabel = () => {
    if (discountType === 'free_shipping') return '무료배송'
    if (discountType === 'percent') return `${discountValue || 0}% 할인`
    return `${Number(discountValue || 0).toLocaleString()}원 할인`
  }

  const capturePng = async (): Promise<string> => {
    if (!previewRef.current) throw new Error('미리보기를 찾을 수 없습니다.')
    return toPng(previewRef.current, { pixelRatio: 2, cacheBust: true })
  }

  const handleDownload = async () => {
    setMessage('')
    setDownloading(true)
    try {
      const dataUrl = await capturePng()
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `coupon_${Date.now()}.png`
      a.click()
    } catch (e) {
      setMessage(`이미지 생성 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDownloading(false)
    }
  }

  const handleSend = async () => {
    setMessage('')
    setResult(null)
    if (!label.trim()) { setMessage('쿠폰명을 입력해 주세요.'); return }
    if (discountType !== 'free_shipping' && (!discountValue || Number(discountValue) <= 0)) {
      setMessage('할인값을 입력해 주세요.')
      return
    }
    if (target === 'selected' && selectedIds.size === 0) {
      setMessage('발급할 회원을 한 명 이상 선택해 주세요.')
      return
    }
    const targetLabel = target === 'selected' ? `선택한 회원 ${selectedIds.size}명` : TARGETS.find((t) => t.key === target)?.label
    if (!window.confirm(`${targetLabel}에게 "${label.trim()}" 쿠폰을 발급하고 푸시를 발송할까요?`)) return

    setSending(true)
    try {
      // 1) 배너 이미지 캡처 → 업로드 (푸시 payload 용량 제한 때문에 URL만 payload에 담음)
      const dataUrl = await capturePng()
      const blob = await (await fetch(dataUrl)).blob()
      const path = `coupons/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, blob, {
        upsert: true,
        contentType: 'image/png',
      })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path)
      const bannerUrl = pub.publicUrl

      // 2) 쿠폰 템플릿 생성
      const { data: templateId, error: tErr } = await supabase.rpc('admin_create_coupon_template', {
        p_label: label.trim(),
        p_discount_type: discountType,
        p_discount_value: Number(discountValue || 0),
        p_max_discount: discountType === 'percent' && maxDiscount ? Number(maxDiscount) : null,
        p_min_order_amount: Number(minOrderAmount || 0),
        p_campaign_type: campaignType,
        p_banner_image: bannerUrl,
      })
      if (tErr || !templateId) throw tErr ?? new Error('쿠폰 템플릿 생성에 실패했습니다.')

      // 3) 대상 회원에게 일괄 발급
      const { data: issued, error: iErr } = await supabase.rpc('admin_issue_coupon', {
        p_template_id: templateId as string,
        p_target: target,
        p_expires_days: Number(expiresDays || 30),
        p_user_ids: target === 'selected' ? Array.from(selectedIds) : null,
      })
      if (iErr) throw iErr
      const userIds = ((issued ?? []) as { user_id: string }[]).map((r) => r.user_id)
      if (userIds.length === 0) {
        setMessage('발급 대상 회원이 없습니다. (해당 채널 구매 이력이 있는 회원이 없어요)')
        setSending(false)
        return
      }

      // 4) 웹 푸시 발송
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/live-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({
          pushAction: 'sendCoupon',
          userIds,
          title: `${campaign.badge} · 오늘 안 열면 사라지는 쿠폰이 와 있어요`,
          body: `${label.trim()} — ${discountLabel()}`,
          image: bannerUrl,
          url: '/app/benefits',
        }),
      })
      const json = (await res.json()) as { ok?: boolean; sent?: number; reason?: string }
      if (!json.ok) throw new Error(json.reason || '푸시 발송에 실패했습니다.')

      setResult({ targeted: userIds.length, sent: json.sent ?? 0 })
      setMessage(`쿠폰 ${userIds.length}명에게 발급 완료 · 푸시 ${json.sent ?? 0}건 발송됨 (구독 안 한 회원에게는 쿠폰만 지급되고 알림은 안 갑니다)`)
    } catch (e) {
      setMessage(`발송 실패: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">쿠폰 생성기</p>
      </header>

      <main className="max-w-[1200px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">쿠폰 생성기</h1>
        <p className="text-[13px] text-ink-soft mb-6">
          시크릿·월별 이벤트 등 쿠폰을 만들어 배너 이미지를 자동 생성하고, 대상 회원(전체/쇼핑몰/라이브)에게 쿠폰 발급 + 웹 푸시 발송까지 한 번에 처리합니다.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* 좌측: 입력 폼 */}
          <div className={card}>
            <div className="mb-5">
              <label className={lbl}>쿠폰 종류</label>
              <div className="flex gap-2">
                {CAMPAIGN_TYPES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCampaignType(c.key)}
                    className={`px-4 py-2 rounded-control text-[13px] font-semibold border transition-colors ${
                      campaignType === c.key ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className={lbl}>쿠폰명 (배너 제목)</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="예: 8월 여름 시크릿 쿠폰" className={inputCls} />
            </div>
            <div className="mb-5">
              <label className={lbl}>부제 (선택)</label>
              <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="예: 오늘 하루만, 팔로워 한정" className={inputCls} />
            </div>

            <div className="mb-4">
              <label className={lbl}>할인 유형</label>
              <div className="flex gap-2">
                {([
                  { key: 'amount', label: '정액 할인' },
                  { key: 'percent', label: '정률 할인' },
                  { key: 'free_shipping', label: '무료배송' },
                ] as const).map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDiscountType(d.key)}
                    className={`px-3.5 py-2 rounded-control text-[12.5px] font-medium border transition-colors ${
                      discountType === d.key ? 'bg-signal-blue text-paper border-signal-blue' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {discountType !== 'free_shipping' && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={lbl}>{discountType === 'percent' ? '할인율(%)' : '할인금액(원)'}</label>
                  <input
                    type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percent' ? '예: 10' : '예: 5000'} className={inputCls}
                  />
                </div>
                {discountType === 'percent' && (
                  <div>
                    <label className={lbl}>최대 할인금액(원, 선택)</label>
                    <input type="number" min={0} value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="예: 5000" className={inputCls} />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className={lbl}>최소 구매금액(원)</label>
                <input type="number" min={0} value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={lbl}>유효기간(발급일로부터, 일)</label>
                <input type="number" min={1} value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="mb-6">
              <label className={lbl}>발급 대상</label>
              <div className="flex gap-2">
                {TARGETS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTarget(t.key)}
                    className={`px-4 py-2 rounded-control text-[13px] font-semibold border transition-colors ${
                      target === t.key ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-ink-faint mt-2">
                {target === 'self'
                  ? '실제 회원에게는 나가지 않고 관리자 본인 계정에만 쿠폰이 발급·푸시됩니다 — 테스트용.'
                  : target === 'selected'
                  ? '아래 목록에서 발급할 회원을 직접 체크하세요.'
                  : '쇼핑몰/라이브 구분은 회원 관리 화면과 동일한 기준(구매 이력)입니다.'}
              </p>

              {target === 'selected' && (
                <div className="mt-3 border border-rule">
                  <div className="p-2.5 border-b border-rule flex items-center gap-2">
                    <input
                      value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)}
                      placeholder="이메일·이름으로 검색" className={inputCls}
                    />
                    <span className="text-[12px] text-ink-faint whitespace-nowrap">{selectedIds.size}명 선택</span>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto">
                    {membersLoading ? (
                      <div className="py-8 text-center text-[13px] text-ink-faint">불러오는 중…</div>
                    ) : filteredMembers.length === 0 ? (
                      <div className="py-8 text-center text-[13px] text-ink-faint">회원이 없습니다.</div>
                    ) : (
                      filteredMembers.map((m) => (
                        <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 border-b border-rule last:border-0 hover:bg-quiet cursor-pointer">
                          <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleMember(m.id)} />
                          <span className="text-[13px] text-ink flex-1 truncate">{m.email || '(이메일 없음)'} {m.name ? `· ${m.name}` : ''}</span>
                          {m.mall_order_count > 0 && <span className="text-[11px] text-signal-blue">쇼핑몰</span>}
                          {m.live_order_count > 0 && <span className="text-[11px] text-signal-red">라이브</span>}
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {message && (
              <div className={`text-[13px] rounded-md px-4 py-3 mb-4 ${result ? 'bg-signal-blue/10 text-signal-blue' : 'bg-red-50 border border-red-200 text-red-600'}`}>
                {message}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="inkOutline" size="md" label={downloading ? '생성 중...' : '이미지로 저장'} onClick={() => void handleDownload()} disabled={downloading || sending} />
              <Button variant="accent" size="md" label={sending ? '발송 중...' : '발급 + 푸시 발송'} onClick={() => void handleSend()} disabled={sending} />
            </div>
          </div>

          {/* 우측: 배너 미리보기 */}
          <div>
            <div className="sticky top-[76px]">
              <p className="text-[12px] text-ink-faint mb-2">미리보기 (회원 앱에 뜨는 푸시 이미지와 동일)</p>
              <div
                ref={previewRef}
                style={{
                  width: 420, height: 260, background: '#FFFFFF', border: '1.5px solid #1a1e36', boxSizing: 'border-box',
                  padding: '22px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  fontFamily: '"Malgun Gothic", sans-serif',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span
                    className="bg-signal-yellow"
                    style={{
                      display: 'inline-block', color: '#1a1e36',
                      fontSize: 12, fontWeight: 800, padding: '4px 10px', letterSpacing: 1,
                    }}
                  >
                    {campaign.badge}
                  </span>
                  <span style={{ fontSize: 11, color: '#8E9199', letterSpacing: 1.5 }}>BEAUTYGROUND</span>
                </div>

                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1e36', margin: 0, lineHeight: 1.3 }}>
                    {label.trim() || '쿠폰명을 입력하세요'}
                  </p>
                  {subtitle.trim() && (
                    <p style={{ fontSize: 12, color: '#5B5E66', marginTop: 4 }}>{subtitle.trim()}</p>
                  )}
                  <p style={{ fontSize: 32, fontWeight: 800, color: '#1a1e36', margin: '8px 0 0' }}>{discountLabel()}</p>
                </div>

                <div style={{ borderTop: '1px solid #E3E5E9', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#5B5E66' }}>
                  <span>{Number(minOrderAmount || 0) > 0 ? `${Number(minOrderAmount).toLocaleString()}원 이상 구매시` : '전 금액 사용 가능'}</span>
                  <span>발급일로부터 {expiresDays || 0}일</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
