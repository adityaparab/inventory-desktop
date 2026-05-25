import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

interface BuildsErrorStateProps {
  message: string
  onRetry: () => void
}

export default function BuildsErrorState({ message, onRetry }: BuildsErrorStateProps) {
  return (
    <Box sx={{ p: 2.5 }}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        }
      >
        {message}
      </Alert>
    </Box>
  )
}