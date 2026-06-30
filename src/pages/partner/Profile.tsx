import { useEffect, useState } from 'react'
import { IconUser, IconLock, IconCheck } from '@tabler/icons-react'
import { supabase } from '../../lib/supabase'
import { getMyPartner } from '../../lib/partner'
import type { Partner } from '../../lib/types'

const inputCls =
  'w-full border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[13px] text-[#111] placeholder:text-[#bbb] focus:outline-none focus:border-[#b8924a] transition-colors bg-white'

const readonlyCls =
  'w-full border border-[#e5e0d8] rounded-lg px-3.5 py-2.5 text-[13px] text-[#9a9080] bg-[#f7f4ef] cursor-default'

export default function PartnerProfile() {
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [email, setEmail] = useState('')

  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSubmitting, setPwSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      const [partnerData, { data: authData }] = await Promise.all([
        getMyPartner(),
        supabase.auth.getUser(),
      ])
      if (!active) return
      setPartner(partnerData)
      setEmail(authData.user?.email ?? '')
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)

    if (newPw.length < 6) { setPwError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { setPwError('비밀번호가 일치하지 않습니다.'); return }

    setPwSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) { setPwError(error.message); setPwSubmitting(false); return }

    setPwSuccess(true)
    setNewPw('')
    setConfirmPw('')
    setPwSubmitting(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-[14px] text-[#9a9080]">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* 브랜드 정보 */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <div className="flex items-center gap-2 mb-5">
          <IconUser size={16} className="text-[#b8924a]" />
          <h3 className="text-[14px] font-bold text-[#111]">브랜드 정보</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">브랜드명</label>
            <div className={readonlyCls}>{partner?.brand_name ?? '-'}</div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">이메일</label>
            <div className={readonlyCls}>{email || '-'}</div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">수수료율</label>
            <div className={readonlyCls}>{partner?.commission_rate ?? 0}%</div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">계정 상태</label>
            <div className={readonlyCls}>
              {partner?.status === 'active' && <span className="text-[#085041] font-medium">승인완료</span>}
              {partner?.status === 'suspended' && <span className="text-[#712B13] font-medium">정지됨</span>}
              {!partner && <span className="text-[#633806]">심사 중</span>}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#9a9080] mt-4">
          브랜드명 및 수수료율 변경은 고객센터로 문의해 주세요.
        </p>
      </div>

      {/* 비밀번호 변경 */}
      <div className="bg-white rounded-[14px] border border-[#e5e0d8] p-6">
        <div className="flex items-center gap-2 mb-5">
          <IconLock size={16} className="text-[#b8924a]" />
          <h3 className="text-[14px] font-bold text-[#111]">비밀번호 변경</h3>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">새 비밀번호</label>
            <input
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="6자 이상"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#555] mb-1.5">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="비밀번호 재입력"
              className={inputCls}
            />
          </div>

          {pwError && (
            <p className="text-[12px] text-red-500 bg-red-50 rounded-lg px-4 py-3">{pwError}</p>
          )}
          {pwSuccess && (
            <div className="flex items-center gap-2 text-[12px] text-[#085041] bg-[#E1F5EE] rounded-lg px-4 py-3">
              <IconCheck size={14} />
              비밀번호가 변경되었습니다.
            </div>
          )}

          <button
            type="submit"
            disabled={pwSubmitting}
            className="w-full py-2.5 bg-[#b8924a] hover:bg-[#a07c3b] disabled:opacity-60 text-white font-semibold rounded-lg text-[13px] transition-colors"
          >
            {pwSubmitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
