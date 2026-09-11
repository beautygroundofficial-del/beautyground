import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import { supabase } from '../lib/supabase'
import { categoryLabel, getMyBoardPosts, type MyBoardPost } from '../lib/board'
import { MetaMarks } from '../components/community/marks'

// 내가 쓴 속 이야기 — 마이페이지에서 들어온다. (2026-09-10, 커뮤니티 로드맵 4-4 ②)
// 운영자가 가린 글도 나에게는 보인다(왜 안 보이는지 알 수 있게).

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export default function AppMyBoard() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [posts, setPosts] = useState<MyBoardPost[] | null>(null)

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setLoggedIn(!!session)
      if (!session) { setPosts([]); return }
      setPosts(await getMyBoardPosts(50))
    })()
  }, [])

  return (
    <AppFrame>
      <BackHeader title="내가 쓴 속 이야기" onBack={() => navigate('/app/mypage')} />

      <section className="px-5 pt-5 pb-28">
        {loggedIn === false ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-ink-soft mb-4">로그인하면 내가 쓴 이야기를 모아볼 수 있어요</p>
            <button
              onClick={() => navigate('/app/login', { state: { from: '/app/board/mine' } })}
              className="rounded-control bg-ink text-paper font-bold text-[14px] px-6 py-3 focus:outline-none focus-visible:shadow-ring"
            >
              로그인
            </button>
          </div>
        ) : posts === null ? (
          <p className="py-16 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : posts.length === 0 ? (
          <button
            onClick={() => navigate('/app/board/write')}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-12 text-center focus:outline-none focus-visible:shadow-ring"
          >
            <p className="text-[14px] font-semibold text-ink">아직 꺼내놓은 이야기가 없어요</p>
            <p className="text-[12.5px] text-ink-faint mt-1.5">여기선 이름을 가리고 털어놓을 수 있어요</p>
          </button>
        ) : (
          <ul className="space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/app/board/${p.id}`}
                  className="block rounded-card border border-rule bg-paper p-4 focus:outline-none focus-visible:shadow-ring"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-semibold text-ink-soft bg-quiet rounded-full px-2 py-0.5">
                      {categoryLabel(p.category)}
                    </span>
                    <span className="text-[11px] text-ink-faint">{timeAgo(p.created_at)}</span>
                    {p.status === 'hidden' && (
                      <span className="text-[11px] text-ink-faint">· 운영자가 가린 글</span>
                    )}
                    <span className="ml-auto"><MetaMarks likes={p.like_count ?? 0} comments={p.comment_count} size={15} /></span>
                  </div>
                  <p className="text-[14px] text-ink leading-relaxed whitespace-pre-wrap line-clamp-2">{p.content}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppFrame>
  )
}
