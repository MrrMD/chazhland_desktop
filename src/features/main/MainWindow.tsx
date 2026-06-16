import { useEffect, useMemo, useState } from 'react'
import { api, type ServerTree } from '@/lib/api'
import { useAuth } from '@/store/auth'
import type { ChannelType, Member, Message, Presence, ReadState } from '@/lib/types'
import { ChatFeed } from './ChatFeed'
import { Composer } from './Composer'
import { MembersRail } from './MembersRail'
import { ChannelSwitcher } from './ChannelSwitcher'
import { BottomBar } from './BottomBar'
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
  const [currentId, setCurrentId] = useState('ch_general')

  const [view, setView] = useState<'chat' | 'admin'>('chat')
  const [channelsOpen, setChannelsOpen] = useState(false)
  const [membersExpanded, setMembersExpanded] = useState(true)
  const [stream, setStream] = useState<'off' | 'split' | 'full'>('off')
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [status, setStatus] = useState<Presence>('online')
  const [voiceChannel, setVoiceChannel] = useState<string | null>('созвон')

  useEffect(() => {
    api.serverTree().then(setTree)
    api.members().then(setMembers)
    api.readStates().then(setReadStates)
  }, [])
  useEffect(() => {
    let alive = true
    api.messages(currentId).then((ms) => {
      if (!alive) return // защита от гонки при быстром переключении каналов
      setMessages(ms)
      const last = ms[ms.length - 1]
      if (last) {
        api.markRead(currentId, last.id).catch(() => {})
        setReadStates((rs) => rs.map((r) => (r.channelId === currentId ? { ...r, lastReadMessageId: last.id, mentionCount: 0 } : r)))
      }
    })
    return () => { alive = false }
  }, [currentId])

  // live-сообщения по WS для текущего канала (no-op в mock-режиме)
  useEffect(() => {
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
        // канал открыт — сразу отмечаем прочитанным, чтобы не копился unread
        api.markRead(currentId, m.id).catch(() => {})
        setReadStates((rs) => rs.map((r) => (r.channelId === currentId ? { ...r, lastReadMessageId: m.id, mentionCount: 0 } : r)))
      }
    })
  }, [currentId])

  const channel = useMemo(() => tree.channels.find((c) => c.id === currentId), [tree, currentId])
  const readState = readStates.find((r) => r.channelId === currentId)
  const unreadTotal = readStates.reduce((a, r) => a + r.mentionCount, 0)
  const streamOn = stream !== 'off'
  const streamFull = stream === 'full'

  function send(text: string) {
    api.sendMessage(currentId, text).then((m) => setMessages((ms) => [...ms, m]))
  }

  function react(messageId: string, emoji: string) {
    // намерение считаем из текущего состояния (не из устаревшего пропа) — устойчиво к быстрым кликам
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
      .catch(() => { api.messages(ch).then(setMessages) }) // откат: перечитываем авторитетное состояние канала
  }

  function ackAll() {
    api.ackAll().then(setReadStates).catch(() => {})
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
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel?.topic ?? 'без темы'}</div>
            </div>
            {streamOn && (
              <div style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent-tint)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 30, padding: '5px 13px', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} />Аня в эфире · демонстрация
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
            {streamOn && <StreamPane full={streamFull} onToggleFull={() => setStream((s) => (s === 'full' ? 'split' : 'full'))} />}
            {!streamFull && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
                <ChatFeed messages={messages} readState={readState} onReact={react} />
                <Composer channelName={channel?.name ?? ''} onSend={send} />
              </div>
            )}
            {!streamFull && <MembersRail members={members} expanded={membersExpanded} onToggle={() => setMembersExpanded((v) => !v)} />}
          </div>
        </div>
      )}

      <BottomBar
        user={user}
        status={status}
        onStatus={setStatus}
        muted={muted}
        onMute={() => setMuted((v) => !v)}
        deafened={deafened}
        onDeaf={() => setDeafened((v) => !v)}
        streamOn={streamOn}
        onGoLive={() => setStream((s) => (s === 'off' ? 'split' : 'off'))}
        voiceChannelName={voiceChannel}
        onOpenChannels={() => setChannelsOpen(true)}
        unreadTotal={unreadTotal}
        onAckAll={ackAll}
        onOpenAdmin={() => setView('admin')}
        onLogout={logout}
        onLeaveVoice={() => setVoiceChannel(null)}
      />

      {channelsOpen && (
        <ChannelSwitcher
          channels={tree.channels}
          readStates={readStates}
          currentId={currentId}
          onPick={(id) => { setCurrentId(id); setChannelsOpen(false); setView('chat') }}
          onClose={() => setChannelsOpen(false)}
        />
      )}
    </div>
  )
}

function StreamPane({ full, onToggleFull }: { full: boolean; onToggleFull: () => void }) {
  return (
    <div style={{ flex: full ? 1 : 1.2, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0e0d0c', position: 'relative', borderRight: '1px solid var(--border)' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(120% 120% at 50% 35%,#26241f,#0e0d0c)' }}>
        <div style={{ textAlign: 'center', color: '#8a847a' }}>
          <div style={{ width: 78, height: 78, borderRadius: 22, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 14px' }}>🖥</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#e9e3d8' }}>Демонстрация экрана</div>
          <div style={{ fontSize: 12.5, marginTop: 3 }}>Аня показывает · 1920 × 1080 · 60 fps</div>
        </div>
        <div style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,.5)', borderRadius: 30, padding: '6px 13px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} /><span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>в эфире</span>
        </div>
        <button onClick={onToggleFull} className="no-drag" style={{ position: 'absolute', right: 16, top: 16, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', borderRadius: 11, width: 40, height: 40, fontSize: 15, cursor: 'pointer' }} title={full ? 'свернуть' : 'на весь экран'}>⛶</button>
      </div>
    </div>
  )
}
