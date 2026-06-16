// Заглушка голоса/демонстрации экрана. Реальная реализация — на livekit-client
// (POST /livekit/token участнику голосового канала). Подключим на этапе голоса.
export interface VoiceSession {
  channelId: string
  leave: () => void
}

export async function joinVoice(channelId: string): Promise<VoiceSession> {
  // TODO: const { token } = await http('/livekit/token', { channelId }); new Room().connect(...)
  return { channelId, leave: () => {} }
}

export async function startScreenShare(): Promise<void> {
  // TODO: room.localParticipant.setScreenShareEnabled(true)
}
