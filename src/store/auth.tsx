import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/api'
import { setAccessToken } from '@/lib/http'
import { ws } from '@/lib/ws'
import type { User } from '@/lib/types'

interface Session {
  user: User
  token: string
}

interface AuthCtx {
  session: Session | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  register: (p: { inviteCode: string; username: string; email: string; password: string }) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)
const LS_TOKEN = 'chazh.refresh'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)

  // авто-восстановление сессии при наличии токена (в mock — сразу)
  useEffect(() => {
    const t = localStorage.getItem(LS_TOKEN)
    if (!t) return
    setLoading(true)
    api.me()
      .then((user) => {
        setAccessToken(t)
        setSession({ user, token: t })
        ws.connect(t)
      })
      .catch(() => localStorage.removeItem(LS_TOKEN))
      .finally(() => setLoading(false))
  }, [])

  const apply = (token: string, user: User) => {
    localStorage.setItem(LS_TOKEN, token)
    setAccessToken(token)
    setSession({ user, token })
    ws.connect(token)
  }

  const value: AuthCtx = {
    session,
    loading,
    async login(login, password) {
      const { token, user } = await api.login(login, password)
      apply(token.accessToken, user)
    },
    async register(p) {
      const { token, user } = await api.register(p)
      apply(token.accessToken, user)
    },
    logout() {
      localStorage.removeItem(LS_TOKEN)
      setAccessToken(null)
      ws.disconnect()
      setSession(null)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
