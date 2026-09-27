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
      <div className="flex gap-1 rounded-full bg-quiet p-1">
        {TABS.map((t) => {
          const on = t.to === current
          return (
            <Link
              key={t.to}
              to={t.to}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center border text-center px-3 py-2 rounded-full text-[15px] leading-relaxed transition focus:outline-none focus-visible:shadow-ring ${
                on ? 'border-rule bg-paper text-ink font-bold' : 'border-transparent text-ink-soft font-medium'
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
