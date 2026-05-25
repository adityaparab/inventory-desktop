import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export default function BuildsLoadingState() {
  return (
    <Stack spacing={1.5} alignItems="center" sx={{ py: 6 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">Loading build records</Typography>
    </Stack>
  )
}