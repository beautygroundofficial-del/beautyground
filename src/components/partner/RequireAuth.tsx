import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

type AuthState = 'loading' | 'authed' | 'guest'

export default function RequireAuth() {
  const [state, setState] = useState<AuthState>('loading')

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
    return <Navigate to="/partner/login" replace />
  }

  return <Outlet />
}
