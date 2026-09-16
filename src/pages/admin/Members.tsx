import { useEffect, useMemo, useState } from 'react'
import { IconTrash, IconPencil } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { won, formatDateTime } from '../../lib/format'
import Button from '../../components/common/Button'
import ColorSwatchPicker from '../../components/common/ColorSwatchPicker'

interface MemberRow {
  id: string
  email: string
  name: string
  phone: string
  provider: string
  created_at: string
  total_spent: number
  order_count: number
  mall_spent: number
  mall_order_count: number
  live_spent: number
  live_order_count: number
  tier_label: string
  is_seed: boolean
}

interface MembershipTierRow {
  id: string
  tier_key: string
  label: string
  min_spent: number
  reward_rate: number
  color: string
  bg: string
}

const PROVIDER_LABEL: Record<string, string> = {
  email: '이메일',
  kakao: '카카오',
  naver: '네이버',
}

type ChannelFilter = 'all' | 'mall' | 'live' | 'both'
type SeedFilter = 'real' | 'seed' | 'all'

function memberChannel(m: MemberRow): ChannelFilter | 'none' {
  const hasMall = m.mall_order_count > 0
  const hasLive = m.live_order_count > 0
  if (hasMall && hasLive) return 'both'
  if (hasMall) return 'mall'
  if (hasLive) return 'live'
  return 'none'
}

