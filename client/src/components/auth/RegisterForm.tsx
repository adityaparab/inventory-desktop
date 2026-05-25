import { useState, type ChangeEvent, type FormEvent } from 'react'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import { register } from '../../api/authApi'
import { getErrorMessage } from '../../api/http'
import FormErrorAlert from '../common/FormErrorAlert'

interface RegisterFormProps {
  onAuthenticated: (accessToken: string) => void
}

export default function RegisterForm({ onAuthenticated }: RegisterFormProps) {
  const [form, setForm] = useState({ fullName: '', username: '', email: '', password: '' })
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
      const response = await register(form)
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
        autoComplete="name"
        id="register-full-name"
        label="Full name"
        name="fullName"
        value={form.fullName}
        onChange={handleFieldChange}
      />
      <TextField
        required
        fullWidth
        autoComplete="username"
        id="register-username"
        label="Username"
        name="username"
        value={form.username}
        onChange={handleFieldChange}
        slotProps={{ htmlInput: { pattern: '[a-zA-Z0-9_]+' } }}
      />
      <TextField
        required
        fullWidth
        autoComplete="email"
        id="register-email"
        label="Email"
        name="email"
        type="email"
        value={form.email}
        onChange={handleFieldChange}
      />
      <TextField
        required
        fullWidth
        autoComplete="new-password"
        id="register-password"
        label="Password"
        name="password"
        type="password"
        value={form.password}
        onChange={handleFieldChange}
        slotProps={{ htmlInput: { minLength: 8 } }}
      />
      <Button
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        startIcon={<PersonAddIcon />}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </Button>
    </Stack>
  )
}