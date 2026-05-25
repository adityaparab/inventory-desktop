import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { BuildStreamEvent } from '../../types'
import BuildLogLine from './BuildLogLine'

interface BuildLogPanelProps {
  activeUuid: string | null
  events: BuildStreamEvent[]
}

export default function BuildLogPanel({ activeUuid, events }: BuildLogPanelProps) {
  if (!activeUuid && events.length === 0) {
    return null
  }

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Typography variant="h6">Build stream</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ wordBreak: 'break-all' }}>
            {activeUuid ?? 'Last build'}
          </Typography>
        </Stack>
        <Stack
          spacing={0.75}
          sx={{
            minHeight: 140,
            maxHeight: 320,
            overflow: 'auto',
            p: 1.5,
            borderRadius: 1,
            bgcolor: '#111827',
          }}
        >
          {[...events].reverse().map((event, index) => (
            <BuildLogLine event={event} key={`${index}-${event.type}-${event.message}`} />
          ))}
        </Stack>
      </Stack>
    </Paper>
  )
}