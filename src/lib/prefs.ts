// Пользовательские настройки уведомлений (localStorage). Читаются на месте при WS-событии
// (gate в MainWindow), меняются из SettingsModal. Подписка — для живого UI настроек.
export interface NotifyPrefs {
  desktop: boolean    // нативные desktop-уведомления о сообщениях
  sounds: boolean     // звуковые пинги (упоминание/ЛС/реакция)
  respectDnd: boolean // в статусе «Не беспокоить» — тихо (без всплывашек и звука)
}

const LS = 'chazh.notify'
const DEFAULTS: NotifyPrefs = { desktop: true, sounds: true, respectDnd: true }

function read(): NotifyPrefs {
  try {
    const raw = localStorage.getItem(LS)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}

class NotifyPrefsStore {
  private v: NotifyPrefs = read()
  private cbs = new Set<() => void>()
  get(): NotifyPrefs { return this.v }
  set(patch: Partial<NotifyPrefs>) {
    this.v = { ...this.v, ...patch }
    try { localStorage.setItem(LS, JSON.stringify(this.v)) } catch { /* приватный режим — переживём */ }
    this.cbs.forEach((c) => c())
  }
  subscribe(cb: () => void): () => void { this.cbs.add(cb); return () => { this.cbs.delete(cb) } }
}

export const notifyPrefs = new NotifyPrefsStore()
