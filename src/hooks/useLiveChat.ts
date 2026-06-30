import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ChatMessage {
  id: number
  live_id: string
  user_id: string | null
  nickname: string | null
  message: string
  created_at: string
}

interface UseLiveChat {
  messages: ChatMessage[]
  loading: boolean
  isLoggedIn: boolean
  sendMessage: (text: string) => Promise<boolean>
}

/**
 * 라이브 채팅 훅. liveId 의 기존 메시지를 로드하고 INSERT 를 실시간 구독한다.
 * 본인 메시지도 구독으로 수신되므로 낙관적 추가는 하지 않는다(중복 방지).
 */
export function useLiveChat(liveId: string | undefined): UseLiveChat {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const seenIds = useRef<Set<number>>(new Set())

  // 현재 로그인 유저 확인 (+ 세션 변화 반영)
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // 메시지 로드 + 실시간 구독
  useEffect(() => {
    if (!liveId) { setLoading(false); return }
    let active = true
    seenIds.current = new Set()
    setLoading(true)

    const load = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('live_id', liveId)
        .order('created_at', { ascending: true })
      if (!active) return
      const rows = (data as ChatMessage[]) ?? []
      rows.forEach((r) => seenIds.current.add(r.id))
      setMessages(rows)
      setLoading(false)
    }
    load()

    const ch = supabase
      .channel(`live-chat:${liveId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `live_id=eq.${liveId}` },
        (payload) => {
          const row = payload.new as ChatMessage
          if (seenIds.current.has(row.id)) return // 로드분과 중복 방지
          seenIds.current.add(row.id)
          setMessages((prev) => [...prev, row])
        }
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(ch)
    }
  }, [liveId])

  const sendMessage = async (text: string): Promise<boolean> => {
    const trimmed = text.trim()
    if (!trimmed || !liveId) return false

    // (1) 로그인 유저 정확히 가져오기
    const { data, error: authErr } = await supabase.auth.getUser()
    const user = data?.user
    if (authErr || !user) {
      console.warn('[chat] no session', authErr) // 비로그인/세션없음
      return false
    }

    // (2) 닉네임 = 이메일 @ 앞부분
    const nickname = (user.email ?? '').split('@')[0] || '익명'

    // (3) insert — user_id 에 반드시 user.id (RLS with check 통과 핵심)
    const { error } = await supabase.from('chat_messages').insert({
      live_id: liveId,
      user_id: user.id,
      nickname,
      message: trimmed,
    })
    if (error) {
      console.error('[chat] insert failed:', error.message) // RLS면 여기 찍힘
      return false
    }
    // 낙관적 추가 안 함 — INSERT 구독으로 본인 메시지도 수신됨
    return true
  }

  return { messages, loading, isLoggedIn: userId !== null, sendMessage }
}
