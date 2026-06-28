// Мик-цепочка обработки: src → [RNNoise?] → gain → dest. RNNoise — опенсорсный нейросетевой шумодав,
// работает ПОЛНОСТЬЮ в клиенте (Web Audio + WASM), без сервера/лицензии (в отличие от Krisp, которому
// нужен LiveKit Cloud). GainNode даёт ручную громкость микрофона (как «Input Volume» в Discord).
// Чистит/усиливает микрофон ДО отправки в LiveKit: оборачиваем в TrackProcessor, подменяющий дорожку.
// suppress и gain меняются на лету (reconnect / gain.value) — без пересоздания и перезагрузки WASM.
import { Track, type AudioProcessorOptions, type TrackProcessor } from 'livekit-client'
import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'

export const MIC_PROCESSOR_NAME = 'mic-chain'

export class MicProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = MIC_PROCESSOR_NAME
  processedTrack?: MediaStreamTrack
  private ctx: AudioContext | null = null
  private node: RnnoiseWorkletNode | null = null
  private src: MediaStreamAudioSourceNode | null = null
  private gain: GainNode | null = null
  private dest: MediaStreamAudioDestinationNode | null = null
  private suppress: boolean
  private gainValue: number

  constructor(opts: { suppress: boolean; gain: number }) {
    this.suppress = opts.suppress
    this.gainValue = opts.gain
  }

  async init(opts: AudioProcessorOptions): Promise<void> {
    // RNNoise рассчитан на 48 кГц — создаём свой контекст с этой частотой (не контекст LiveKit)
    const ctx = new AudioContext({ sampleRate: 48000 })
    this.ctx = ctx
    const wasmBinary = await loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl })
    await ctx.audioWorklet.addModule(rnnoiseWorkletUrl)
    this.node = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary })
    this.src = ctx.createMediaStreamSource(new MediaStream([opts.track]))
    this.gain = ctx.createGain()
    this.gain.gain.value = this.gainValue
    this.dest = ctx.createMediaStreamDestination()
    this.gain.connect(this.dest)
    this.wire()
    this.processedTrack = this.dest.stream.getAudioTracks()[0]
    // контекст может родиться 'suspended' (смена устройства / создание не на стеке user-gesture):
    // тогда процессор отдаёт НЕМОЙ трек, пока его не разбудить — делаем resume явно
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch { /* */ } }
  }

  // переключение src → node → gain (с шумодавом) ↔ src → gain (без) без пересоздания узлов
  private wire() {
    if (!this.src || !this.node || !this.gain) return
    try { this.src.disconnect() } catch { /* */ }
    try { this.node.disconnect() } catch { /* */ }
    if (this.suppress) this.src.connect(this.node).connect(this.gain)
    else this.src.connect(this.gain)
  }

  setSuppress(on: boolean) { if (on === this.suppress) return; this.suppress = on; this.wire() }
  setGain(v: number) { this.gainValue = v; if (this.gain) this.gain.gain.value = v }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy()
    await this.init(opts)
  }

  async destroy(): Promise<void> {
    try { this.src?.disconnect() } catch { /* */ }
    try { this.node?.disconnect(); this.node?.destroy() } catch { /* */ }
    try { this.gain?.disconnect() } catch { /* */ }
    try { this.dest?.disconnect() } catch { /* */ }
    try { await this.ctx?.close() } catch { /* */ }
    this.src = null; this.node = null; this.gain = null; this.dest = null; this.ctx = null
    this.processedTrack = undefined
  }
}

export function createMicProcessor(opts: { suppress: boolean; gain: number }): MicProcessor {
  return new MicProcessor(opts)
}
