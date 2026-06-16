import { API_BASE } from './config'

let accessToken: string | null = null
export function setAccessToken(t: string | null) {
  accessToken = t
}
export function getAccessToken() {
  return accessToken
}

export async function http<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(opts.headers || {}),
    },
  })
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
