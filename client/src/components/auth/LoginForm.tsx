import { useState, type ChangeEvent, type FormEvent } from 'react'
import LoginIcon from '@mui/icons-material/Login'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { login } from '../../api/authApi'
import { getErrorMessage } from '../../api/http'
import FormErrorAlert from '../common/FormErrorAlert'

interface LoginFormProps {
  onAuthenticated: (accessToken: string) => void
}

export default function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [form, setForm] = useState({ usernameOrEmail: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await login(form)
      onAuthenticated(response.accessToken)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
      <FormErrorAlert message={error} />
      <TextField
        required
        fullWidth
        autoComplete="username"
        id="login-username-or-email"
        label="Username or email"
        name="usernameOrEmail"
        value={form.usernameOrEmail}
        onChange={handleFieldChange}
      />
      <TextField
        required
        fullWidth
        autoComplete="current-password"
        id="login-password"
        label="Password"
        name="password"
        type="password"
        value={form.password}
        onChange={handleFieldChange}
      />
      <Button
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        startIcon={<LoginIcon />}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </Stack>
  )
}