// 숫자/금액 포맷 헬퍼

export const comma = (n: number | null | undefined): string =>
  (n ?? 0).toLocaleString('ko-KR')

export const won = (n: number | null | undefined): string => `${comma(n)}원`

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
