import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type AuthState = 'loading' | 'authed' | 'guest'

export default function RequireDeptAuth() {
  const [state, setState] = useState<AuthState>('loading')
  const location = useLocation()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(data.session ? 'authed' : 'guest')
    })
  }, [])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-hint text-[14px]">
        불러오는 중…
      </div>
    )
  }

  if (state === 'guest') {
    return (
      <Navigate
        to="/dept/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    )
  }

  return <Outlet />
}
