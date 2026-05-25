import BuildIcon from '@mui/icons-material/Build'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'

export default function EmptyBuildsState() {
  return (
    <Stack spacing={1.5} alignItems="center" sx={{ px: 2, py: 6 }}>
      <BuildIcon color="disabled" fontSize="large" />
      <Typography variant="h6">No builds yet</Typography>
    </Stack>
  )
}