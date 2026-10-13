import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './partnersShell.css'

// 파트너스 작업 화면 틀 — 매장 ERP처럼 왼쪽에 카테고리 버튼, 오른쪽에 내용 보드. (2026-10-14)
// 로그인한 파트너가 쓰는 화면(홈·인기 제품·내 링크·판매 정산·개인정보)을 감싼다.
// 입구(/app/partners)·회원가입은 아직 파트너가 아닌 손님이 보는 화면이라 기존 모바일 화면 그대로 둔다.

const NAV = [
  { key: 'home', label: '홈', to: '/app/partners/home' },
  { key: 'best', label: '인기 제품 TOP', to: '/app/partners/best' },
  { key: 'links', label: '내 링크', to: '/app/partners/links' },
  { key: 'settlement', label: '판매 내역 · 정산', to: '/app/partners/settlement' },
  { key: 'info', label: '개인정보 · 계좌', to: '/app/partners/info' },
] as const

export type PartnersNavKey = (typeof NAV)[number]['key']

export default function PartnersShell({
  active, title, right, hideNav = false, children,
}: {
  active: PartnersNavKey
  title: string
  right?: ReactNode
  hideNav?: boolean // 처음 등록 중에는 메뉴를 숨긴다(정보를 등록해야 다른 화면이 열린다)
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const logout = async () => {
    await supabase.auth.signOut()
    navigate('/app/home')
  }

  return (
    <div className="pt-layout">
      {!hideNav && (
        <>
          <aside className={`pt-sidebar${open ? ' open' : ''}`} aria-label="파트너스 메뉴">
            <div className="pt-mode"><b>BEAUTY GROUND</b><span>파트너스</span></div>
            <nav className="pt-nav">
              {NAV.map((n) => (
                <Link key={n.key} to={n.to} onClick={close} className={active === n.key ? 'active' : ''} aria-current={active === n.key ? 'page' : undefined}>
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="pt-bottom-group">
              <button type="button" className="pt-bottom" onClick={() => { close(); navigate('/app/home') }}>쇼핑몰로 돌아가기</button>
              <button type="button" className="pt-bottom danger" onClick={() => void logout()}>로그아웃</button>
            </div>
          </aside>
          <div className={`pt-overlay${open ? ' show' : ''}`} onClick={close} aria-hidden="true" />
        </>
      )}

      <div className={`pt-main${hideNav ? ' pt-solo' : ''}`}>
        <div className="pt-topbar">
          {!hideNav && (
            <button type="button" className="pt-hamburger" aria-label="메뉴 열기" aria-expanded={open} onClick={() => setOpen((v) => !v)}>☰</button>
          )}
          <b>{title}</b>
          {right}
        </div>
        <div className="pt-content">
          <div className="pt-pagehead"><h1>{title}</h1>{right}</div>
          <div className="pt-card">{children}</div>
        </div>
      </div>
    </div>
  )
}
