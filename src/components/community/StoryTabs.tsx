import { Link } from 'react-router-dom'

// 이야기 탭의 두 갈래 — 하루 이야기(일기) / 속 이야기(주제별 게시판). (2026-09-10)
// 하단 탭은 '이야기' 하나로 두고, 그 안에서만 나눈다. 탭을 늘리면 그것도 읽을 게 늘어난다.
const TABS = [
  { to: '/app/diary', label: '하루 이야기' },
  { to: '/app/board', label: '속 이야기' },
] as const

export default function StoryTabs({ current }: { current: '/app/diary' | '/app/board' }) {
  return (
    <div className="px-5 pt-4">
      <div className="flex rounded-full bg-quiet p-1">
        {TABS.map((t) => {
          const on = t.to === current
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={on ? 'page' : undefined}
              className={`flex-1 text-center py-2 rounded-full text-[13px] transition focus:outline-none focus-visible:shadow-ring ${
                on ? 'bg-paper text-ink font-bold shadow-sm' : 'text-ink-faint'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
