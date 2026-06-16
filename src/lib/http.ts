import { API_BASE } from './config'

let accessToken: string | null = null
let refreshToken: string | null = null
let onAuthFail: (() => void) | null = null
let refreshing: Promise<boolean> | null = null

const LS_REFRESH = 'chazh.refresh'

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access
  refreshToken = refresh
}
export function getAccessToken() { return accessToken }
export function setOnAuthFail(cb: () => void) { onAuthFail = cb }

// Ротация refresh-токена. Single-flight: параллельные 401 не дёргают /auth/refresh повторно
// (иначе reuse-detection погасит все сессии — см. бриф).
async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false
  if (!refreshing) {
    const rt = refreshToken
    refreshing = fetch(API_BASE + '/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
    })
      .then(async (r) => {
        if (!r.ok) return false
        const t = await r.json()
        accessToken = t.accessToken
        refreshToken = t.refreshToken
        localStorage.setItem(LS_REFRESH, t.refreshToken) // refresh одноразовый — сразу заменяем
        return true
      })
      .catch(() => false)
      .finally(() => { refreshing = null })
  }
  return refreshing
}

export async function http<T>(path: string, opts: RequestInit = {}, _retried = false): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (res.status === 401 && !_retried) {
    const ok = await doRefresh()
    if (ok) return http<T>(path, opts, true)
    onAuthFail?.()
    throw new HttpError(401, 'unauthorized')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new HttpError(res.status, body)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export class HttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}`)
  }
}

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
