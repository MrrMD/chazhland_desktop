// Общий саундпад сервера: клипы хранятся на бэке (GET /soundboard) — что загрузил один, видят и
// проигрывают ВСЕ. Звук микшируется в отдельный аудио-трек, который voice.ts публикует в комнату
// (его слышат остальные); триггерящий слышит клип и локально. Файл грузится через presign (api.uploadFile).
import { api, type SoundClip } from './api'

class Soundboard {
  private ctx: AudioContext | null = null
  private dest: MediaStreamAudioDestinationNode | null = null
  private localGain: GainNode | null = null // громкость МОИХ триггеров локально (не влияет на публикуемый трек)
  private localVolume = 1
  private buffers = new Map<string, AudioBuffer>() // декодированные клипы по url
  private clips: SoundClip[] = []
  private loaded = false
  private cbs = new Set<(c: SoundClip[]) => void>()

  subscribe(cb: (c: SoundClip[]) => void): () => void {
    this.cbs.add(cb)
    cb(this.clips)
    if (!this.loaded) void this.refresh()
    return () => { this.cbs.delete(cb) }
  }
  private emit() { this.cbs.forEach((c) => c(this.clips)) }
  list(): SoundClip[] { return this.clips }

  async refresh(): Promise<void> {
    try { this.clips = await api.listSoundboard(); this.loaded = true; this.emit() } catch { /* нет доступа — пусто */ }
  }

  // ---- аудио-выход (микшер клипов) ----
  private audio(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      this.dest = this.ctx.createMediaStreamDestination()
      this.localGain = this.ctx.createGain()
      this.localGain.gain.value = this.localVolume
      this.localGain.connect(this.ctx.destination) // локальный путь (то, что слышу я), масштабируется громкостью
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }

  // громкость МОЕГО локального воспроизведения саундпада (свои триггеры). На публикуемый трек —
  // то, что слышат другие — НЕ влияет. Может превышать 1 (GainNode усиливает).
  setVolume(v: number) {
    this.localVolume = Math.max(0, v)
    if (this.localGain) this.localGain.gain.value = this.localVolume
  }
  // трек, который voice.ts публикует в комнату (его слышат остальные). Создаётся лениво; молчит, пока
  // ничего не играет (DTX давит тишину). voice публикует его клон — чтобы LiveKit при выходе из канала
  // не остановил наш постоянный микшер.
  outputTrack(): MediaStreamTrack | null {
    this.audio()
    return this.dest?.stream.getAudioTracks()[0] ?? null
  }

  // ---- управление клипами ----
  async add(file: File, name: string): Promise<void> {
    const up = await api.uploadFile(file) // presign + прямой PUT в MinIO
    const clip = await api.createSoundboard(name.trim() || file.name.replace(/\.[^.]+$/, ''), up.objectKey)
    this.clips = [clip, ...this.clips]
    this.emit()
  }
  async remove(id: string): Promise<void> {
    await api.deleteSoundboard(id)
    this.clips = this.clips.filter((c) => c.id !== id)
    this.emit()
  }

  private async buffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url)
    if (cached) return cached
    try {
      const res = await fetch(url) // webSecurity:false в Electron → cross-origin fetch к s3 ок
      const buf = await this.audio().decodeAudioData(await res.arrayBuffer())
      this.buffers.set(url, buf)
      return buf
    } catch { return null }
  }

  async play(clip: SoundClip): Promise<void> {
    const ctx = this.audio()
    const buf = await this.buffer(clip.url)
    if (!buf || !this.dest) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.dest)                       // → публикуемый трек: слышат все в канале (полная громкость)
    src.connect(this.localGain ?? ctx.destination) // → локально: триггерящий слышит, масштабируется громкостью
    src.start()
  }
}

export const soundboard = new Soundboard()
