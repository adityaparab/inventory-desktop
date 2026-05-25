import AuthScreen from '../auth/AuthScreen'
import DashboardScreen from '../dashboard/DashboardScreen'
import type { AuthSession } from '../../types'

interface AuthGateProps {
  session: AuthSession | null
  onAuthenticated: (accessToken: string) => void
  onLogout: () => void
}

export default function AuthGate({ session, onAuthenticated, onLogout }: AuthGateProps) {
  if (session) {
    return <DashboardScreen session={session} onLogout={onLogout} />
  }

  return <AuthScreen onAuthenticated={onAuthenticated} />
}