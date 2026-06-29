import { useEffect, useRef } from 'react'

/**
 * Настоящие canvas-косметики верхних тиров (вместо CSS-заглушек): живые частицы (снег/сакура/искры/
 * звёзды) и анимированная туманность. Рисуются на <canvas>, ресайзятся под контейнер, чистят rAF при
 * размонтировании. Лёгкие (≤ ~46 частиц, без зависимостей). Заполняют родителя (position:absolute inset:0).
 */
export type ParticleKind = 'snow' | 'sakura' | 'embers' | 'stars'

interface P { x: number; y: number; vx: number; vy: number; r: number; a: number; t: number }

const CFG: Record<ParticleKind, { n: number; color: (p: P) => string; spawn: (w: number, h: number) => P; step: (p: P, w: number, h: number) => void; shape?: 'circle' | 'petal' }> = {
  snow: {
    n: 46,
    color: (p) => `rgba(255,255,255,${0.4 + p.a * 0.5})`,
    spawn: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: 0.25 + Math.random() * 0.5, r: 1 + Math.random() * 2, a: Math.random(), t: Math.random() * 6.28 }),
    step: (p, w, h) => { p.t += 0.02; p.x += p.vx + Math.sin(p.t) * 0.2; p.y += p.vy; if (p.y > h + 4) { p.y = -4; p.x = Math.random() * w } if (p.x < -4) p.x = w + 4; if (p.x > w + 4) p.x = -4 },
  },
  sakura: {
    n: 30, shape: 'petal',
    color: (p) => `rgba(255,${150 + Math.floor(p.a * 60)},200,${0.55 + p.a * 0.35})`,
    spawn: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, vx: 0.3 + Math.random() * 0.4, vy: 0.3 + Math.random() * 0.4, r: 2.5 + Math.random() * 2.5, a: Math.random(), t: Math.random() * 6.28 }),
    step: (p, w, h) => { p.t += 0.03; p.x += p.vx + Math.sin(p.t) * 0.5; p.y += p.vy; if (p.y > h + 6) { p.y = -6; p.x = Math.random() * w } if (p.x > w + 6) p.x = -6 },
  },
  embers: {
    n: 38,
    color: (p) => `rgba(255,${120 + Math.floor(p.a * 110)},40,${0.35 + p.a * 0.55})`,
    spawn: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.3, vy: -(0.3 + Math.random() * 0.6), r: 1 + Math.random() * 2, a: Math.random(), t: Math.random() * 6.28 }),
    step: (p, w, h) => { p.t += 0.04; p.x += p.vx + Math.sin(p.t) * 0.3; p.y += p.vy; p.a -= 0.004; if (p.y < -4 || p.a <= 0) { p.y = h + 4; p.x = Math.random() * w; p.a = 0.5 + Math.random() * 0.5 } },
  },
  stars: {
    n: 44,
    color: (p) => `rgba(255,255,255,${0.2 + (0.5 + 0.5 * Math.sin(p.t)) * p.a})`,
    spawn: (w, h) => ({ x: Math.random() * w, y: Math.random() * h, vx: 0, vy: 0, r: 0.6 + Math.random() * 1.6, a: 0.4 + Math.random() * 0.6, t: Math.random() * 6.28 }),
    step: (p) => { p.t += 0.04 + p.r * 0.01 },
  },
}

export function ParticleField({ kind }: { kind: ParticleKind }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const ctx = cv.getContext('2d'); if (!ctx) return
    const cfg = CFG[kind]
    let raf = 0, w = 0, h = 0, parts: P[] = []
    const fit = () => {
      const r = cv.parentElement?.getBoundingClientRect()
      w = Math.max(1, Math.round(r?.width ?? cv.clientWidth)); h = Math.max(1, Math.round(r?.height ?? cv.clientHeight))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      parts = Array.from({ length: cfg.n }, () => cfg.spawn(w, h))
    }
    fit()
    const ro = new ResizeObserver(fit); if (cv.parentElement) ro.observe(cv.parentElement)
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of parts) {
        cfg.step(p, w, h)
        ctx.fillStyle = cfg.color(p)
        if (cfg.shape === 'petal') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.t)
          ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, 6.283); ctx.fill(); ctx.restore()
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [kind])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
}

/** Анимированная «туманность»: дрейфующие радиальные пятна на тёмном фоне (canvas, дешёвый блюр). */
export function NebulaField() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current; if (!cv) return
    const ctx = cv.getContext('2d'); if (!ctx) return
    const blobs = [
      { hue: 250, x: 0.3, y: 0.4, r: 0.5, t: 0 }, { hue: 160, x: 0.7, y: 0.6, r: 0.45, t: 2 },
      { hue: 320, x: 0.55, y: 0.3, r: 0.4, t: 4 }, { hue: 210, x: 0.4, y: 0.7, r: 0.42, t: 1 },
    ]
    let raf = 0, w = 0, h = 0
    const fit = () => {
      const r = cv.parentElement?.getBoundingClientRect()
      w = Math.max(1, Math.round(r?.width ?? 1)); h = Math.max(1, Math.round(r?.height ?? 1))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit); if (cv.parentElement) ro.observe(cv.parentElement)
    const draw = () => {
      ctx.fillStyle = '#0d0a1f'; ctx.fillRect(0, 0, w, h)
      const prev = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter'
      for (const b of blobs) {
        b.t += 0.006
        const cx = (b.x + Math.sin(b.t) * 0.08) * w, cy = (b.y + Math.cos(b.t * 0.8) * 0.08) * h
        const rad = b.r * Math.max(w, h)
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad)
        g.addColorStop(0, `hsla(${b.hue},80%,60%,0.5)`); g.addColorStop(1, 'hsla(0,0%,0%,0)')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.283); ctx.fill()
      }
      ctx.globalCompositeOperation = prev
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
}
