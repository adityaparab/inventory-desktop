import Typography from '@mui/material/Typography'
import type { BuildStreamEvent } from '../../types'

interface BuildLogLineProps {
  event: BuildStreamEvent
}

export default function BuildLogLine({ event }: BuildLogLineProps) {
  const color = getLogColor(event.type)

  return (
    <Typography component="div" sx={{ color, fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }} variant="body2">
      [{event.type}] {event.message}
    </Typography>
  )
}

function getLogColor(type: BuildStreamEvent['type']) {
  if (type === 'stderr' || type === 'error') {
    return '#fca5a5'
  }

  if (type === 'complete') {
    return '#86efac'
  }

  return '#d1d5db'
}