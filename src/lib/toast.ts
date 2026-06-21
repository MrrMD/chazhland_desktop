// Глобальные всплывающие уведомления (успех/ошибка/инфо). Синглтон — вызывается из любого
// места (в т.ч. из не-React модулей: api/voice), UI подписывается через components/Toaster.
import { sfx } from './sfx'

export type ToastKind = 'ok' | 'error' | 'info'
export interface Toast { id: number; kind: ToastKind; text: string }

class Toaster {
  private items: Toast[] = []
  private cbs = new Set<(t: Toast[]) => void>()
  private seq = 0

  subscribe(cb: (t: Toast[]) => void): () => void {
    this.cbs.add(cb); cb(this.items)
    return () => { this.cbs.delete(cb) }
  }
  private emit() { const snap = this.items.slice(); this.cbs.forEach((c) => c(snap)) }

  push(kind: ToastKind, text: string, ms = 4500) {
    const id = ++this.seq
    this.items = [...this.items, { id, kind, text }]
    this.emit()
    window.setTimeout(() => this.dismiss(id), ms)
  }
  ok(t: string) { this.push('ok', t) }
  error(t: string) { sfx.error(); this.push('error', t) }
  info(t: string) { this.push('info', t) }
  dismiss(id: number) { this.items = this.items.filter((t) => t.id !== id); this.emit() }
}

export const toast = new Toaster()
