import AuthGate from './components/app/AuthGate'
import { useAuthSession } from './hooks/useAuthSession'

function App() {
  const { session, signIn, signOut } = useAuthSession()

  return <AuthGate session={session} onAuthenticated={signIn} onLogout={signOut} />
}

export default App
