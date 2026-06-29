import { voice } from './voice'
import { api } from './api'

/**
 * Считает время РАЗГОВОРА локального пользователя (active-speaker) и периодически шлёт накопленные
 * секунды на бэк (`POST /voice/talk-heartbeat`) — это превращается в talk-XP. Серверный wall-clock-кап
 * не даёт начислить речи больше реального времени, так что клиенту достаточно честно копить секунды.
 *
 * Модель: ловим переходы speaking true/false по подписке на voice-стейт (накапливаем интервалы); раз в
 * FLUSH_MS «банкуем» текущий незакрытый интервал и отправляем floor(секунд) для активного канала.
 */
const FLUSH_MS = 30_000

let meId: string | null = null
let unsub: (() => void) | null = null
let timer: number | null = null
let accSeconds = 0          // накопленные, ещё не отправленные секунды речи
let speakingSince: number | null = null // ts начала текущего интервала речи (null — молчит)
let channelId: string | null = null     // канал, в котором копим (для отправки/смены)

function now() { return Date.now() }

/** Закрыть текущий интервал речи в acc (если открыт), сбросив точку отсчёта на now. */
function bank() {
  if (speakingSince !== null) {
    accSeconds += (now() - speakingSince) / 1000
    speakingSince = now()
  }
}

function flush() {
  bank()
  const secs = Math.floor(accSeconds)
  if (secs > 0 && channelId) {
    accSeconds -= secs
    api.talkHeartbeat(channelId, secs).catch(() => {})
  }
  // Авто-AFK: пока пользователь говорит (этим окном или прямо сейчас) — сбрасываем таймер AFK на бэке.
  // Молчание ⇒ пинга нет ⇒ через таймаут сервера он уезжает в AFK. Независимо от рангов.
  if (channelId && (secs > 0 || speakingSince !== null)) {
    api.voiceActivity().catch(() => {})
  }
}

function onVoice(s: { channelId: string | null; participants: { id: string; speaking: boolean }[] }) {
  const ch = s.channelId
  const speaking = !!ch && !!s.participants.find((p) => p.id === meId)?.speaking
  // смена канала или выход — отправить накопленное по старому каналу
  if (channelId && channelId !== ch) { flush(); speakingSince = null }
  channelId = ch
  if (speaking && speakingSince === null) {
    speakingSince = now()
  } else if (!speaking && speakingSince !== null) {
    accSeconds += (now() - speakingSince) / 1000
    speakingSince = null
  }
}

export const talkHeartbeat = {
  /** Запустить трекер для текущего пользователя (идемпотентно). */
  start(userId: string) {
    if (unsub) return
    meId = userId
    unsub = voice.subscribe(onVoice as (s: unknown) => void)
    timer = window.setInterval(flush, FLUSH_MS)
  },
  /** Остановить и отправить остаток. */
  stop() {
    flush()
    if (timer !== null) { window.clearInterval(timer); timer = null }
    if (unsub) { unsub(); unsub = null }
    speakingSince = null; accSeconds = 0; channelId = null
  },
}
