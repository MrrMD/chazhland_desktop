import { useEffect, useState } from 'react'
import { ws, type WsStatus } from '@/lib/ws'

// Глобальный баннер состояния соединения (global chrome): reconnect / оффлайн.
export function ConnectionBanner() {
  const [status, setStatus] = useState<WsStatus>(ws.getStatus())
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

  useEffect(() => ws.onStatus(setStatus), [])
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  const offline = !online
  if (status === 'online' && !offline) return null

  const text = offline ? 'Нет соединения с сервером' : 'Переподключение…'
  return (
    <div style={{
      flex: 'none', height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 12.5, fontWeight: 600,
      background: offline ? 'var(--danger-tint)' : 'var(--warn-tint)',
      color: offline ? 'var(--danger)' : 'var(--warn)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: 'live 1.6s infinite' }} />
      {text}
    </div>
  )
}
