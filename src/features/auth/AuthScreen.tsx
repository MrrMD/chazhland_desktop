import { useState } from 'react'
import { useAuth } from '@/store/auth'

export function AuthScreen() {
  const { login, register } = useAuth()
  const [screen, setScreen] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)

  // login
  const [loginField, setLoginField] = useState('')
  const [pw, setPw] = useState('')
  // register
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try { await login(loginField, pw) }
    catch { setError('Неверные данные. Проверьте логин и пароль.') }
    finally { setLoading(false) }
  }
  async function submitReg(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try { await register({ inviteCode: code, username, email, password: pw }) }
    catch { setError('Инвайт недействителен, отозван или исчерпан') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', background: 'var(--win)' }}>
      <div style={{ position: 'absolute', top: -60, left: '8%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,var(--accent-tint),transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -50, right: '10%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,92,255,.12),transparent 70%)', pointerEvents: 'none' }} />

      {screen === 'login' ? (
        <form onSubmit={submitLogin} style={{ width: 420, maxWidth: '100%', position: 'relative', animation: 'mdIn .4s cubic-bezier(.22,.61,.36,1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 62, height: 62, borderRadius: 19, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, margin: '0 auto 12px', boxShadow: '0 10px 26px var(--accent-tint)' }}>ch</div>
            <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: '-.02em' }}>С возвращением</div>
            <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 3 }}>Войдите, чтобы продолжить</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 26, boxShadow: '0 14px 40px -22px var(--shadow)' }}>
            <label style={lbl}>Имя пользователя или e-mail</label>
            <div className="field" style={{ padding: '12px 14px', margin: '7px 0 15px' }}>
              <span style={{ color: 'var(--text-3)' }}>@</span>
              <input value={loginField} onChange={(e) => setLoginField(e.target.value)} placeholder="you@chazhland · или ник" autoFocus />
            </div>
            <label style={lbl}>Пароль</label>
            <div className="field" style={{ padding: '12px 14px', margin: '7px 0 10px' }}>
              <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
              <span onClick={() => setShowPw((v) => !v)} style={{ cursor: 'pointer' }}>{showPw ? '🙈' : '👁'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--text-2)' }}>
                <span style={{ width: 19, height: 19, borderRadius: 6, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</span>Запомнить меня
              </label>
              <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}>Забыли пароль?</span>
            </div>
            {error && <ErrorBox text={error} hint="429 — слишком много попыток, подождите." />}
            <button type="submit" disabled={loading} className="accent-btn" style={btn}>
              {loading && <Spinner />}{loading ? 'Вход…' : 'Войти'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: 'var(--text-2)' }}>
              Есть инвайт-код? <span onClick={() => { setScreen('register'); setError(null) }} style={linkS}>Зарегистрироваться</span>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={submitReg} style={{ width: 440, maxWidth: '100%', position: 'relative', animation: 'mdIn .4s cubic-bezier(.22,.61,.36,1)' }}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 17, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 25, margin: '0 auto 10px', boxShadow: '0 10px 26px var(--accent-tint)' }}>ch</div>
            <div style={{ fontWeight: 800, fontSize: 24, letterSpacing: '-.02em' }}>Создать аккаунт</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 30, padding: '4px 13px', marginTop: 9 }}>🔒 Регистрация только по приглашению</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 24, boxShadow: '0 14px 40px -22px var(--shadow)' }}>
            <label style={lbl}>Инвайт-код</label>
            <div className="field" style={{ padding: '12px 14px', margin: '7px 0 11px', fontFamily: 'ui-monospace,Menlo,monospace' }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CHZ-XXXX-XXXX" style={{ letterSpacing: '.08em' }} />
            </div>
            <label style={lbl}>Имя пользователя</label>
            <div className="field" style={{ padding: '12px 14px', margin: '7px 0 4px' }}>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ваш ник" />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '0 0 11px 2px' }}>3–32 символа</div>
            <label style={lbl}>E-mail</label>
            <div className="field" style={{ padding: '12px 14px', margin: '7px 0 11px' }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@chazhland" />
            </div>
            <label style={lbl}>Пароль</label>
            <div className="field" style={{ padding: '12px 14px', margin: '7px 0 9px' }}>
              <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••••" />
              <span onClick={() => setShowPw((v) => !v)} style={{ cursor: 'pointer' }}>{showPw ? '🙈' : '👁'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
              <div style={{ flex: 1, display: 'flex', gap: 5 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: pw.length > i * 3 ? (i < 2 ? 'var(--green)' : i < 3 ? 'var(--idle)' : 'var(--surface-3)') : 'var(--surface-3)' }} />
                ))}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>8–100</span>
            </div>
            {error && <ErrorBox text={error} />}
            <button type="submit" disabled={loading} className="accent-btn" style={btn}>
              {loading && <Spinner />}{loading ? 'Создаём…' : 'Создать аккаунт'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 15, fontSize: 13.5, color: 'var(--text-2)' }}>
              Уже есть аккаунт? <span onClick={() => { setScreen('login'); setError(null) }} style={linkS}>Войти</span>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }
const btn: React.CSSProperties = { width: '100%', borderRadius: 13, padding: 14, fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 8px 20px var(--accent-tint)' }
const linkS: React.CSSProperties = { color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }

function ErrorBox({ text, hint }: { text: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--danger-tint)', border: '1px solid rgba(224,57,47,.35)', borderRadius: 12, padding: '11px 13px', marginBottom: 15 }}>
      <span style={{ color: 'var(--danger)', fontSize: 15 }}>⚠</span>
      <div style={{ fontSize: 13, color: 'var(--danger)', lineHeight: 1.45 }}>
        <b>{text}</b>
        {hint && <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 2 }}>{hint}</div>}
      </div>
    </div>
  )
}

function Spinner() {
  return <span style={{ width: 16, height: 16, border: '2.5px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
}