function ChannelBadge({ m }: { m: MemberRow }) {
  const ch = memberChannel(m)
  if (ch === 'none') return <span className="text-ink-faint">-</span>
  const parts: string[] = []
  if (m.mall_order_count > 0) parts.push('쇼핑몰')
  if (m.live_order_count > 0) parts.push('라이브')
  return (
    <div className="flex gap-1.5 flex-wrap">
      {parts.map((p) => (
        <span
          key={p}
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${
            p === '쇼핑몰' ? 'bg-signal-blue/10 text-signal-blue' : 'bg-signal-red/10 text-signal-red'
          }`}
        >
          {p}
        </span>
      ))}
    </div>
  )
}

const inputCls =
  'w-full border border-rule rounded-control px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors bg-paper'

interface TierFormState {
  id: string | null
  tierKey: string
  label: string
  minSpent: string
  rewardRate: string
  color: string
  bg: string
}

const EMPTY_TIER_FORM: TierFormState = { id: null, tierKey: '', label: '', minSpent: '', rewardRate: '', color: '#8E9199', bg: '#F4F5F7' }

interface StaffRow {
  email: string
  note: string | null
  created_at: string
}

interface VvipRow {
  email: string
  note: string | null
  created_at: string
}

export default function AdminMembers() {
  const [tab, setTab] = useState<'members' | 'tiers' | 'staff' | 'vvip'>('members')

  // ── 회원 목록 ──
  const [members, setMembers] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all')
  const [seedFilter, setSeedFilter] = useState<SeedFilter>('real')

  const loadMembers = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.rpc('admin_list_members')
    if (err) {
      setError(`회원 목록 조회 실패: ${err.message}`)
      setLoading(false)
      return
    }
    setMembers((data ?? []) as MemberRow[])
    setLoading(false)
  }

  useEffect(() => { void loadMembers() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      if (seedFilter === 'real' && m.is_seed) return false
      if (seedFilter === 'seed' && !m.is_seed) return false
      if (channelFilter !== 'all' && memberChannel(m) !== channelFilter) return false
      if (!q) return true
      return m.email?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q) || m.phone?.includes(q)
    })
  }, [members, query, channelFilter, seedFilter])

  const channelCounts = useMemo(() => {
    const c = { all: members.length, mall: 0, live: 0, both: 0 }
    members.forEach((m) => {
      const ch = memberChannel(m)
      if (ch === 'mall' || ch === 'live' || ch === 'both') c[ch] += 1
    })
    return c
  }, [members])

  const seedCounts = useMemo(() => {
    const seedCount = members.filter((m) => m.is_seed).length
    return { real: members.length - seedCount, seed: seedCount, all: members.length }
  }, [members])

  // ── 등급 설정 ──
  const [tiers, setTiers] = useState<MembershipTierRow[]>([])
  const [tiersLoading, setTiersLoading] = useState(true)
  const [tierForm, setTierForm] = useState<TierFormState>(EMPTY_TIER_FORM)
  const [tierSubmitting, setTierSubmitting] = useState(false)
  const [tierError, setTierError] = useState('')
  const [confirmDel, setConfirmDel] = useState<MembershipTierRow | null>(null)

  const loadTiers = async () => {
    setTiersLoading(true)
    const { data } = await supabase.from('membership_tiers').select('*').order('min_spent', { ascending: true })
    setTiers((data ?? []) as MembershipTierRow[])
    setTiersLoading(false)
  }

  useEffect(() => { void loadTiers() }, [])

  const startEditTier = (tier: MembershipTierRow) => {
    setTierForm({
      id: tier.id,
      tierKey: tier.tier_key,
      label: tier.label,
      minSpent: String(tier.min_spent),
      rewardRate: String(tier.reward_rate),
      color: tier.color,
      bg: tier.bg,
    })
  }

  const resetTierForm = () => setTierForm(EMPTY_TIER_FORM)

  const handleTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTierError('')

    if (!tierForm.tierKey.trim()) { setTierError('등급 코드를 입력해 주세요. (예: BASIC)'); return }
    if (!tierForm.label.trim()) { setTierError('등급명을 입력해 주세요.'); return }
    if (tierForm.minSpent.trim() === '' || Number(tierForm.minSpent) < 0) { setTierError('기준 누적구매금액을 입력해 주세요.'); return }
    if (tierForm.rewardRate.trim() === '' || Number(tierForm.rewardRate) < 0 || Number(tierForm.rewardRate) > 100) {
      setTierError('적립률은 0~100 사이로 입력해 주세요.')
      return
    }

    setTierSubmitting(true)
    const payload = {
      tier_key: tierForm.tierKey.trim().toUpperCase(),
      label: tierForm.label.trim(),
      min_spent: Number(tierForm.minSpent),
      reward_rate: Number(tierForm.rewardRate),
      color: tierForm.color,
      bg: tierForm.bg,
    }

    const { error: err } = tierForm.id
      ? await supabase.from('membership_tiers').update(payload).eq('id', tierForm.id)
      : await supabase.from('membership_tiers').insert(payload)

    if (err) {
      setTierError(`저장 실패: ${err.message}`)
      setTierSubmitting(false)
      return
    }

    setTierSubmitting(false)
    resetTierForm()
    void loadTiers()
  }

  const handleTierDelete = async () => {
    if (!confirmDel) return
    await supabase.from('membership_tiers').delete().eq('id', confirmDel.id)
    setConfirmDel(null)
    void loadTiers()
  }

  // ── 직원 등급 지정 (app_staff) ──
  const [staffList, setStaffList] = useState<StaffRow[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const [staffError, setStaffError] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [staffSubmitting, setStaffSubmitting] = useState(false)

  const loadStaff = async () => {
    setStaffLoading(true)
    setStaffError('')
    const { data, error: err } = await supabase.rpc('admin_list_staff')
    if (err) {
      setStaffError(`직원 목록 조회 실패: ${err.message} (supabase/staff_members.sql 적용 여부 확인)`)
      setStaffLoading(false)
      return
    }
    setStaffList((data ?? []) as StaffRow[])
    setStaffLoading(false)
  }

  // 회원 목록 탭에서도 "이미 직원인지" 표시해야 하므로 처음부터 불러오고, staff 탭 진입 시 새로고침한다.
  useEffect(() => { void loadStaff() }, [])
  useEffect(() => { if (tab === 'staff') void loadStaff() }, [tab])

  const staffEmailSet = useMemo(() => new Set(staffList.map((s) => s.email)), [staffList])
  const [promotingId, setPromotingId] = useState<string | null>(null)

  // 회원 목록에서 바로 "직원 승급" — 가입 안 된 이메일을 admin이 미리 추측해 입력하는 대신,
  // 실제 가입된 계정만 골라서 승급하도록(2026-08-28 대표님 확정: "가입하면 그 아이디를 직원용으로 승급").
  const promoteToStaff = async (m: MemberRow) => {
    if (!m.email) return
    setPromotingId(m.id)
    const { error: err } = await supabase.rpc('admin_set_staff', { p_email: m.email, p_note: m.name || null })
    setPromotingId(null)
    if (err) { setError(`직원 승급 실패: ${err.message}`); return }
    void loadStaff()
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!staffEmail.trim()) return
    setStaffSubmitting(true)
    setStaffError('')
    const { error: err } = await supabase.rpc('admin_set_staff', { p_email: staffEmail.trim(), p_note: staffNote.trim() || null })
    setStaffSubmitting(false)
    if (err) {
      setStaffError(`지정 실패: ${err.message}`)
      return
    }
    setStaffEmail('')
    setStaffNote('')
    void loadStaff()
  }

  const handleRemoveStaff = async (email: string) => {
    await supabase.rpc('admin_remove_staff', { p_email: email })
    void loadStaff()
  }

  // ── VVIP 지정 (app_vvip) — 직원 지정과 완전히 동일한 패턴. 구매금액 기준 VIP(등급 설정)와 별개로,
  // 특정 고객을 수동으로 VVIP 지정하면 브랜드별 할인(백화점 입점 20%/온라인 전용 30%, 적립 없음)이 결제에 적용된다.
  const [vvipList, setVvipList] = useState<VvipRow[]>([])
  const [vvipLoading, setVvipLoading] = useState(true)
  const [vvipError, setVvipError] = useState('')
  const [vvipEmail, setVvipEmail] = useState('')
  const [vvipNote, setVvipNote] = useState('')
  const [vvipSubmitting, setVvipSubmitting] = useState(false)

  const loadVvip = async () => {
    setVvipLoading(true)
    setVvipError('')
    const { data, error: err } = await supabase.rpc('admin_list_vvip')
    if (err) {
      setVvipError(`VVIP 목록 조회 실패: ${err.message} (supabase/vvip_members.sql 적용 여부 확인)`)
      setVvipLoading(false)
      return
    }
    setVvipList((data ?? []) as VvipRow[])
    setVvipLoading(false)
  }

  useEffect(() => { void loadVvip() }, [])
  useEffect(() => { if (tab === 'vvip') void loadVvip() }, [tab])

  const vvipEmailSet = useMemo(() => new Set(vvipList.map((v) => v.email)), [vvipList])
  const [promotingVvipId, setPromotingVvipId] = useState<string | null>(null)

  const promoteToVvip = async (m: MemberRow) => {
    if (!m.email) return
    setPromotingVvipId(m.id)
    const { error: err } = await supabase.rpc('admin_set_vvip', { p_email: m.email, p_note: m.name || null })
    setPromotingVvipId(null)
    if (err) { setError(`VVIP 지정 실패: ${err.message}`); return }
    void loadVvip()
  }

  const handleAddVvip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vvipEmail.trim()) return
    setVvipSubmitting(true)
    setVvipError('')
    const { error: err } = await supabase.rpc('admin_set_vvip', { p_email: vvipEmail.trim(), p_note: vvipNote.trim() || null })
    setVvipSubmitting(false)
    if (err) {
      setVvipError(`지정 실패: ${err.message}`)
      return
    }
    setVvipEmail('')
    setVvipNote('')
    void loadVvip()
  }

  const handleRemoveVvip = async (email: string) => {
    await supabase.rpc('admin_remove_vvip', { p_email: email })
    void loadVvip()
  }

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">회원 관리</p>
      </header>

      <main className="max-w-[1200px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">회원 관리</h1>
        <p className="text-[13px] text-ink-soft mb-5">
          총 {members.length}명 가입. 등급은 등급 설정 탭의 누적구매금액 기준으로 자동 산정됩니다.
        </p>

        <div className="flex gap-1 mb-6 border-b border-rule">
          {(['members', 'tiers', 'staff', 'vvip'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-ink text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
              }`}
            >
              {t === 'members' ? '회원 목록' : t === 'tiers' ? '등급 설정' : t === 'staff' ? '직원 지정' : 'VVIP 지정'}
            </button>
          ))}
        </div>

        {tab === 'members' ? (
          <>
            <div className="flex flex-wrap gap-2 mb-5">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이메일·이름·연락처로 검색"
                className="w-full max-w-[360px] border border-rule rounded-control px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink transition-colors bg-paper"
              />
              <div className="flex gap-2">
                {([
                  { key: 'all', label: `전체 ${channelCounts.all}` },
                  { key: 'mall', label: `쇼핑몰만 ${channelCounts.mall}` },
                  { key: 'live', label: `라이브만 ${channelCounts.live}` },
                  { key: 'both', label: `둘 다 ${channelCounts.both}` },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setChannelFilter(opt.key)}
                    className={`px-3.5 py-2 rounded-control text-[12.5px] font-medium border transition-colors whitespace-nowrap ${
                      channelFilter === opt.key ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {([
                  { key: 'real', label: `실회원 ${seedCounts.real}` },
                  { key: 'seed', label: `시딩계정 ${seedCounts.seed}` },
                  { key: 'all', label: `전체 ${seedCounts.all}` },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setSeedFilter(opt.key)}
                    className={`px-3.5 py-2 rounded-control text-[12.5px] font-medium border transition-colors whitespace-nowrap ${
                      seedFilter === opt.key ? 'bg-signal-blue text-paper border-signal-blue' : 'bg-paper text-ink-soft border-rule hover:border-ink-faint'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{error}</div>
            )}

            {loading ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">
                {members.length === 0 ? '가입된 회원이 없습니다.' : '조건에 맞는 회원이 없습니다.'}
              </div>
            ) : (
              <div className="bg-paper rounded-md border border-rule overflow-x-auto">
                <table className="w-full text-[13px] text-left">
                  <thead>
                    <tr className="border-b border-rule text-ink-soft">
                      <th className="px-4 py-3 font-medium whitespace-nowrap">가입일</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">이메일</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">이름</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">연락처</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">가입경로</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">구매 채널</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">등급</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">쇼핑몰 구매액</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">라이브 구매액</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">누적구매금액</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">직원</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">VVIP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => (
                      <tr key={m.id} className="border-b border-rule last:border-b-0">
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                        <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{m.email || '-'}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                          {m.name || '-'}
                          {m.is_seed && (
                            <span className="ml-1.5 inline-flex items-center rounded-pill px-1.5 py-0.5 text-[10.5px] font-semibold bg-signal-blue/10 text-signal-blue align-middle">
                              시딩
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{m.phone || '-'}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{PROVIDER_LABEL[m.provider] ?? m.provider}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><ChannelBadge m={m} /></td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-pill px-2.5 py-1 text-[12px] font-medium bg-quiet text-ink">
                            {m.tier_label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{won(m.mall_spent)}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{won(m.live_spent)}</td>
                        <td className="px-4 py-3 text-ink font-semibold whitespace-nowrap">{won(m.total_spent)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!m.email ? (
                            <span className="text-ink-faint">-</span>
                          ) : staffEmailSet.has(m.email) ? (
                            <span className="text-[12px] font-semibold text-signal-blue">✓ 직원</span>
                          ) : (
                            <button
                              onClick={() => void promoteToStaff(m)}
                              disabled={promotingId === m.id}
                              className="text-[12px] font-semibold text-ink-soft border border-rule rounded-control px-2.5 py-1 hover:border-ink-faint disabled:opacity-50"
                            >
                              {promotingId === m.id ? '승급 중...' : '직원 승급'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {!m.email ? (
                            <span className="text-ink-faint">-</span>
                          ) : vvipEmailSet.has(m.email) ? (
                            <span className="text-[12px] font-semibold text-signal-blue">✓ VVIP</span>
                          ) : (
                            <button
                              onClick={() => void promoteToVvip(m)}
                              disabled={promotingVvipId === m.id}
                              className="text-[12px] font-semibold text-ink-soft border border-rule rounded-control px-2.5 py-1 hover:border-ink-faint disabled:opacity-50"
                            >
                              {promotingVvipId === m.id ? '지정 중...' : 'VVIP 지정'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : tab === 'tiers' ? (
          <>
            <p className="text-[13px] text-ink-soft mb-6">
              고객의 누적 구매금액이 기준 금액 이상이면 해당 등급이 적용됩니다. 저장 후 고객 화면(마이페이지)에는
              새로고침 시 반영됩니다.
            </p>

            <form
              onSubmit={handleTierSubmit}
              className="bg-paper border border-rule p-6 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto_auto] gap-3 items-end"
            >
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">등급 코드</label>
                <input
                  value={tierForm.tierKey} onChange={(e) => setTierForm((p) => ({ ...p, tierKey: e.target.value }))}
                  placeholder="예: GOLD" className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">등급명(표시)</label>
                <input
                  value={tierForm.label} onChange={(e) => setTierForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="예: GOLD" className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">기준 누적구매금액(원, 이상)</label>
                <input
                  type="number" min={0}
                  value={tierForm.minSpent} onChange={(e) => setTierForm((p) => ({ ...p, minSpent: e.target.value }))}
                  placeholder="0" className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">적립률(%)</label>
                <input
                  type="number" min={0} max={100} step="0.1"
                  value={tierForm.rewardRate} onChange={(e) => setTierForm((p) => ({ ...p, rewardRate: e.target.value }))}
                  placeholder="예: 3" className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">글자색</label>
                <ColorSwatchPicker label="글자색" value={tierForm.color} onChange={(hex) => setTierForm((p) => ({ ...p, color: hex }))} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">배경색</label>
                <ColorSwatchPicker label="배경색" value={tierForm.bg} onChange={(hex) => setTierForm((p) => ({ ...p, bg: hex }))} />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit" variant="accent" size="sm"
                  label={tierSubmitting ? '저장 중...' : tierForm.id ? '수정' : '추가'}
                  disabled={tierSubmitting}
                />
                {tierForm.id && <Button type="button" variant="inkOutline" size="sm" label="취소" onClick={resetTierForm} />}
              </div>
            </form>

            {tierError && (
              <div className="bg-paper border border-signal-red text-signal-red text-[13px] px-4 py-3 mb-5">{tierError}</div>
            )}

            {tiersLoading ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
            ) : tiers.length === 0 ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">등록된 등급이 없습니다. 위에서 추가해 주세요.</div>
            ) : (
              <div className="bg-paper border border-rule overflow-x-auto">
                <table className="w-full text-[13px] text-left">
                  <thead>
                    <tr className="border-b border-rule text-ink-soft">
                      <th className="px-4 py-3 font-medium whitespace-nowrap">배지</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">등급 코드</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">기준 누적구매금액</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">적립률</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((tier) => (
                      <tr key={tier.id} className="border-b border-rule last:border-b-0">
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center rounded-control px-2.5 py-1 text-[11px] font-bold border"
                            style={{ backgroundColor: tier.bg, color: tier.color, borderColor: tier.color }}
                          >
                            {tier.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{tier.tier_key}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{won(tier.min_spent)} 이상</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{tier.reward_rate}%</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <button onClick={() => startEditTier(tier)} className="text-ink-faint hover:text-ink" aria-label="수정">
                              <IconPencil size={16} />
                            </button>
                            <button onClick={() => setConfirmDel(tier)} className="text-ink-faint hover:text-signal-red" aria-label="삭제">
                              <IconTrash size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : tab === 'staff' ? (
          <>
            <p className="text-[13px] text-ink-soft mb-6">
              여기에 지정된 이메일로 로그인하면 일반 로그인만으로 <a href="/app/staff-buy" target="_blank" rel="noreferrer" className="underline">직원 전용 구매 페이지</a>가 즉시 열립니다.
              (products.employee_price가 있는 상품만 노출, 무통장입금 전용)
            </p>

            <form onSubmit={handleAddStaff} className="bg-paper border border-rule p-6 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">이메일</label>
                <input
                  value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="staff@example.com" className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">메모(선택)</label>
                <input
                  value={staffNote} onChange={(e) => setStaffNote(e.target.value)}
                  placeholder="예: 광명점 김OO" className={inputCls}
                />
              </div>
              <Button type="submit" variant="accent" size="sm" label={staffSubmitting ? '지정 중...' : '직원 지정'} disabled={staffSubmitting} />
            </form>

            {staffError && (
              <div className="bg-paper border border-signal-red text-signal-red text-[13px] px-4 py-3 mb-5">{staffError}</div>
            )}

            {staffLoading ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
            ) : staffList.length === 0 ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">지정된 직원이 없습니다.</div>
            ) : (
              <div className="bg-paper border border-rule overflow-x-auto">
                <table className="w-full text-[13px] text-left">
                  <thead>
                    <tr className="border-b border-rule text-ink-soft">
                      <th className="px-4 py-3 font-medium whitespace-nowrap">이메일</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">메모</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">지정일</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((s) => (
                      <tr key={s.email} className="border-b border-rule last:border-b-0">
                        <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{s.email}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{s.note || '-'}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => void handleRemoveStaff(s.email)} className="text-ink-faint hover:text-signal-red" aria-label="해제">
                            <IconTrash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-[13px] text-ink-soft mb-6">
              여기에 지정된 고객은 결제 시 브랜드별 할인(백화점 입점 브랜드 20% / 온라인 전용 브랜드 30%)이
              자동 적용됩니다. 구매금액 기준 VIP(등급 설정 탭)와는 별개이며, 적립은 없습니다.
            </p>

            <form onSubmit={handleAddVvip} className="bg-paper border border-rule p-6 mb-6 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">이메일</label>
                <input
                  value={vvipEmail} onChange={(e) => setVvipEmail(e.target.value)}
                  placeholder="vvip@example.com" className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-soft mb-1.5">메모(선택)</label>
                <input
                  value={vvipNote} onChange={(e) => setVvipNote(e.target.value)}
                  placeholder="예: OO 사모님" className={inputCls}
                />
              </div>
              <Button type="submit" variant="accent" size="sm" label={vvipSubmitting ? '지정 중...' : 'VVIP 지정'} disabled={vvipSubmitting} />
            </form>

            {vvipError && (
              <div className="bg-paper border border-signal-red text-signal-red text-[13px] px-4 py-3 mb-5">{vvipError}</div>
            )}

            {vvipLoading ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
            ) : vvipList.length === 0 ? (
              <div className="py-20 text-center text-[14px] text-ink-faint">지정된 VVIP가 없습니다.</div>
            ) : (
              <div className="bg-paper border border-rule overflow-x-auto">
                <table className="w-full text-[13px] text-left">
                  <thead>
                    <tr className="border-b border-rule text-ink-soft">
                      <th className="px-4 py-3 font-medium whitespace-nowrap">이메일</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">메모</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">지정일</th>
                      <th className="px-4 py-3 font-medium whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vvipList.map((v) => (
                      <tr key={v.email} className="border-b border-rule last:border-b-0">
                        <td className="px-4 py-3 text-ink font-medium whitespace-nowrap">{v.email}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{v.note || '-'}</td>
                        <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{formatDateTime(v.created_at)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button onClick={() => void handleRemoveVvip(v.email)} className="text-ink-faint hover:text-signal-red" aria-label="해제">
                            <IconTrash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirmDel(null)}>
          <div className="bg-paper border border-rule w-full max-w-[400px] p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-ink mb-2">'{confirmDel.label}' 등급을 삭제할까요?</p>
            <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">
              이 등급을 삭제하면 해당 구간 고객은 다음으로 낮은 등급으로 재산정됩니다.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="inkOutline" size="sm" label="취소" onClick={() => setConfirmDel(null)} />
              <Button variant="danger" size="sm" label="삭제" onClick={() => void handleTierDelete()} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
