import { useEffect, useMemo, useRef, useState } from 'react'
import { api, type ServerTree } from '@/lib/api'
import { useAuth } from '@/store/auth'
import { voice, type VoiceState } from '@/lib/voice'
import { presence } from '@/lib/presence'
import type { AttachmentInput, Channel, ChannelType, Dm, Member, Message, Presence, ReadState } from '@/lib/types'
import { ChatFeed } from './ChatFeed'
import { Composer } from './Composer'
import { MembersRail } from './MembersRail'
import { ChannelSwitcher } from './ChannelSwitcher'
import { BottomBar } from './BottomBar'
import { WatchView } from './WatchView'
import { ScreenSharePane } from './ScreenSharePane'
import { VoiceSettingsModal } from './VoiceSettingsModal'
import { SettingsModal } from './SettingsModal'
import { ChatPanel } from './ChatPanel'
import { AdminScreen } from '@/features/admin/AdminScreen'
import { ws } from '@/lib/ws'
import { toast } from '@/lib/toast'
import { Search, Pin, Bell, Users, Hash, Volume2, Play, AtSign } from 'lucide-react'

const TYPE_ICON: Record<ChannelType, React.ReactNode> = { TEXT: <Hash size={18} />, VOICE: <Volume2 size={18} />, WATCH: <Play size={18} />, DM: <AtSign size={18} /> }

