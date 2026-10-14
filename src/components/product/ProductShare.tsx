import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { IconBrandFacebook, IconBrandX, IconCopy, IconLink, IconSend2, IconShare3 } from '@tabler/icons-react'
import { getMyAffiliate } from '../../lib/affiliate'
import {
  canNativeShare, copyToClipboard, plainProductUrl, resolveShareUrl, shareToKakao,
} from '../../lib/shareProduct'

// 제품 "링크 복사" · "공유하기" (2026-10-14) — 모든 제품 상세에서 쓴다.
// 활동 중인 파트너가 누르면 내 파트너스 링크로, 그 밖의 사람은 제품 주소 그대로 복사·공유된다(lib/shareProduct.ts).

export interface ProductShareInfo {
  productId: string
  name: string
  price: number
  imageUrl: string | null
}

export function useProductShare(info: ProductShareInfo, onNotice: (msg: string) => void) {
  const [isPartner, setIsPartner] = useState<boolean | null>(null) // null = 확인 중
  const [sheetOpen, setSheetOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [mine, setMine] = useState(false)
  const infoRef = useRef(info)
  infoRef.current = info

  useEffect(() => {
    let alive = true
    getMyAffiliate().then((a) => { if (alive) setIsPartner(!!a && a.status === 'active') }).catch(() => { if (alive) setIsPartner(false) })
    return () => { alive = false }
  }, [])

  // 제품이 바뀌면 이전 제품의 주소를 버린다
  useEffect(() => { setShareUrl(null); setSheetOpen(false) }, [info.productId])

  const copy = useCallback(async () => {
    const p = resolveShareUrl(infoRef.current.productId)
    const ok = await copyToClipboard(p.then((r) => r.url))
    const r = await p
    onNotice(ok ? (r.mine ? '내 파트너스 링크를 복사했어요' : '링크를 복사했어요') : '복사하지 못했어요. 잠시 후 다시 시도해 주세요')
  }, [onNotice])

  const openSheet = useCallback(async () => {
    setSheetOpen(true)
    setShareUrl(null)
    const r = await resolveShareUrl(infoRef.current.productId)
    setShareUrl(r.url); setMine(r.mine)
  }, [])

  return { isPartner, sheetOpen, setSheetOpen, shareUrl, mine, copy, openSheet, info, onNotice }
}

export type ProductShareCtl = ReturnType<typeof useProductShare>

// 가격 아래에 놓는 두 개의 버튼
export function ProductShareBar({ ctl }: { ctl: ProductShareCtl }) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void ctl.copy()}
          className="min-h-11 rounded-control border border-solid border-rule bg-paper text-ink text-[14px] font-semibold flex items-center justify-center gap-1.5 focus:outline-none focus-visible:shadow-ring">
          <IconCopy size={17} stroke={1.8} aria-hidden="true" />링크 복사
        </button>
        <button type="button" onClick={() => void ctl.openSheet()}
          className="min-h-11 rounded-control border border-solid border-ink bg-ink text-paper text-[14px] font-semibold flex items-center justify-center gap-1.5 focus:outline-none focus-visible:shadow-ring">
          <IconSend2 size={17} stroke={1.8} aria-hidden="true" />공유하기
        </button>
      </div>
      {ctl.isPartner ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">파트너스 회원이라 <b className="text-ink-soft">내 파트너스 링크</b>로 복사·공유돼요.</p>
      ) : (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-faint">
          파트너스가 되면 공유한 링크로 구매가 생길 때 판매 수수료를 받아요.{' '}
          <Link to="/app/partners" className="underline underline-offset-2 text-ink-soft">알아보기</Link>
        </p>
      )}
    </div>
  )
}

