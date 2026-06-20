import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Monitor, AppWindow } from 'lucide-react'

// Пикер источника демонстрации: список экранов и окон с живыми превью (desktopCapturer через main).
// Клик по плитке выбирает источник (одноразово в main) и запускает демонстрацию через onPick.
export function ScreenPicker({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [sources, setSources] = useState<ScreenSource[] | null>(null)
  const [tab, setTab] = useState<'screen' | 'window'>('screen')

  useEffect(() => {
    let alive = true
    window.chazh?.getScreenSources().then((s) => { if (alive) setSources(s) }).catch(() => { if (alive) setSources([]) })
    return () => { alive = false }
  }, [])

  const screens = sources?.filter((s) => s.type === 'screen') ?? []
  const windows = sources?.filter((s) => s.type === 'window') ?? []
  const shown = tab === 'screen' ? screens : windows

  return (
    <Modal title="Что транслировать" onClose={onClose} width={720}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Tab active={tab === 'screen'} onClick={() => setTab('screen')} icon={<Monitor size={15} />} label={`Экраны${screens.length ? ` · ${screens.length}` : ''}`} />
        <Tab active={tab === 'window'} onClick={() => setTab('window')} icon={<AppWindow size={15} />} label={`Окна${windows.length ? ` · ${windows.length}` : ''}`} />
      </div>

      {sources === null ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>Загрузка источников…</div>
      ) : shown.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>Нет доступных {tab === 'screen' ? 'экранов' : 'окон'}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxHeight: 420, overflow: 'auto', padding: 2 }}>
          {shown.map((s) => <SourceTile key={s.id} s={s} onClick={() => onPick(s.id)} />)}
        </div>
      )}
    </Modal>
  )
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-tint)' : 'var(--surface)', color: active ? 'var(--accent)' : 'var(--text-2)', borderRadius: 11, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{icon}{label}</button>
  )
}

function SourceTile({ s, onClick }: { s: ScreenSource; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className="no-drag"
      style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, border: `2px solid ${hover ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--surface)', borderRadius: 14, cursor: 'pointer', textAlign: 'left', transition: 'border-color .12s' }}>
      <div style={{ aspectRatio: '16 / 10', borderRadius: 9, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {s.thumbnail ? <img src={s.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Monitor size={28} color="var(--text-3)" />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        {s.appIcon && <img src={s.appIcon} alt="" style={{ width: 16, height: 16, flex: 'none' }} />}
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
      </div>
    </button>
  )
}
