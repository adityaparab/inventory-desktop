import BuildIcon from '@mui/icons-material/Build'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { BuildRecord } from '../../types'

interface BuildSummaryCardsProps {
  records: BuildRecord[]
}

export default function BuildSummaryCards({ records }: BuildSummaryCardsProps) {
  const totalCount = new Set(records.map((record) => record.uuid)).size
  const buildingCount = records.filter((record) => record.status === 'building').length
  const completedCount = records.filter((record) => record.status === 'completed').length
  const failedCount = records.filter((record) => record.status === 'failed').length

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(4, minmax(0, 1fr))',
        },
      }}
    >
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <BuildIcon color="primary" />
          <Box>
            <Typography color="text.secondary" variant="body2">Submitted UUIDs</Typography>
            <Typography variant="h5">{totalCount}</Typography>
          </Box>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ScheduleIcon color="warning" />
          <Box>
            <Typography color="text.secondary" variant="body2">Building</Typography>
            <Typography variant="h5">{buildingCount}</Typography>
          </Box>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CheckCircleIcon color="success" />
          <Box>
            <Typography color="text.secondary" variant="body2">Completed</Typography>
            <Typography variant="h5">{completedCount}</Typography>
          </Box>
        </Stack>
      </Paper>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ErrorOutlineIcon color="error" />
          <Box>
            <Typography color="text.secondary" variant="body2">Failed</Typography>
            <Typography variant="h5">{failedCount}</Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  )
}