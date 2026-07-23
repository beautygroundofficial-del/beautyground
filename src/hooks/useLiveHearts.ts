import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// 라이브 "좋아요" 하트 — DB에 저장하지 않는 순간 이벤트(Realtime broadcast)만 씀.
// 탭이 잦아질 수 있어 매번 INSERT하면 부담이라, 화면 애니메이션 용도로만 브로드캐스트한다.
export function useLiveHearts(liveId: string | undefined, onHeart: () => void) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const onHeartRef = useRef(onHeart)
  onHeartRef.current = onHeart

  useEffect(() => {
    if (!liveId) return
    const ch = supabase
      .channel(`live-hearts:${liveId}`)
      .on('broadcast', { event: 'heart' }, () => {
        onHeartRef.current()
      })
      .subscribe()
    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [liveId])

  const sendHeart = useCallback(() => {
    channelRef.current?.send({ type: 'broadcast', event: 'heart', payload: {} })
  }, [])

  return { sendHeart }
}
