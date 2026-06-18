// RNNoise — опенсорсный нейросетевой шумодав, работает ПОЛНОСТЬЮ в клиенте (Web Audio + WASM),
// без сервера/лицензии (в отличие от Krisp, которому нужен LiveKit Cloud). Чистит микрофон ДО отправки
// в LiveKit: оборачиваем RnnoiseWorkletNode в LiveKit TrackProcessor, подменяющий аудиодорожку.
import { Track, type AudioProcessorOptions, type TrackProcessor } from 'livekit-client'
import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor'
import rnnoiseWorkletUrl from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url'
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url'
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url'

export const RNNOISE_PROCESSOR_NAME = 'rnnoise'

class RnnoiseProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = RNNOISE_PROCESSOR_NAME
  processedTrack?: MediaStreamTrack
  private ctx: AudioContext | null = null
  private node: RnnoiseWorkletNode | null = null
  private src: MediaStreamAudioSourceNode | null = null
  private dest: MediaStreamAudioDestinationNode | null = null

  async init(opts: AudioProcessorOptions): Promise<void> {
    // RNNoise рассчитан на 48 кГц — создаём свой контекст с этой частотой (не контекст LiveKit)
    const ctx = new AudioContext({ sampleRate: 48000 })
    this.ctx = ctx
    const wasmBinary = await loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl })
    await ctx.audioWorklet.addModule(rnnoiseWorkletUrl)
    this.node = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary })
    this.src = ctx.createMediaStreamSource(new MediaStream([opts.track]))
    this.dest = ctx.createMediaStreamDestination()
    this.src.connect(this.node).connect(this.dest)
    this.processedTrack = this.dest.stream.getAudioTracks()[0]
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.destroy()
    await this.init(opts)
  }

  async destroy(): Promise<void> {
    try { this.src?.disconnect() } catch { /* */ }
    try { this.node?.disconnect(); this.node?.destroy() } catch { /* */ }
    try { this.dest?.disconnect() } catch { /* */ }
    try { await this.ctx?.close() } catch { /* */ }
    this.src = null; this.node = null; this.dest = null; this.ctx = null
    this.processedTrack = undefined
  }
}

export function createRnnoiseProcessor(): TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  return new RnnoiseProcessor()
}
