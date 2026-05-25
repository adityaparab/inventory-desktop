import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'

interface FormErrorAlertProps {
  message: string | null
}

export default function FormErrorAlert({ message }: FormErrorAlertProps) {
  return (
    <Collapse in={Boolean(message)}>
      <Alert severity="error" sx={{ mb: 2 }}>
        {message}
      </Alert>
    </Collapse>
  )
}