import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import {
  PET_KINDS, petEmoji, getMyPets, createPet, updatePet, deletePet, uploadPetPhoto,
  type Pet, type PetKind,
} from '../lib/pets'

// 내 반려동물 — 마이페이지에서 들어온다. (2026-09-12, 커뮤니티 로드맵 4-10 B1)
// 이름·종류·사진 하나. 등록하면 하루 이야기 쓸 때 "오늘 같이 걸은 친구"로 고를 수 있고, 카드 닉네임 옆에 얼굴이 붙는다.

const MAX_PETS = 5

export default function AppPets() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [pets, setPets] = useState<Pet[] | null>(null)
  const [editing, setEditing] = useState<Pet | 'new' | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<PetKind>('dog')
  const [file, setFile] = useState<File | null>(null)
  const [keepPhoto, setKeepPhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400) }

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setLoggedIn(!!session)
      if (!session) { setPets([]); return }
      setPets(await getMyPets())
    })()
  }, [])

  const startNew = () => { setEditing('new'); setName(''); setKind('dog'); setFile(null); setKeepPhoto(null) }
  const startEdit = (p: Pet) => { setEditing(p); setName(p.name); setKind(p.kind); setFile(null); setKeepPhoto(p.photo_url) }
  const cancel = () => { setEditing(null); setFile(null) }

  const save = async () => {
    const n = name.trim()
    if (!n) { showToast('이름을 적어주세요'); return }
    if (n.length > 20) { showToast('이름은 20자 안으로'); return }
    setSaving(true)
    let photo = keepPhoto
    if (file) {
      photo = await uploadPetPhoto(file)
      if (!photo) { setSaving(false); showToast('사진을 올리지 못했어요'); return }
    }
    if (editing === 'new') {
      const p = await createPet(n, kind, photo)
      setSaving(false)
      if (!p) { showToast('저장하지 못했어요'); return }
      setPets((prev) => [...(prev ?? []), p])
      showToast(`${p.name}${petEmoji(p.kind)} 등록했어요`)
    } else if (editing) {
      const ok = await updatePet(editing.id, { name: n, kind, photo_url: photo })
      setSaving(false)
      if (!ok) { showToast('고치지 못했어요'); return }
      setPets((prev) => (prev ?? []).map((x) => (x.id === editing.id ? { ...x, name: n, kind, photo_url: photo } : x)))
      showToast('고쳤어요')
    }
    setEditing(null); setFile(null)
  }

  const remove = async (p: Pet) => {
    if (!window.confirm(`${p.name}을(를) 목록에서 지울까요? 이미 쓴 글의 표시도 사라져요.`)) return
    if (!(await deletePet(p.id))) { showToast('지우지 못했어요'); return }
    setPets((prev) => (prev ?? []).filter((x) => x.id !== p.id))
  }

  const photoShown = preview ?? keepPhoto

  return (
    <AppFrame>
      <BackHeader title="내 반려동물" onBack={() => navigate('/app/mypage')} />

      <div className="px-5 pt-5 pb-28">
        {loggedIn === false ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-ink-soft mb-4">로그인하면 반려동물을 등록할 수 있어요</p>
            <button onClick={() => navigate('/app/login', { state: { from: '/app/pets' } })}
              className="rounded-control bg-ink text-paper font-bold text-[14px] px-6 py-3 focus:outline-none focus-visible:shadow-ring">로그인</button>
          </div>
        ) : pets === null ? (
          <p className="py-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : (
          <>
            <p className="text-[12.5px] text-ink-soft leading-relaxed mb-4">
              등록하면 오늘 남기기에서 <b className="text-ink">같이 걸은 친구</b>로 고를 수 있고, 이야기 카드에 얼굴이 함께 보여요.
            </p>

            {editing ? (
              <div className="rounded-card border border-rule bg-paper p-4 mb-4">
                <div className="flex items-center gap-4 mb-4">
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="사진 고르기"
                    className="w-20 h-20 rounded-full bg-quiet overflow-hidden flex items-center justify-center shrink-0 focus:outline-none focus-visible:shadow-ring">
                    {photoShown ? <img src={photoShown} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[28px]" aria-hidden="true">{petEmoji(kind)}</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="이름 (예: 초코)" maxLength={20}
                      className="w-full rounded-control border border-rule bg-paper px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-ink" />
                    <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-[12px] text-ink-soft underline">
                      {photoShown ? '사진 바꾸기' : '사진 넣기'}
                    </button>
                    {photoShown && (
                      <button type="button" onClick={() => { setFile(null); setKeepPhoto(null) }} className="ml-3 text-[12px] text-ink-faint underline">빼기</button>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mb-4">
                  {PET_KINDS.map((k) => (
                    <button key={k.key} type="button" onClick={() => setKind(k.key)} aria-pressed={kind === k.key}
                      className={`px-3.5 py-1.5 rounded-full border text-[12.5px] transition focus:outline-none focus-visible:shadow-ring ${
                        kind === k.key ? 'bg-ink text-paper border-ink font-semibold' : 'bg-paper text-ink-soft border-rule'}`}>
                      {k.emoji} {k.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={cancel} className="px-3 py-2 text-[13px] text-ink-soft">취소</button>
                  <button type="button" onClick={() => void save()} disabled={saving}
                    className="px-4 py-2 rounded-control bg-ink text-paper text-[13px] font-semibold disabled:opacity-40">
                    {saving ? '저장 중…' : editing === 'new' ? '등록' : '고치기'}
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); e.target.value = '' }} />
              </div>
            ) : (
              pets.length < MAX_PETS && (
                <button type="button" onClick={startNew}
                  className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-6 text-center mb-4 focus:outline-none focus-visible:shadow-ring">
                  <p className="text-[14px] font-semibold text-ink">{pets.length === 0 ? '첫 친구 등록하기' : '친구 더 등록하기'}</p>
                  <p className="text-[12px] text-ink-faint mt-1">이름·종류·사진 한 장이면 돼요</p>
                </button>
              )
            )}

            {pets.length > 0 && (
              <ul className="space-y-2">
                {pets.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-card border border-rule bg-paper px-4 py-3">
                    <span className="w-12 h-12 rounded-full bg-quiet overflow-hidden flex items-center justify-center shrink-0">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-[22px]" aria-hidden="true">{petEmoji(p.kind)}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-ink truncate">{p.name}</p>
                      <p className="text-[11.5px] text-ink-faint">{PET_KINDS.find((k) => k.key === p.kind)?.label ?? '친구'}</p>
                    </div>
                    <button type="button" onClick={() => startEdit(p)} className="text-[12px] text-ink-faint px-2 py-1.5">고치기</button>
                    <button type="button" onClick={() => void remove(p)} className="text-[12px] text-ink-faint px-2 py-1.5">지우기</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">{toast}</div>
      )}
    </AppFrame>
  )
}
