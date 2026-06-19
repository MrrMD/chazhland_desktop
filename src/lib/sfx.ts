// Короткие UI-звуки на действия (мут, оглушение, демонстрация, вход/выход участников) — как в Discord.
// Синтезируем тоны через Web Audio: ноль бинарных ассетов, ничего не грузим, CSP не задеваем.
// Включается тумблером в настройках голоса; AudioContext создаётся лениво и резюмится по первому действию
// пользователя (политика автоплея браузера).
const LS = 'chazh.sfx'

class Sfx {
  private ctx: AudioContext | null = null
  enabled = true
  private vol = 0.3

  constructor() {
    try {
      const raw = localStorage.getItem(LS)
      if (raw != null) this.enabled = JSON.parse(raw)
    } catch { /* по умолчанию включено */ }
  }

  setEnabled(on: boolean) { this.enabled = on; try { localStorage.setItem(LS, JSON.stringify(on)) } catch { /* */ } }

  private ac(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (!this.ctx) { try { this.ctx = new Ctor() } catch { return null } }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }

  // Последовательность коротких тонов с экспоненциальным затуханием (мягкий «бип» без щелчков).
  private play(freqs: number[], step = 0.085, type: OscillatorType = 'sine') {
    if (!this.enabled) return
    const ctx = this.ac()
    if (!ctx) return
    const t0 = ctx.currentTime
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(f, t0 + i * step)
      const s = t0 + i * step
      g.gain.setValueAtTime(0.0001, s)
      g.gain.exponentialRampToValueAtTime(this.vol, s + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, s + step)
      osc.connect(g).connect(ctx.destination)
      osc.start(s)
      osc.stop(s + step + 0.02)
    })
  }

  micOn() { this.play([620, 940]) }     // восходящий — микрофон включён
  micOff() { this.play([940, 620]) }    // нисходящий — выключен
  deafOn() { this.play([540, 360]) }    // оглушение
  deafOff() { this.play([360, 540]) }
  screenOn() { this.play([700, 900, 1150], 0.07) }  // старт демонстрации
  screenOff() { this.play([1150, 760], 0.07) }      // стоп демонстрации
  join() { this.play([523, 784], 0.075) }   // кто-то вошёл в голосовой
  leave() { this.play([784, 523], 0.075) }  // кто-то вышел
}

export const sfx = new Sfx()
