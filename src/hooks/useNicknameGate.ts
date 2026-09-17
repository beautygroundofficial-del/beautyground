import { useCallback, useEffect, useRef, useState } from 'react'
import { getMyNickname } from '../lib/nickname'

// 글/댓글 작성 직전에 애칭이 있는지 확인하고, 없으면 NicknameModal을 띄운 뒤
// 설정이 끝나면 원래 하려던 동작을 이어서 실행한다(2026-09-18).
//
// 사용법:
//   const { nickname, modalOpen, ensureNickname, handleDone, closeModal } = useNicknameGate()
//   const submit = () => ensureNickname((nickname) => { /* 실제 게시/댓글 로직에 nickname 그대로 씀 */ })
//   <NicknameModal open={modalOpen} onDone={handleDone} onClose={closeModal} />
export function useNicknameGate() {
  const [nickname, setNickname] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const pendingRef = useRef<((nick: string) => void) | null>(null)

  useEffect(() => {
    let active = true
    void getMyNickname().then((n) => { if (active) { setNickname(n); setReady(true) } })
    return () => { active = false }
  }, [])

  const ensureNickname = useCallback((onReady: (nick: string) => void) => {
    if (nickname) { onReady(nickname); return }
    pendingRef.current = onReady
    setModalOpen(true)
  }, [nickname])

  const handleDone = useCallback((nick: string, _awarded: number) => {
    setNickname(nick)
    setModalOpen(false)
    const fn = pendingRef.current
    pendingRef.current = null
    fn?.(nick)
  }, [])

  const closeModal = useCallback(() => { setModalOpen(false); pendingRef.current = null }, [])

  return { nickname, nicknameReady: ready, modalOpen, ensureNickname, handleDone, closeModal }
}
