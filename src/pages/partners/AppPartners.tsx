import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PartnersEntryLayout from '../../components/partners/PartnersEntryLayout'
import { supabase } from '../../lib/supabase'
import { getMyAffiliate } from '../../lib/affiliate'

// 파트너스 입구 — 사람 종류에 따라 다르게 보여준다(2026-10-14 대표님: 파트너스 가입과 기존 회원은 차별).
//  · 이미 파트너스 → 바로 개인 파트너스 홈
//  · 로그인한 쇼핑몰 회원(파트너스 아님) → "이미 회원이에요, 파트너스 정보만 등록" (가입 단계 없음)
//  · 로그인 안 함 → 처음이에요(회원가입+파트너스) / 이미 쇼핑몰 회원이에요(로그인) / 이미 파트너스예요(로그인)
// PC·모바일 모두 같은 컴포넌트가 폭에 따라 배치만 바꾼다(partnersEntry.css).
export default function AppPartners() {
  const navigate = useNavigate()
  const [state, setState] = useState<'checking' | 'guest' | 'member'>('checking')
  const [who, setWho] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      if (!session) { setState('guest'); return }
      const aff = await getMyAffiliate()
      if (!active) return
      if (aff) { navigate('/app/partners/home', { replace: true }); return }
      const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>
      setWho(String(meta.name ?? meta.nickname ?? meta.full_name ?? session.user.email ?? ''))
      setState('member')
    })()
    return () => { active = false }
  }, [navigate])

  return (
    <PartnersEntryLayout backTo="/app/mypage">
      {state === 'checking' && <p className="pe-sub" style={{ textAlign: 'center', padding: '24px 0' }}>불러오는 중…</p>}

      {state === 'member' && (
        <>
          <h2>이미 뷰티그라운드 회원이세요</h2>
          <p className="pe-sub">새로 가입하지 않아도 돼요. 수수료를 받을 정보만 등록하면 바로 파트너스가 됩니다.</p>
          <div className="pe-me">{who ? <><b>{who}</b> 님의 계정으로 진행해요</> : '지금 로그인한 계정으로 진행해요'}</div>
          <button type="button" className="pe-btn" onClick={() => navigate('/app/partners/info')}>파트너스 정보 등록하기</button>
          <p className="pe-sub" style={{ marginTop: 12 }}>개인정보·정산 계좌를 한 번만 입력하면 끝나요. 쇼핑 계정과 구매 내역은 그대로예요.</p>
        </>
      )}

      {state === 'guest' && (
        <>
          <h2>어떤 분이세요?</h2>
          <p className="pe-sub">해당하는 하나를 골라 주세요. 쇼핑몰 회원은 새로 가입하지 않아도 돼요.</p>
          <div className="pe-cards">
            <button type="button" className="pe-card primary" onClick={() => navigate('/app/partners/signup?mode=new')}>
              <span className="tag">처음</span>
              <span><span className="pe-card-t" style={{ display: 'block' }}>처음이에요 · 회원가입하고 시작</span>
                <span className="pe-card-sub" style={{ display: 'block' }}>카카오·네이버·Apple로 가입 → 파트너스 등록</span></span>
            </button>
            <button type="button" className="pe-card" onClick={() => navigate('/app/partners/signup?mode=member')}>
              <span className="tag">회원</span>
              <span><span className="pe-card-t" style={{ display: 'block' }}>이미 쇼핑몰 회원이에요</span>
                <span className="pe-card-sub" style={{ display: 'block' }}>내 계정으로 로그인 → 파트너스 정보만 등록</span></span>
            </button>
            <button type="button" className="pe-card" onClick={() => navigate('/app/partners/signup?mode=partner')}>
              <span className="tag">파트너스</span>
              <span><span className="pe-card-t" style={{ display: 'block' }}>이미 파트너스예요</span>
                <span className="pe-card-sub" style={{ display: 'block' }}>로그인 → 내 링크·정산 보기</span></span>
            </button>
          </div>
        </>
      )}
    </PartnersEntryLayout>
  )
}
