import { useEffect, useRef, useState } from 'react'
import { ws, type WsStatus } from '@/lib/ws'
import { sfx } from '@/lib/sfx'

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
  // звук связи: «отключение» — только если до этого были онлайн (без ложного бипа на старте);
  // «восстановление» — только если реально падали
  const everOnline = useRef(false)
  const wasDown = useRef(false)
  useEffect(() => {
    if (status === 'online' && !offline) {
      if (wasDown.current) { wasDown.current = false; sfx.reconnect() }
      everOnline.current = true
    } else if (everOnline.current && !wasDown.current) {
      wasDown.current = true; sfx.disconnect()
    }
  }, [status, offline])

  if (status === 'online' && !offline) return null

  const text = offline ? 'Нет соединения с сервером' : 'Переподключение…'
  return (
    <div style={{
      flex: 'none', height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontSize: 12.5, fontWeight: 600, animation: 'bannerIn .25s ease',
      background: offline ? 'var(--danger-tint)' : 'var(--warn-tint)',
      color: offline ? 'var(--danger)' : 'var(--warn)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor', animation: 'live 1.6s infinite' }} />
      {text}
    </div>
  )
}
