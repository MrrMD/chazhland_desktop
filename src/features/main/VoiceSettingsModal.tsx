import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { voice, type AudioDevice } from '@/lib/voice'

function keyLabel(code: string) {
  if (code === 'Space') return 'Пробел'
  return code.replace('Key', '').replace('Digit', '').replace('Control', 'Ctrl')
}

export function VoiceSettingsModal({ onClose }: { onClose: () => void }) {
  const [inputs, setInputs] = useState<AudioDevice[]>([])
  const [outputs, setOutputs] = useState<AudioDevice[]>([])
  const [s, setS] = useState({ ...voice.settings })
  const [capturing, setCapturing] = useState(false)
  const [grantBusy, setGrantBusy] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => { const d = await voice.listDevices(); if (alive) { setInputs(d.inputs); setOutputs(d.outputs) } }
    // запрашиваем доступ к микрофону сразу при открытии — иначе метки устройств пустые (не дожидаясь звонка)
    ;(async () => { await voice.requestMicPermission(); await load() })()
    const md = navigator.mediaDevices
    md?.addEventListener('devicechange', load)
    return () => { alive = false; md?.removeEventListener('devicechange', load) }
  }, [])

  async function grant() {
    setGrantBusy(true)
    await voice.requestMicPermission()
    const d = await voice.listDevices()
    setInputs(d.inputs); setOutputs(d.outputs)
    setGrantBusy(false)
  }

  useEffect(() => {
    if (!capturing) return
    const h = (e: KeyboardEvent) => { e.preventDefault(); voice.setPttKey(e.code); setS((p) => ({ ...p, pttKey: e.code })); setCapturing(false) }
    window.addEventListener('keydown', h, { once: true })
    return () => window.removeEventListener('keydown', h)
  }, [capturing])

  return (
    <Modal title="Настройки голоса" onClose={onClose} width={460}>
      <Section label="Микрофон (ввод)">
        <Select value={s.inputId} onChange={(v) => { voice.setInputDevice(v); setS((p) => ({ ...p, inputId: v })) }} options={[{ id: '', label: 'По умолчанию' }, ...inputs]} />
      </Section>
      <Section label="Устройство вывода">
        <Select value={s.outputId} onChange={(v) => { voice.setOutputDevice(v); setS((p) => ({ ...p, outputId: v })) }} options={[{ id: '', label: 'По умолчанию' }, ...outputs]} />
        {inputs.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <Hint>Нет доступа к микрофону — разрешите, чтобы увидеть список устройств.</Hint>
            <button className="pill no-drag" onClick={grant} disabled={grantBusy} style={{ marginTop: 8, padding: '7px 13px', fontWeight: 600, fontSize: 13 }}>{grantBusy ? 'Запрос…' : 'Запросить доступ'}</button>
          </div>
        )}
      </Section>
      <Section label="Обработка звука">
        <Toggle label="Шумоподавление" on={s.noiseSuppression} onClick={() => { const v = !s.noiseSuppression; voice.setProcessing({ noiseSuppression: v }); setS((p) => ({ ...p, noiseSuppression: v })) }} />
        <Toggle label="Эхоподавление" on={s.echoCancellation} onClick={() => { const v = !s.echoCancellation; voice.setProcessing({ echoCancellation: v }); setS((p) => ({ ...p, echoCancellation: v })) }} />
        <Toggle label="Авто-громкость (AGC)" on={s.autoGain} onClick={() => { const v = !s.autoGain; voice.setProcessing({ autoGain: v }); setS((p) => ({ ...p, autoGain: v })) }} />
      </Section>
      <Section label="Режим передачи">
        <div style={{ display: 'flex', gap: 8 }}>
          <ModeBtn active={s.mode === 'voice'} onClick={() => { voice.setMode('voice'); setS((p) => ({ ...p, mode: 'voice' })) }} title="Голосовая активация" desc="микрофон всегда открыт" />
          <ModeBtn active={s.mode === 'ptt'} onClick={() => { voice.setMode('ptt'); setS((p) => ({ ...p, mode: 'ptt' })) }} title="Рация (PTT)" desc="говорить по клавише" />
        </div>
        {s.mode === 'ptt' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Клавиша передачи:</span>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 600, padding: '4px 11px', borderRadius: 8, background: 'var(--surface-2)' }}>{keyLabel(s.pttKey)}</span>
            <button className="pill no-drag" onClick={() => setCapturing(true)} style={{ padding: '6px 12px', fontWeight: 600 }}>{capturing ? 'Нажмите клавишу…' : 'Изменить'}</button>
          </div>
        )}
      </Section>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <button className="accent-btn no-drag" onClick={onClose} style={{ borderRadius: 12, padding: '10px 18px', fontWeight: 700 }}>Готово</button>
      </div>
    </Modal>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  )
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: AudioDevice[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="no-drag" style={{ width: '100%', padding: '10px 12px', borderRadius: 11, border: '1px solid var(--border-2)', background: 'var(--win)', color: 'var(--text)', font: 'inherit', fontSize: 13.5, cursor: 'pointer' }}>
      {options.map((o) => <option key={o.id || 'default'} value={o.id}>{o.label}</option>)}
    </select>
  )
}
function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer' }}>
      <span style={{ width: 38, height: 22, borderRadius: 11, background: on ? 'var(--accent)' : 'var(--border-2)', position: 'relative', transition: 'background .15s', flex: 'none' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
      <span style={{ fontSize: 13.5, color: 'var(--text)' }}>{label}</span>
    </div>
  )
}
function ModeBtn({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} className="no-drag" style={{ flex: 1, textAlign: 'left', border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent-tint)' : 'var(--surface)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text)' }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
    </button>
  )
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>{children}</div>
}
