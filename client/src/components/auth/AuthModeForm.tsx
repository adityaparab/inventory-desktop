import type { AuthMode } from '../../types'
import LoginForm from './LoginForm'
import RegisterForm from './RegisterForm'

interface AuthModeFormProps {
  mode: AuthMode
  onAuthenticated: (accessToken: string) => void
}

export default function AuthModeForm({ mode, onAuthenticated }: AuthModeFormProps) {
  if (mode === 'login') {
    return <LoginForm onAuthenticated={onAuthenticated} />
  }

  return <RegisterForm onAuthenticated={onAuthenticated} />
}