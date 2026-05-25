import { useState, type SyntheticEvent } from 'react'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import LoginIcon from '@mui/icons-material/Login'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import type { AuthMode } from '../../types'
import AuthModeForm from './AuthModeForm'

interface AuthScreenProps {
  onAuthenticated: (accessToken: string) => void
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login')

  const handleModeChange = (_event: SyntheticEvent, nextMode: AuthMode) => {
    setMode(nextMode)
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: { xs: 2, sm: 3 },
        py: 5,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack spacing={3}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 2,
                color: 'primary.contrastText',
                bgcolor: 'primary.main',
              }}
            >
              <Inventory2Icon />
            </Box>
            <Box>
              <Typography variant="h5">Inventory Build Console</Typography>
            </Box>
          </Stack>

          <Tabs value={mode} onChange={handleModeChange} variant="fullWidth" aria-label="Authentication mode">
            <Tab icon={<LoginIcon />} iconPosition="start" label="Login" value="login" />
            <Tab icon={<PersonAddIcon />} iconPosition="start" label="Register" value="register" />
          </Tabs>

          <AuthModeForm mode={mode} onAuthenticated={onAuthenticated} />
        </Stack>
      </Paper>
    </Box>
  )
}