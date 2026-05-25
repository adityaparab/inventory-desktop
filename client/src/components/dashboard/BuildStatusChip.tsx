import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import Chip from '@mui/material/Chip'
import type { BuildStatus } from '../../types'

interface BuildStatusChipProps {
  status: BuildStatus
}

export default function BuildStatusChip({ status }: BuildStatusChipProps) {
  if (status === 'completed') {
    return <Chip color="success" icon={<CheckCircleIcon />} label="Completed" size="small" variant="outlined" />
  }

  if (status === 'failed') {
    return <Chip color="error" icon={<ErrorOutlineIcon />} label="Failed" size="small" variant="outlined" />
  }

  return <Chip color="warning" icon={<ScheduleIcon />} label="Building" size="small" variant="outlined" />
}