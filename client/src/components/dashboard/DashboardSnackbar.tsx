import type { SyntheticEvent } from 'react'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import type { DashboardNotice } from '../../types'

interface DashboardSnackbarProps {
  notice: DashboardNotice | null
  onClose: () => void
}

export default function DashboardSnackbar({ notice, onClose }: DashboardSnackbarProps) {
  if (!notice) {
    return null
  }

  const handleClose = (_event?: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }

    onClose()
  }

  return (
    <Snackbar open autoHideDuration={5000} onClose={handleClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Alert severity={notice.severity} variant="filled" onClose={onClose} sx={{ width: '100%' }}>
        {notice.message}
      </Alert>
    </Snackbar>
  )
}