import { useState } from 'react'
import { setMyNickname } from '../../lib/nickname'

// 애칭 설정 팝업 — 글/댓글을 처음 쓰려고 할 때 애칭이 없으면 뜬다(2026-09-18).
// 만들면 10P 지급, 이후 계속 이 애칭을 쓴다(다시 안 뜸).

interface Props {
  open: boolean
  onDone: (nickname: string, awarded: number) => void
  onClose: () => void
}

export default function NicknameModal({ open, onDone, onClose }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  const submit = async () => {
    const v = value.trim()
    if (v.length < 2 || v.length > 12) { setError('애칭은 2~12자로 정해주세요'); return }
    setSaving(true)
    setError('')
    const res = await setMyNickname(v)
    setSaving(false)
    if (!res.ok) { setError(res.message); return }
    onDone(v, res.awarded)
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center px-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xs bg-paper rounded-card p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[16px] font-bold text-ink mb-1.5">애칭을 정해주세요</h2>
        <p className="text-[12.5px] text-ink-soft leading-relaxed mb-4">
          글·댓글에 표시될 이름이에요. 한 번 정하면 계속 이 이름을 써요.
        </p>
        <input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
          maxLength={12}
          placeholder="예: 햇살가득"
          autoFocus
          className="w-full rounded-control border border-rule bg-paper px-3.5 py-3 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink mb-2"
        />
        {error && <p className="text-[12px] text-signal-red mb-2">{error}</p>}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving || !value.trim()}
          className="w-full rounded-control bg-ink text-paper font-bold text-[14px] py-3 disabled:opacity-50"
        >
          {saving ? '설정 중…' : '이 애칭으로 시작하기'}
        </button>
      </div>
    </div>
  )
}
