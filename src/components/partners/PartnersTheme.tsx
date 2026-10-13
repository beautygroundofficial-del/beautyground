import type { ReactNode } from 'react'
import './partnersTheme.css'

// 파트너스 화면을 감싸 ERP 디자인 색을 입힌다 — 다른 쇼핑몰 화면에는 영향이 없다(스타일은 .partners-erp 안에서만).
export default function PartnersTheme({ children }: { children: ReactNode }) {
  return <div className="partners-erp">{children}</div>
}
