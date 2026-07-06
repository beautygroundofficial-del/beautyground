import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import { supabase } from '../lib/supabase'
import { getAddresses, addAddress, setDefaultAddress, deleteAddress, type Address } from '../lib/addresses'

const field =
  'w-full bg-white border border-cream-2 rounded-md px-3.5 py-3 text-[14px] text-text placeholder:text-text-hint focus:outline-none focus:shadow-focus transition'

export default function AppAddresses() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoggedIn(false); setLoading(false); return }
    const list = await getAddresses()
    setAddresses(list)
    setShowForm(list.length === 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !phone.trim() || !address.trim()) {
      setError('받는 분·연락처·주소를 모두 입력해 주세요.')
      return
    }
    setSaving(true)
    const { error: err } = await addAddress({ recipientName: name.trim(), phone: phone.trim(), address: address.trim() })
    setSaving(false)
    if (err) { setError('배송지 저장에 실패했습니다.'); return }
    setName(''); setPhone(''); setAddress(''); setShowForm(false)
    await load()
  }

  const handleSetDefault = async (id: string) => {
    setAddresses((prev) => prev.map((a) => ({ ...a, is_default: a.id === id })))
    await setDefaultAddress(id)
  }

  const handleDelete = async (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id))
    await deleteAddress(id)
  }

  if (loading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-text-hint text-[14px]">불러오는 중...</div>
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-cream-4">
        <BackHeader title="배송지 관리" />
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <p className="text-[15px] text-text-sub mb-6">로그인이 필요해요</p>
          <button
            onClick={() => navigate('/app/login', { state: { from: '/app/addresses' } })}
            className="bg-gold text-white font-semibold text-[14px] px-8 py-3 rounded-pill hover:bg-gold-light transition-colors"
          >
            로그인하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-4 pb-10">
      <BackHeader title="배송지 관리" />

      <div className="px-4 pt-4 space-y-3">
        {addresses.map((a) => (
          <div key={a.id} className="bg-white rounded-md p-4 border border-cream-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-text">{a.recipient_name}</p>
                {a.is_default && (
                  <span className="text-[11px] font-bold text-gold border border-gold rounded-pill px-2 py-0.5">기본배송지</span>
                )}
              </div>
              <button onClick={() => handleDelete(a.id)} className="text-text-hint hover:text-text text-[13px]" aria-label="배송지 삭제">
                삭제
              </button>
            </div>
            <p className="text-[13px] text-text-sub mt-1">{a.phone}</p>
            <p className="text-[13px] text-text-sub mt-0.5">{a.address}</p>
            {!a.is_default && (
              <button
                onClick={() => handleSetDefault(a.id)}
                className="mt-2 text-[12px] text-gold hover:underline"
              >
                기본 배송지로 설정
              </button>
            )}
          </div>
        ))}

        {showForm ? (
          <form onSubmit={handleAdd} className="bg-white rounded-md p-4 border border-cream-2 space-y-3">
            <h2 className="text-[14px] font-bold text-text">새 배송지</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="받는 분 성함" className={field} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락처 (010-0000-0000)" className={field} />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="배송 주소" className={field} />
            {error && <p className="text-[13px] text-[#FF4757]">{error}</p>}
            <div className="flex gap-2">
              {addresses.length > 0 && (
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-cream-2 text-text-sub font-semibold text-[14px] py-3 rounded-lg">
                  취소
                </button>
              )}
              <button type="submit" disabled={saving} className="flex-1 bg-gold text-white font-semibold text-[14px] py-3 rounded-lg hover:bg-gold-light transition-colors disabled:opacity-60">
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full border border-dashed border-cream-2 text-text-sub font-medium text-[14px] py-4 rounded-md hover:bg-white transition-colors"
          >
            + 새 배송지 추가
          </button>
        )}
      </div>
    </div>
  )
}
