import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/layout/BackHeader'
import AppFrame from '../components/layout/AppFrame'
import BottomNav from '../components/layout/BottomNav'
import { supabase } from '../lib/supabase'
import {
  getDiaryFeed, getMonthlyBestDiaries, createDiary, deleteDiary,
  uploadDiaryImages, type Diary, type BestDiary, type DiarySort,
} from '../lib/diaries'
import ReactionBar from '../components/community/ReactionBar'
import DiaryComments from '../components/community/DiaryComments'
import StoryTabs from '../components/community/StoryTabs'

// 살아가는 이야기 — 유저가 사진과 함께 일상을 남기는 곳.
// 글을 올리면 create_diary RPC 안에서 diary_post 미션이 자동 적립된다(화면에서 따로 적립 호출 안 함).
// 좋아요가 많은 글은 '이달의 우수 사연'으로 뽑아 선물을 준다.
//
// 2026-09-02 화면 정돈 — 히로인스 게시판이 "텍스트가 빽빽하고 계속 재촉해서 답답하다"는
// 대표님 지적에 따라, 수상작(트웬티) 방식으로 다시 짰다.
//   · 작은 회색 라벨 + 굵은 제목으로 위계를 만든다
//   · 우수 사연은 텍스트 3줄 나열 대신 가로 카드로 (사진이 있으면 사진이 주인공)
//   · 피드 카드는 사진을 크게, 본문은 3줄까지만 — 훑을 수 있게
//   · 재촉하는 장치(타이머·소멸 압박)는 넣지 않는다
// 로직(불러오기·작성·좋아요·삭제)은 이전과 동일하다.

const MAX_IMAGES = 4

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  // 이메일 앞부분이 닉네임이 되면 길어질 수 있어 가운데 별표는 최대 3개로 줄인다.
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