export function MainWindow() {
  const { session, logout } = useAuth()
  const user = session!.user

  const [tree, setTree] = useState<ServerTree>({ categories: [], channels: [] })
  const [dms, setDms] = useState<Dm[]>([])
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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [typing, setTyping] = useState<{ id: string; name: string }[]>([])
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [panel, setPanel] = useState<null | 'search' | 'pins'>(null)
  const [pinsVersion, setPinsVersion] = useState(0)

  useEffect(() => voice.subscribe(setVs), [])
  useEffect(() => { presence.start(); return () => presence.stop() }, [])
  useEffect(() => { if (!vs.screenTrack && screenFull) setScreenFull(false) }, [vs.screenTrack, screenFull])

  // актуальный канал для асинхронных колбэков (откат реакции и т.п.), чтобы не затирать чужую ленту
  const currentIdRef = useRef(currentId)
  useEffect(() => { currentIdRef.current = currentId }, [currentId])

  useEffect(() => {
    api.serverTree().then((t) => {
      setTree(t)
      // первый открытый канал — первый текстовый (или любой), а не захардкоженный id
      setCurrentId((cur) => (cur && t.channels.some((c) => c.id === cur) ? cur : (t.channels.find((c) => c.type === 'TEXT')?.id ?? t.channels[0]?.id ?? '')))
    }).catch(() => {})
    api.members().then(setMembers).catch(() => {})
    api.readStates().then(setReadStates).catch(() => {})
    api.listDms().then(setDms).catch(() => {})
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
    const off = ws.onChannel(currentId, (e) => {
      // эфемерный TYPING — показываем «печатает…», авто-сброс через 6 с
      if (e.type === 'TYPING') {
        const uid = e.userId, name = e.username
        if (!uid || uid === user.id) return
        setTyping((t) => (t.some((x) => x.id === uid) ? t : [...t, { id: uid, name: name || 'кто-то' }]))
        const timers = typingTimers.current
        const prev = timers.get(uid); if (prev) clearTimeout(prev)
        timers.set(uid, setTimeout(() => { timers.delete(uid); setTyping((t) => t.filter((x) => x.id !== uid)) }, 6000))
        return
      }
      // Реакции прилетают без message — обновляем агрегат по messageId+emoji (см. DESIGN_BRIEF).
      if (e.type === 'REACTION_ADDED' || e.type === 'REACTION_REMOVED') {
        const mid = e.messageId, emoji = e.emoji
        if (!mid || !emoji || e.userId === user.id) return // своё уже учтено оптимистично (см. react())
        const add = e.type === 'REACTION_ADDED'
        setMessages((ms) => ms.map((m) => {
          if (m.id !== mid) return m
          const rs = m.reactions.slice()
          const i = rs.findIndex((r) => r.emoji === emoji)
          if (add) {
            if (i >= 0) rs[i] = { ...rs[i], count: rs[i].count + 1 }
            else rs.push({ emoji, count: 1, mine: false })
          } else if (i >= 0) {
            const c = rs[i].count - 1
            if (c <= 0) rs.splice(i, 1); else rs[i] = { ...rs[i], count: c }
          }
          return { ...m, reactions: rs }
        }))
        return
      }
      // закрепление/открепление — обновляем pinnedAt и просим панель пинов перезагрузиться
      if (e.type === 'MESSAGE_PINNED' || e.type === 'MESSAGE_UNPINNED') {
        const mid = e.messageId ?? (e.message ? api.mapIncoming(e.message).id : undefined)
        const pinned = e.type === 'MESSAGE_PINNED'
        if (mid) setMessages((ms) => ms.map((m) => (m.id === mid ? { ...m, pinnedAt: pinned ? new Date().toISOString() : null } : m)))
        setPinsVersion((v) => v + 1)
        return
      }
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
        // автор прислал сообщение — он больше не «печатает»
        const tm = typingTimers.current.get(m.authorId); if (tm) { clearTimeout(tm); typingTimers.current.delete(m.authorId) }
        setTyping((t) => t.filter((x) => x.id !== m.authorId))
      }
    })
    return () => {
      off()
      typingTimers.current.forEach((t) => clearTimeout(t))
      typingTimers.current.clear()
      setTyping([]) // сбрасываем индикатор при смене канала
    }
  }, [currentId])

  const channel = useMemo<Channel | undefined>(() => {
    const c = tree.channels.find((x) => x.id === currentId)
    if (c) return c
    const dm = dms.find((d) => d.id === currentId) // DM-каналы скрыты из дерева — собираем синтетический Channel
    return dm ? { id: dm.id, name: dm.name, type: 'DM', categoryId: null, topic: null, position: 0 } : undefined
  }, [tree, dms, currentId])
  const readState = readStates.find((r) => r.channelId === currentId)
  const myRole = members.find((m) => m.userId === user.id)?.role
  const canModerate = myRole === 'OWNER' || myRole === 'ADMIN'
  const unreadTotal = readStates.reduce((a, r) => a + r.mentionCount, 0)
  const isWatch = channel?.type === 'WATCH'

  function send(text: string, attachments?: AttachmentInput[]) {
    if (!currentId) return // не отправляем без выбранного канала (иначе /channels//messages → 401)
    if (!text && !(attachments && attachments.length)) return
    api.sendMessage(currentId, text, replyTo?.id, attachments).then((m) => setMessages((ms) => [...ms, m]))
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
      .catch(() => {
        // откат оптимистичного апдейта: перезагружаем ленту, но только если канал ещё открыт
        api.messages(ch).then((ms) => { if (currentIdRef.current === ch) setMessages(ms) }).catch(() => {})
      })
  }
  function ackAll() {
    api.ackAll().then(setReadStates).catch(() => {})
  }
  function pinMsg(id: string, pinned: boolean) {
    const ch = currentId
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, pinnedAt: pinned ? new Date().toISOString() : null } : m)))
    ;(pinned ? api.pin(id) : api.unpin(id))
      .then(() => setPinsVersion((v) => v + 1))
      .catch(() => {
        toast.error(pinned ? 'Не удалось закрепить' : 'Не удалось открепить')
        api.messages(ch).then((ms) => { if (currentIdRef.current === ch) setMessages(ms) }).catch(() => {})
      })
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

  async function openDm(userId: string) {
    if (!userId || userId === user.id) return
    try {
      const dm = await api.openDm(userId)
      setDms((d) => (d.some((x) => x.id === dm.id) ? d : [...d, dm]))
      setCurrentId(dm.id)
      setView('chat')
      setChannelsOpen(false)
      setPanel(null)
    } catch { toast.error('Не удалось открыть личные сообщения') }
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
              {channel ? TYPE_ICON[channel.type] : <Hash size={18} />}
            </div>
            <div style={{ lineHeight: 1.25, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{channel?.name ?? '—'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel?.topic ?? (isWatch ? 'совместный просмотр' : channel?.type === 'DM' ? 'личные сообщения' : 'без темы')}</div>
            </div>
            {vs.screenOn && (
              <div style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent-tint)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 30, padding: '5px 13px', fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0392f', animation: 'live 1.6s infinite' }} />Вы в эфире · демонстрация
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="ib no-drag" onClick={() => setPanel((p) => (p === 'search' ? null : 'search'))} style={{ width: 38, height: 38, ...(panel === 'search' ? { background: 'var(--accent-tint)', color: 'var(--accent)' } : {}) }} title="Поиск"><Search size={16} /></button>
              <button className="ib no-drag" onClick={() => setPanel((p) => (p === 'pins' ? null : 'pins'))} style={{ width: 38, height: 38, ...(panel === 'pins' ? { background: 'var(--accent-tint)', color: 'var(--accent)' } : {}) }} title="Закреплённые"><Pin size={16} /></button>
              <button className="ib no-drag" style={{ width: 38, height: 38 }} title="Уведомления"><Bell size={16} /></button>
              <button className="ib no-drag" onClick={() => setMembersExpanded((v) => !v)} style={{ width: 38, height: 38, background: 'var(--accent-tint)', color: 'var(--accent)' }} title="Участники"><Users size={16} /></button>
            </div>
          </div>

          {/* body */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
            {vs.screenTrack && <ScreenSharePane track={vs.screenTrack} by={vs.screenBy} full={screenFull} onToggleFull={() => setScreenFull((f) => !f)} />}
            {!screenFull && (isWatch ? (
              <WatchView channelId={currentId} />
            ) : (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--win)' }}>
                <ChatFeed messages={messages} readState={readState} onReact={react} meId={user.id} meName={user.username} canModerate={canModerate} onReply={setReplyTo} onEdit={editMsg} onDelete={deleteMsg} onPin={pinMsg} />
                <TypingIndicator names={typing.map((t) => t.name)} />
                <Composer channelName={channel?.name ?? ''} onSend={send} onType={() => ws.typing(currentId)} replyToName={replyTo?.authorName} onCancelReply={() => setReplyTo(null)} />
              </div>
            ))}
            {!screenFull && <MembersRail members={members} expanded={membersExpanded} onToggle={() => setMembersExpanded((v) => !v)} voiceParticipants={vs.participants} voiceChannelName={vs.channelName} meId={user.id} onOpenDm={openDm} />}
            {panel && currentId && (
              <ChatPanel mode={panel} channelId={currentId} channelName={channel?.name ?? ''} pinsVersion={pinsVersion} onClose={() => setPanel(null)} onUnpin={(id) => pinMsg(id, false)} />
            )}
          </div>
        </div>
      )}

      <BottomBar
        user={user}
        status={status}
        onStatus={(st) => { setStatus(st); presence.setStatus(st) }}
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
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAdmin={() => setView('admin')}
        onLogout={logout}
        onLeaveVoice={() => voice.leave()}
      />

      {channelsOpen && (
        <ChannelSwitcher
          channels={tree.channels}
          dms={dms}
          readStates={readStates}
          currentId={currentId}
          onPick={pickChannel}
          onClose={() => setChannelsOpen(false)}
          onCreateChannel={createChannel}
        />
      )}

      {voiceSettingsOpen && <VoiceSettingsModal onClose={() => setVoiceSettingsOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null
  const text = names.length === 1 ? `${names[0]} печатает…`
    : names.length === 2 ? `${names[0]} и ${names[1]} печатают…`
    : 'Несколько человек печатают…'
  return (
    <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 28px 4px', height: 18, fontSize: 12, color: 'var(--text-3)' }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-3)', animation: 'live 1.2s infinite', animationDelay: `${i * 0.18}s` }} />
        ))}
      </span>
      {text}
    </div>
  )
}
