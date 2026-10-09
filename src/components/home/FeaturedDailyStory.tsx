import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getConversationFeed } from '../../lib/communityConversations'
import type { Diary } from '../../lib/diaries'

export default function FeaturedDailyStory() {
  const [story, setStory] = useState<Diary | null>(null)
  const navigate = useNavigate()
  useEffect(() => {
    let active = true
    void getConversationFeed('recent', 1).then(rows => { if (active) setStory(rows[0] ?? null) }).catch(() => {})
    return () => { active = false }
  }, [])
  if (!story) return null
  return <section className="mx-5 mt-4" aria-label="오늘 만나는 일상">
    <button type="button" onClick={() => navigate(`/app/diary?focus=${story.id}`)} style={{ borderRadius: 8 }} className="relative block w-full overflow-hidden text-left bg-quiet focus-visible:shadow-ring">
      {story.images?.[0] && <img src={story.images[0]} alt="회원이 남긴 오늘의 일상 사진" className="h-[140px] w-full object-cover" />}
      <span className={`block p-4 ${story.images?.[0] ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-black/0 text-white' : 'text-ink'}`}>
        <span className="block text-[12px] mb-1">오늘 만나는 일상 · 읽기 →</span>
        <span className="block text-[16px] font-semibold leading-relaxed line-clamp-2 break-words">{story.content}</span>
      </span>
    </button>
  </section>
}
