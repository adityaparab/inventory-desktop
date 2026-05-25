import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { BuildRecord } from '../../types'
import { formatDateTime } from '../../utils/formatters'
import BuildActionsMenu from './BuildActionsMenu'
import BuildStatusChip from './BuildStatusChip'

interface BuildTableRowProps {
  record: BuildRecord
  isDownloading: boolean
  isDeleting: boolean
  onDownload: (record: BuildRecord) => void
  onDelete: (record: BuildRecord) => void
}

export default function BuildTableRow({ record, isDownloading, isDeleting, onDownload, onDelete }: BuildTableRowProps) {
  return (
    <TableRow hover>
      <TableCell sx={{ minWidth: 270 }}>
        {record.machineName && (
          <Typography variant="body2" fontWeight={500} noWrap sx={{ mb: 0.25 }}>
            {record.machineName}
          </Typography>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', wordBreak: 'break-all', display: 'block' }}
        >
          {record.uuid}
        </Typography>
      </TableCell>
      <TableCell>
        <BuildStatusChip status={record.status} />
      </TableCell>
      <TableCell>{formatDateTime(record.createdAt)}</TableCell>
      <TableCell>{formatDateTime(record.completedAt)}</TableCell>
      <TableCell sx={{ minWidth: 260 }}>
        <Typography color={record.outputFilename ? 'text.primary' : 'text.secondary'} variant="body2" noWrap>
          {record.outputFilename ?? 'Unavailable'}
        </Typography>
      </TableCell>
      <TableCell align="right">
        <BuildActionsMenu
          record={record}
          isDownloading={isDownloading}
          isDeleting={isDeleting}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      </TableCell>
    </TableRow>
  )
}