// 섹션 머리 — 작은 회색 라벨 위, 굵은 제목 아래. 훑기만 해도 구조가 잡히게.
function SectionHead({ label, title, right }: { label: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <p className="text-[11.5px] text-ink-faint leading-none mb-1.5">{label}</p>
        <h2 className="text-[17px] font-bold text-ink leading-tight">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export default function AppDiary() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [myName, setMyName] = useState<string | null>(null)
  const [sort, setSort] = useState<DiarySort>('recent')
  const [feed, setFeed] = useState<Diary[]>([])
  const [best, setBest] = useState<BestDiary[]>([])
  const [loading, setLoading] = useState(true)

  const [composing, setComposing] = useState(false)
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }

  const load = useCallback(async (s: DiarySort) => {
    const { data: { session } } = await supabase.auth.getSession()
    setLoggedIn(!!session)
    if (session) {
      // 마이페이지와 같은 규칙 — 닉네임이 없으면 이메일 앞부분을 쓴다.
      const meta = session.user.user_metadata as { name?: string } | undefined
      setMyName(meta?.name || session.user.email?.split('@')[0] || null)
    }
    const [rows, bests] = await Promise.all([getDiaryFeed(s, 30), getMonthlyBestDiaries(3)])
    setFeed(rows)
    setBest(bests)
    setLoading(false)
  }, [])

  useEffect(() => { void load(sort) }, [load, sort])

  // 미리보기 objectURL 정리 — 안 지우면 메모리에 계속 남는다.
  useEffect(() => () => { previews.forEach((u) => URL.revokeObjectURL(u)) }, [previews])

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (!picked.length) return
    const next = [...files, ...picked].slice(0, MAX_IMAGES)
    previews.forEach((u) => URL.revokeObjectURL(u))
    setFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const removeFile = (idx: number) => {
    const next = files.filter((_, i) => i !== idx)
    previews.forEach((u) => URL.revokeObjectURL(u))
    setFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  const resetComposer = () => {
    previews.forEach((u) => URL.revokeObjectURL(u))
    setContent(''); setFiles([]); setPreviews([]); setComposing(false)
  }

  const submit = async () => {
    if (content.trim().length < 5) { showToast('내용을 5자 이상 적어주세요'); return }
    setSaving(true)
    const urls = files.length > 0 ? await uploadDiaryImages(files) : []
    if (files.length > 0 && urls.length === 0) {
      setSaving(false); showToast('사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요'); return
    }
    const res = await createDiary(content, urls, myName)
    setSaving(false)
    if (!res || !res.diary_id) { showToast(res?.message || '등록에 실패했어요'); return }
    resetComposer()
    showToast(res.awarded > 0 ? `${res.awarded}P를 받았어요` : '이야기를 올렸어요')
    void load(sort)
  }

  // 좋아요(평가) 대신 공감 반응으로 바꿨다(2026-09-07) — 누르는 처리는 ReactionBar 안에 있고,
  // 여기서는 결과만 받아 목록에 반영한다(정렬·재조회 없이 그 자리에서만 바뀐다).
  const onReacted = (id: string, next: { pat: number; same: number; cheer: number; my_kind: Diary['my_kind'] }) => {
    setFeed((prev) => prev.map((x) => (x.id === id ? { ...x, ...next } : x)))
  }

  const onDelete = async (d: Diary) => {
    if (!window.confirm('이 이야기를 삭제할까요?')) return
    const ok = await deleteDiary(d.id)
    if (!ok) { showToast('삭제하지 못했어요'); return }
    setFeed((prev) => prev.filter((x) => x.id !== d.id))
  }

  const openComposer = () => {
    if (!loggedIn) { navigate('/app/login'); return }
    setComposing(true)
  }

  return (
    <AppFrame>
      <BackHeader title="이야기" />
      <StoryTabs current="/app/diary" />

      {/* 쓰기 — 화면에 들어오면 가장 먼저 보이는 행동 */}
      <section className="px-5 pt-4">
        {!composing ? (
          <button
            onClick={openComposer}
            className="w-full rounded-card bg-ink text-paper px-5 py-4 text-left focus:outline-none focus-visible:shadow-ring"
          >
            <span className="block text-[15px] font-bold leading-tight">오늘 어떤 하루였나요?</span>
            <span className="block text-[12.5px] opacity-75 mt-1">사소한 하루도 누군가에겐 위로가 됩니다</span>
          </button>
        ) : (
          <div className="rounded-card border border-rule bg-paper p-4">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="오늘의 이야기를 자유롭게 적어주세요. (5자 이상)"
              className="w-full resize-none text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
            />

            {previews.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto">
                {previews.map((src, i) => (
                  <div key={src} className="relative shrink-0">
                    <img src={src} alt="" className="w-20 h-20 rounded-lg object-cover" />
                    <button onClick={() => removeFile(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ink text-paper text-[11px] leading-none">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-rule">
              <div className="flex items-center gap-3">
                <button onClick={() => fileRef.current?.click()} disabled={files.length >= MAX_IMAGES}
                  className="text-[13px] text-ink-soft disabled:opacity-40">
                  사진 {files.length}/{MAX_IMAGES}
                </button>
                <span className="text-[11px] text-ink-faint">{content.length}/1000</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={resetComposer} disabled={saving}
                  className="px-3 py-2 rounded-control text-[13px] text-ink-soft">취소</button>
                <button onClick={() => void submit()} disabled={saving}
                  className="px-4 py-2 rounded-control bg-signal-blue text-paper text-[13px] font-semibold disabled:opacity-50">
                  {saving ? '올리는 중…' : '올리기'}
                </button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pickFiles} />
          </div>
        )}
      </section>

      {/* 이달의 우수 사연 — 텍스트 나열 대신 가로 카드 */}
      {best.length > 0 && (
        <section className="px-5 pt-8">
          <SectionHead label="이번 달, 많은 분이 마음을 눌러준" title="이달의 이야기" />
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-1 px-1 snap-x">
            {best.map((b, i) => (
              <div
                key={b.id}
                className="shrink-0 w-[190px] snap-start rounded-card border border-rule bg-paper p-4"
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-ink text-paper text-[11px] font-bold mb-2.5">
                  {i + 1}
                </span>
                <p className="text-[13px] text-ink leading-snug line-clamp-3 min-h-[3.6em]">{b.content}</p>
                {b.reaction_count > 0 && (
                  <p className="text-[11.5px] text-ink-faint mt-2.5">🤍 {b.reaction_count}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 피드 */}
      <section className="px-5 pt-8 pb-28">
        <SectionHead
          label="오늘도 각자의 하루를 살아갑니다"
          title="사람들의 이야기"
          right={
            <div className="flex items-center gap-1 shrink-0">
              {([['recent', '최신'], ['popular', '인기']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setSort(key)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-semibold transition ${
                    sort === key ? 'bg-ink text-paper' : 'text-ink-faint'}`}>
                  {label}
                </button>
              ))}
            </div>
          }
        />

        {loading ? (
          <p className="py-12 text-center text-[13px] text-ink-faint">불러오는 중…</p>
        ) : feed.length === 0 ? (
          <button
            onClick={openComposer}
            className="w-full rounded-card border border-dashed border-rule bg-quiet/40 px-5 py-12 text-center focus:outline-none focus-visible:shadow-ring"
          >
            <p className="text-[14px] font-semibold text-ink">아직 아무도 오늘을 남기지 않았어요</p>
            <p className="text-[12.5px] text-ink-faint mt-1.5">첫 이야기의 주인공이 되어주세요</p>
          </button>
        ) : (
          <ul className="space-y-4">
            {feed.map((d) => {
              const imgs = d.images ?? []
              return (
                <li key={d.id} className="rounded-card border border-rule bg-paper overflow-hidden">
                  {/* 사진이 있으면 사진이 주인공 — 카드 맨 위에 크게 */}
                  {imgs.length > 0 && (
                    <div className={`grid gap-0.5 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {imgs.slice(0, 4).map((src, i) => (
                        <div
                          key={`${src}-${i}`}
                          className={`bg-quiet overflow-hidden ${
                            imgs.length === 1 ? 'aspect-[4/3]' : 'aspect-square'
                          } ${imgs.length === 3 && i === 0 ? 'col-span-2 aspect-[2/1]' : ''}`}
                        >
                          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4">
                    <p className="text-[14px] text-ink whitespace-pre-wrap leading-relaxed line-clamp-4">
                      {d.content}
                    </p>

                    <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-rule">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] font-semibold text-ink truncate">{maskName(d.nickname)}</span>
                        <span className="text-[11.5px] text-ink-faint shrink-0">{timeAgo(d.created_at)}</span>
                      </div>
                      {d.is_mine && (
                        <button onClick={() => void onDelete(d)} className="text-[11.5px] text-ink-faint shrink-0">삭제</button>
                      )}
                    </div>

                    {/* 공감 — 내 글에는 띄우지 않는다(셀프 공감은 적립도 안 되고 의미도 없다) */}
                    {!d.is_mine && (
                      <div className="mt-3">
                        <ReactionBar
                          target="diary"
                          targetId={d.id}
                          counts={d}
                          loggedIn={!!loggedIn}
                          size="sm"
                          onChange={(next) => onReacted(d.id, next)}
                          onAward={(p) => showToast(`${p}P를 받았어요`)}
                        />
                      </div>
                    )}

                    {/* 댓글 — 내 글에도 달린다(글쓴이가 답을 해야 대화가 된다) */}
                    <DiaryComments
                      diaryId={d.id}
                      count={d.comment_count}
                      loggedIn={!!loggedIn}
                      myName={myName}
                      onCountChange={(n) => setFeed((prev) => prev.map((x) =>
                        (x.id === d.id ? { ...x, comment_count: n } : x)))}
                      onAward={(p) => showToast(`${p}P를 받았어요`)}
                      onNotice={showToast}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-ink text-paper text-[13px] shadow-lg">
          {toast}
        </div>
      )}

      <BottomNav />
    </AppFrame>
  )
}
