import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { setTokens, setOnAuthFail, getAccessToken } from '@/lib/http'
import { ws } from '@/lib/ws'
import type { User } from '@/lib/types'

interface Session { user: User; token: string }

interface AuthCtx {
  session: Session | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  register: (p: { inviteCode: string; username: string; email: string; password: string }) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)
const LS_REFRESH = 'chazh.refresh'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)

  function clear() {
    localStorage.removeItem(LS_REFRESH)
    setTokens(null, null)
    ws.disconnect()
    setSession(null)
  }

  useEffect(() => {
    setOnAuthFail(clear) // 401 после неудачного refresh (reuse-detection/кик/смена пароля) → принудительный logout
    const saved = localStorage.getItem(LS_REFRESH)
    if (!saved) return
    setLoading(true)
    setTokens(null, saved) // нет access — первый /users/me словит 401 и обновится по refresh
    api.me()
      .then((user) => {
        const token = getAccessToken() ?? saved
        setSession({ user, token })
        ws.connect(token)
      })
      .catch(() => clear())
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function apply(access: string, refresh: string, user: User) {
    localStorage.setItem(LS_REFRESH, refresh)
    setTokens(access, refresh)
    setSession({ user, token: access })
    ws.connect(access)
  }

  const value: AuthCtx = {
    session,
    loading,
    async login(login, password) {
      const { token, user } = await api.login(login, password)
      apply(token.accessToken, token.refreshToken, user)
    },
    async register(p) {
      const { token, user } = await api.register(p)
      apply(token.accessToken, token.refreshToken, user)
    },
    logout: clear,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
