import { useCallback, useEffect, useState } from 'react'
import { IconFlag } from '@tabler/icons-react'
import { adminBoardReports, categoryLabel, setBoardPostStatus, type BoardReportRow } from '../../lib/board'
import { adminContentReports, adminSetContentStatus, REPORT_TYPE_LABEL, type ContentReportRow } from '../../lib/reports'

// 신고된 속 이야기 — 운영자가 보고 가리거나 되살린다. (2026-09-10, 커뮤니티 로드맵 4-4 ④)
// 자동 숨김은 없다 — 오신고로 글이 사라지면 안 된다. 사람이 읽고 결정한다.
// 가려도 지워지지 않는다: 작성자에게는 "운영자가 가린 글"로 보이고, 되살릴 수 있다.

function maskName(name: string | null) {
  const n = (name ?? '').trim()
  if (!n) return '익명'
  if (n.length <= 2) return n[0] + '*'
  return n[0] + '*'.repeat(Math.min(n.length - 2, 3)) + n[n.length - 1]
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AdminBoardReports() {
  const [rows, setRows] = useState<BoardReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  // 속 이야기 외 신고(하루 이야기·답변·댓글·채팅) — supabase/community_block_filter.sql 4) (2026-09-28, 앱 심사 대응)
  const [others, setOthers] = useState<ContentReportRow[]>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, b] = await Promise.all([adminBoardReports(), adminContentReports()])
    setRows(a)
    setOthers(b)
    setLoading(false)
  }, [])

  const toggleOther = async (r: ContentReportRow) => {
    const isChat = r.target_type === 'chat'
    const next = r.status === 'hidden' ? 'visible' : 'hidden'
    const msg = isChat ? '이 채팅 메시지를 삭제할까요? 되돌릴 수 없습니다.' : next === 'hidden' ? '이 글을 가릴까요? 다른 사람에게 보이지 않습니다.' : '이 글을 다시 보이게 할까요?'
    if (!window.confirm(msg)) return
    const key = `${r.target_type}:${r.target_id}`
    setBusyKey(key)
    setError('')
    const ok = await adminSetContentStatus(r.target_type, r.target_id, next)
    setBusyKey(null)
    if (!ok) { setError('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); return }
    void load()
  }

  useEffect(() => { void load() }, [load])

  const toggle = async (r: BoardReportRow) => {
    const next = r.status === 'hidden' ? 'visible' : 'hidden'
    const msg = next === 'hidden'
      ? '이 글을 가릴까요? 작성자에게는 "운영자가 가린 글"로 보이고, 다른 사람에게는 보이지 않습니다.'
      : '이 글을 다시 보이게 할까요?'
    if (!window.confirm(msg)) return
    setBusyId(r.post_id)
    setError('')
    const ok = await setBoardPostStatus(r.post_id, next)
    setBusyId(null)
    if (!ok) { setError('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); return }
    void load()
  }

  return (
    <>
      <header className="h-[60px] bg-paper border-b border-rule flex items-center px-8 sticky top-0 z-20">
        <p className="text-[15px] font-semibold text-ink">속 이야기 신고</p>
      </header>

      <main className="max-w-[1200px] p-8">
        <h1 className="text-[22px] font-bold text-ink mb-2">속 이야기 신고</h1>
        <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">
          손님이 신고한 속 이야기 목록입니다. 자동으로 가리지 않습니다 — 여기서 읽고 결정하세요.
          <br />
          가려도 지워지지 않습니다. 작성자에게는 "운영자가 가린 글"로 보이고, 언제든 되살릴 수 있습니다.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-md px-4 py-3 mb-5">{error}</div>
        )}

        {loading ? (
          <div className="py-20 text-center text-[14px] text-ink-faint">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-24 bg-paper rounded-md border border-rule">
            <IconFlag size={40} className="text-rule mx-auto mb-3" />
            <p className="text-[14px] text-ink-faint">신고된 글이 없습니다</p>
          </div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">신고</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">종류</th>
                  <th className="px-4 py-3 font-medium">글</th>
                  <th className="px-4 py-3 font-medium">신고 사유</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">작성자</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">마지막 신고</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">처리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.post_id} className="border-b border-rule last:border-b-0 align-top">
                    <td className="px-4 py-3 font-bold text-ink tabular-nums">{r.report_count}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{categoryLabel(r.category)}</td>
                    <td className="px-4 py-3 text-ink max-w-[420px]">
                      <p className="line-clamp-3 whitespace-pre-wrap">{r.content}</p>
                      <a href={`/app/board/${r.post_id}`} target="_blank" rel="noreferrer" className="text-[12px] text-signal-blue hover:underline">
                        글 보기
                      </a>
                    </td>
                    <td className="px-4 py-3 text-ink-soft max-w-[260px]">
                      <p className="line-clamp-3">{r.reasons || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{maskName(r.nickname)}</td>
                    <td className="px-4 py-3 text-ink-soft whitespace-nowrap tabular-nums">{fmt(r.last_reported_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.status === 'hidden'
                        ? <span className="text-[12px] text-signal-red">가려짐</span>
                        : <span className="text-[12px] text-ink-faint">보이는 중</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busyId === r.post_id}
                        onClick={() => void toggle(r)}
                        className="text-[12px] text-signal-blue hover:underline disabled:opacity-40"
                      >
                        {busyId === r.post_id ? '처리 중…' : r.status === 'hidden' ? '되살리기' : '가리기'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="text-[18px] font-bold text-ink mt-12 mb-2">하루 이야기 · 답변 · 댓글 · 라이브 채팅 신고</h2>
        <p className="text-[13px] text-ink-soft mb-6 leading-relaxed">속 이야기 외 모든 글·댓글·채팅 신고입니다. 채팅은 가리기 대신 삭제됩니다.</p>
        {loading ? null : others.length === 0 ? (
          <div className="text-center py-16 bg-paper rounded-md border border-rule"><p className="text-[14px] text-ink-faint">신고된 글이 없습니다</p></div>
        ) : (
          <div className="bg-paper rounded-md border border-rule overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead>
                <tr className="border-b border-rule text-ink-soft">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">신고</th><th className="px-4 py-3 font-medium whitespace-nowrap">종류</th>
                  <th className="px-4 py-3 font-medium">내용</th><th className="px-4 py-3 font-medium">신고 사유</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">작성자</th><th className="px-4 py-3 font-medium whitespace-nowrap">마지막 신고</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">상태</th><th className="px-4 py-3 font-medium whitespace-nowrap">처리</th>
                </tr>
              </thead>
              <tbody>
                {others.map((r) => {
                  const key = `${r.target_type}:${r.target_id}`
                  const gone = r.content === null
                  return (
                    <tr key={key} className="border-b border-rule last:border-b-0 align-top">
                      <td className="px-4 py-3 font-bold text-ink tabular-nums">{r.report_count}</td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{REPORT_TYPE_LABEL[r.target_type]}</td>
                      <td className="px-4 py-3 text-ink max-w-[420px]"><p className="line-clamp-3 whitespace-pre-wrap">{gone ? '(이미 지워진 글)' : r.content}</p></td>
                      <td className="px-4 py-3 text-ink-soft max-w-[260px]"><p className="line-clamp-3">{r.reasons || '—'}</p></td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">{maskName(r.nickname)}</td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap tabular-nums">{fmt(r.last_reported_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{gone ? <span className="text-[12px] text-ink-faint">삭제됨</span> : r.status === 'hidden' ? <span className="text-[12px] text-signal-red">가려짐</span> : <span className="text-[12px] text-ink-faint">보이는 중</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {!gone && (
                          <button type="button" disabled={busyKey === key} onClick={() => void toggleOther(r)} className="text-[12px] text-signal-blue hover:underline disabled:opacity-40">
                            {busyKey === key ? '처리 중…' : r.target_type === 'chat' ? '삭제' : r.status === 'hidden' ? '되살리기' : '가리기'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  )
}
