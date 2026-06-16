import { useEffect, useMemo, useState } from 'react'
import { api, type ServerTree } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { voice, type VoiceState } from '@/lib/voice'
import type { ChannelType, Member, Message, Presence, ReadState } from '@/lib/types'
import { ChatFeed } from './ChatFeed'
import { Composer } from './Composer'
import { MembersRail } from './MembersRail'
import { ChannelSwitcher } from './ChannelSwitcher'
import { BottomBar } from './BottomBar'
import { WatchView } from './WatchView'
import { ScreenSharePane } from './ScreenSharePane'
import { VoiceSettingsModal } from './VoiceSettingsModal'
import { AdminScreen } from '@/features/admin/AdminScreen'
import { ws } from '@/lib/ws'

const TYPE_ICON: Record<ChannelType, string> = { TEXT: '#', VOICE: '🔊', WATCH: '▶' }

export function MainWindow() {
  const { session, logout } = useAuth()
  const user = session!.user

  const [tree, setTree] = useState<ServerTree>({ categories: [], channels: [] })
  const [members, setMembers] = useState<Member[]>([])
  const [readStates, setReadStates] = useState<ReadState[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [currentId, setCurrentId] = useState('')

  const [view, setView] = useState<'chat' | 'admin'>('chat')
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [membersExpanded, setMembersExpanded] = useState(true)
  const [status, setStatus] = useState<Presence>('online')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [vs, setVs] = useState<VoiceState>(voice.state)
  const [screenFull, setScreenFull] = useState(false)
  const [voiceSettingsOpen, setVoiceSettingsOpen] = useState(false)

  useEffect(() => voice.subscribe(setVs), [])
  useEffect(() => { if (!vs.screenTrack && screenFull) setScreenFull(false) }, [vs.screenTrack, screenFull])

  useEffect(() => {
    api.serverTree().then((t) => {
      setTree(t)
      // первый открытый канал — первый текстовый (или любой), а не захардкоженный id
      setCurrentId((cur) => (cur && t.channels.some((c) => c.id === cur) ? cur : (t.channels.find((c) => c.type === 'TEXT')?.id ?? t.channels[0]?.id ?? '')))
    }).catch(() => {})
    api.members().then(setMembers).catch(() => {})
    api.readStates().then(setReadStates).catch(() => {})
  }, [])

  useEffect(() => {
    if (!currentId) return
    let alive = true
    api.messages(currentId).then((ms) => {
      if (!alive) return // защита от гонки при быстром переключении каналов
      setMessages(ms)
      const last = ms[ms.length - 1]
      if (last) {
        api.markRead(currentId, last.id).catch(() => {})
        setReadStates((rs) => rs.map((r) => (r.channelId === currentId ? { ...r, lastReadMessageId: last.id, mentionCount: 0 } : r)))
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [currentId])

  // live-сообщения по WS для текущего канала (no-op в mock-режиме)
  useEffect(() => {
    if (!currentId) return
    return ws.onChannel(currentId, (e) => {
      if (!e.message) return
      const m = api.mapIncoming(e.message)
      if (m.channelId !== currentId) return
      setMessages((ms) => {
        const i = ms.findIndex((x) => x.id === m.id)
        if (e.type === 'MESSAGE_CREATED') return i >= 0 ? ms : [...ms, m]
        if (i >= 0) { const c = ms.slice(); c[i] = m; return c }
        return ms
      })
      if (e.type === 'MESSAGE_CREATED') {
        api.markRead(currentId, m.id).catch(() => {})
        setReadStates((rs) => rs.map((r) => (r.channelId === currentId ? { ...r, lastReadMessageId: m.id, mentionCount: 0 } : r)))
      }
    })
  }, [currentId])

  const channel = useMemo(() => tree.channels.find((c) => c.id === currentId), [tree, currentId])
  const readState = readStates.find((r) => r.channelId === currentId)
  const myRole = members.find((m) => m.userId === user.id)?.role
  const canModerate = myRole === 'OWNER' || myRole === 'ADMIN'
  const unreadTotal = readStates.reduce((a, r) => a + r.mentionCount, 0)
  const isWatch = channel?.type === 'WATCH'

  function send(text: string) {
    if (!currentId) return // не отправляем без выбранного канала (иначе /channels//messages → 401)
    api.sendMessage(currentId, text, replyTo?.id).then((m) => setMessages((ms) => [...ms, m]))
    setReplyTo(null)
  }
  function editMsg(id: string, content: string) {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, content, editedAt: new Date().toISOString() } : m)))
    api.editMessage(id, content).catch(() => {})
  }
  function deleteMsg(id: string) {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, deleted: true, content: null } : m)))
    api.deleteMessage(id).catch(() => {})
  }
  function react(messageId: string, emoji: string) {
    const mine = !!messages.find((m) => m.id === messageId)?.reactions.find((r) => r.emoji === emoji)?.mine
    setMessages((ms) => ms.map((m) => {
      if (m.id !== messageId) return m
      const rs = m.reactions.slice()
      const i = rs.findIndex((r) => r.emoji === emoji)
      if (mine) {
        if (i >= 0) { const c = rs[i].count - 1; if (c <= 0) rs.splice(i, 1); else rs[i] = { ...rs[i], count: c, mine: false } }
      } else if (i >= 0) {
        rs[i] = { ...rs[i], count: rs[i].count + 1, mine: true }
      } else {
        rs.push({ emoji, count: 1, mine: true })
      }
      return { ...m, reactions: rs }
    }))
    const ch = currentId
    ;(mine ? api.removeReaction(messageId, emoji) : api.addReaction(messageId, emoji))
      .catch(() => { api.messages(ch).then(setMessages) })
  }
  function ackAll() {
    api.ackAll().then(setReadStates).catch(() => {})
  }

  function pickChannel(id: string) {
    const ch = tree.channels.find((c) => c.id === id)
    setChannelsOpen(false)
    if (ch?.type === 'VOICE') {
      voice.join(id, ch.name) // в голосовой — заходим, не меняя открытый текст/watch-канал
    } else {
      setCurrentId(id)
      setView('chat')
    }
  }

  async function createChannel(p: { name: string; type: ChannelType }) {
    const ch = await api.createChannel(p)
    setTree(await api.serverTree())
    if (ch.type !== 'VOICE') { setCurrentId(ch.id); setView('chat') } // сразу открыть новый канал
  }

  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {view === 'admin' ? (
        <AdminScreen onClose={() => setView('chat')} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
          {/* header */}
          <div style={{ height: 62, flex: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '0 22px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-tint)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flex: 'none' }}>
              {channel ? TYPE_ICON[channel.type] : '#'}
            </div>
            <div style={{ lineHeight: 1.25, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{channel?.name ?? '—'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel?.topic ?? (isWatch ? 'совместный просмотр' : 'без темы')}</div>
            </div>
            {vs.screenOn && (
              <div style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent-tint)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 30, padding: '5px 13px', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} />Вы в эфире · демонстрация
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="ib no-drag" style={{ width: 38, height: 38, fontSize: 16 }} title="Поиск">🔍</button>
              <button className="ib no-drag" style={{ width: 38, height: 38, fontSize: 16 }} title="Закреплённые">📌</button>
              <button className="ib no-drag" style={{ width: 38, height: 38, fontSize: 16 }} title="Уведомления">🔔</button>
              <button className="ib no-drag" onClick={() => setMembersExpanded((v) => !v)} style={{ width: 38, height: 38, fontSize: 16, background: 'var(--accent-tint)', color: 'var(--accent)' }} title="Участники">👥</button>
            </div>
          </div>

          {/* body */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {vs.screenTrack && <ScreenSharePane track={vs.screenTrack} by={vs.screenBy} full={screenFull} onToggleFull={() => setScreenFull((f) => !f)} />}
            {!screenFull && (isWatch ? (
              <WatchView channelId={currentId} />
            ) : (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
                <ChatFeed messages={messages} readState={readState} onReact={react} meId={user.id} canModerate={canModerate} onReply={setReplyTo} onEdit={editMsg} onDelete={deleteMsg} />
                <Composer channelName={channel?.name ?? ''} onSend={send} replyToName={replyTo?.authorName} onCancelReply={() => setReplyTo(null)} />
              </div>
            ))}
            {!screenFull && <MembersRail members={members} expanded={membersExpanded} onToggle={() => setMembersExpanded((v) => !v)} voiceParticipants={vs.participants} voiceChannelName={vs.channelName} />}
          </div>
        </div>
      )}

      <BottomBar
        user={user}
        status={status}
        onStatus={setStatus}
        muted={!vs.micOn}
        onMute={() => voice.toggleMic()}
        deafened={vs.deafened}
        onDeaf={() => voice.toggleDeaf()}
        streamOn={vs.screenOn}
        onGoLive={() => voice.toggleScreen()}
        voiceChannelName={vs.channelName}
        onOpenChannels={() => setChannelsOpen(true)}
        unreadTotal={unreadTotal}
        onAckAll={ackAll}
        onOpenVoiceSettings={() => setVoiceSettingsOpen(true)}
        onOpenAdmin={() => setView('admin')}
        onLogout={logout}
        onLeaveVoice={() => voice.leave()}
      />

      {channelsOpen && (
        <ChannelSwitcher
          channels={tree.channels}
          readStates={readStates}
          currentId={currentId}
          onPick={pickChannel}
          onClose={() => setChannelsOpen(false)}
          onCreateChannel={createChannel}
        />
      )}

      {voiceSettingsOpen && <VoiceSettingsModal onClose={() => setVoiceSettingsOpen(false)} />}
    </div>
  )
}
