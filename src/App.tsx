import { TitleBar } from './components/TitleBar'
import { useAuth } from './store/auth'
import { AuthScreen } from './features/auth/AuthScreen'
import { MainWindow } from './features/main/MainWindow'

export default function App() {
  const { session } = useAuth()
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <TitleBar />
      <div style={{ flex: 1, minHeight: 0 }}>
        {session ? <MainWindow /> : <AuthScreen />}
      </div>
    </div>
  )
}