// 공유 창 — 카카오톡·페이스북·X·네이버·링크 복사·다른 앱
export function ProductShareSheet({ ctl }: { ctl: ProductShareCtl }) {
  const { sheetOpen, setSheetOpen, shareUrl, mine, info, onNotice } = ctl
  if (!sheetOpen) return null
  const url = shareUrl
  const ready = url !== null
  const close = () => setSheetOpen(false)
  const text = `${info.name} · ${info.price.toLocaleString('ko-KR')}원`

  const open = (href: string) => { window.open(href, '_blank', 'noopener,width=600,height=640'); close() }
  const native = async () => {
    if (!url) return
    try { await navigator.share({ title: info.name, text, url }) } catch { /* 사용자가 닫음 */ }
    close()
  }
  const kakao = async () => {
    if (!url) return
    const ok = await shareToKakao({ url, title: info.name, description: `${info.price.toLocaleString('ko-KR')}원`, imageUrl: info.imageUrl })
    if (ok) { close(); return }
    if (canNativeShare()) { await native(); return } // 휴대폰 공유창에서 카카오톡을 고른다
    const copied = await copyToClipboard(Promise.resolve(url))
    onNotice(copied ? '링크를 복사했어요. 카카오톡에 붙여넣어 보내세요' : '복사하지 못했어요')
    close()
  }
  const copy = async () => {
    if (!url) return
    const copied = await copyToClipboard(Promise.resolve(url))
    onNotice(copied ? (mine ? '내 파트너스 링크를 복사했어요' : '링크를 복사했어요') : '복사하지 못했어요')
    close()
  }

  const item = 'flex flex-col items-center gap-1.5 w-[64px] focus:outline-none disabled:opacity-40'
  const circle = 'w-12 h-12 rounded-full flex items-center justify-center'
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="제품 공유하기">
      <div className="absolute inset-0 bg-black/40" onClick={close} />
      <div className="absolute left-0 right-0 bottom-0 mx-auto max-w-[480px] bg-paper rounded-t-2xl px-5 pt-5 pb-7 shadow-[0_-8px_24px_rgba(0,0,0,0.2)]">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[16px] font-bold text-ink">공유하기</p>
          <button type="button" onClick={close} className="min-h-11 min-w-11 text-[20px] text-ink-soft" aria-label="닫기">×</button>
        </div>
        <p className="text-[12px] text-ink-soft mb-4 break-all">
          {mine && <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded-full bg-quiet text-ink font-semibold">내 파트너스 링크</span>}
          {ready ? url : '링크를 준비하고 있어요…'}
        </p>
        <div className="flex items-start justify-between gap-1">
          <button type="button" className={item} disabled={!ready} onClick={() => void kakao()}>
            <span className={circle} style={{ background: '#FEE500' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="rgba(0,0,0,0.85)" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.79c.51.05 1.03.08 1.56.08 5.52 0 10-3.54 10-7.85C22 6.54 17.52 3 12 3z" /></svg>
            </span>
            <span className="text-[11.5px] text-ink">카카오톡</span>
          </button>
          <button type="button" className={item} disabled={!ready} onClick={() => url && open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}>
            <span className={`${circle} bg-[#1877F2]`}><IconBrandFacebook size={22} className="text-white" /></span>
            <span className="text-[11.5px] text-ink">페이스북</span>
          </button>
          <button type="button" className={item} disabled={!ready} onClick={() => url && open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(info.name)}`)}>
            <span className={`${circle} bg-black`}><IconBrandX size={20} className="text-white" /></span>
            <span className="text-[11.5px] text-ink">X</span>
          </button>
          <button type="button" className={item} disabled={!ready} onClick={() => url && open(`https://share.naver.com/web/shareView?url=${encodeURIComponent(url)}&title=${encodeURIComponent(info.name)}`)}>
            <span className={`${circle} bg-[#03C75A]`}><span className="text-white font-bold text-[18px] leading-none">N</span></span>
            <span className="text-[11.5px] text-ink">네이버</span>
          </button>
          <button type="button" className={item} disabled={!ready} onClick={() => void copy()}>
            <span className={`${circle} bg-quiet`}><IconLink size={20} className="text-ink" /></span>
            <span className="text-[11.5px] text-ink">링크 복사</span>
          </button>
        </div>
        {canNativeShare() && (
          <button type="button" disabled={!ready} onClick={() => void native()}
            className="mt-4 w-full min-h-11 rounded-control border border-solid border-rule text-[14px] font-semibold text-ink flex items-center justify-center gap-1.5 disabled:opacity-40">
            <IconShare3 size={17} stroke={1.8} aria-hidden="true" />다른 앱으로 공유
          </button>
        )}
      </div>
    </div>
  )
}

export { plainProductUrl }
