import { useEffect, useRef } from 'react'
import { rankColor } from '@/lib/ranks'

/**
 * Праздничный момент апа уровня: конфетти-всплеск (canvas) + карточка «🎉 Новый уровень N» по центру,
 * авто-исчезает через ~3.4с. Оверлей не блокирует клики (pointerEvents:none). Запускается из MainWindow
 * по своему RANK_UP-событию.
 */
export function LevelUpCelebration({ level, unlocked, onDone }: { level: number; unlocked: number; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const color = rankColor(level)

  useEffect(() => {
    const t = window.setTimeout(onDone, 3400)
    return () => window.clearTimeout(t)
  }, [onDone])

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d'); if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = window.innerWidth, h = window.innerHeight
    const fit = () => { w = window.innerWidth; h = window.innerHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    fit(); window.addEventListener('resize', fit)
    const colors = ['#5b6cff', '#13b886', '#e0457b', '#e7c14b', '#ff8a3a', '#a855f7', '#ffffff']
    const N = 150
    const parts = Array.from({ length: N }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 220, y: h * 0.32 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 11, vy: -7 - Math.random() * 9,
      g: 0.22 + Math.random() * 0.12, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      s: 5 + Math.random() * 6, c: colors[(Math.random() * colors.length) | 0], life: 0,
    }))
    let raf = 0, frame = 0
    const draw = () => {
      frame++
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        p.life++; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr
        const alpha = Math.max(0, 1 - p.life / 150)
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rot)
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.5); ctx.restore()
      }
      if (frame < 210) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit) }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div style={{
        position: 'relative', marginTop: -40, padding: '22px 34px', borderRadius: 20, textAlign: 'center',
        background: 'var(--surface)', border: `2px solid ${color}`, boxShadow: `0 24px 60px -18px var(--shadow), 0 0 36px -8px ${color}`,
        animation: 'popIn .3s cubic-bezier(.22,1.2,.36,1)',
      }}>
        <div style={{ fontSize: 34, marginBottom: 2 }}>🎉</div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.06em', color: 'var(--text-3)', textTransform: 'uppercase' }}>Новый уровень</div>
        <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.05, color }}>{level}</div>
        {unlocked > 0 && <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-2)', marginTop: 6 }}>✨ Открыто косметики: {unlocked}</div>}
      </div>
    </div>
  )
}
