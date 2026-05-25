import CircularProgress from '@mui/material/CircularProgress'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DownloadIcon from '@mui/icons-material/Download'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import type { BuildRecord } from '../../types'

interface BuildActionsMenuProps {
  record: BuildRecord
  isDownloading: boolean
  isDeleting: boolean
  onDownload: (record: BuildRecord) => void
  onDelete: (record: BuildRecord) => void
}

export default function BuildActionsMenu({
  record,
  isDownloading,
  isDeleting,
  onDownload,
  onDelete,
}: BuildActionsMenuProps) {
  return (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <Tooltip title={isDownloading ? 'Preparing…' : 'Download artifact'}>
        <span>
          <IconButton
            size="small"
            disabled={!record.canDownload || isDownloading || isDeleting}
            onClick={() => onDownload(record)}
            aria-label="Download artifact"
          >
            {isDownloading ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={isDeleting ? 'Deleting…' : 'Delete record'}>
        <span>
          <IconButton
            size="small"
            color="error"
            disabled={isDeleting || isDownloading}
            onClick={() => onDelete(record)}
            aria-label="Delete build record"
          >
            {isDeleting ? (
              <CircularProgress size={16} color="error" />
            ) : (
              <DeleteOutlineIcon fontSize="small" />
            )}
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  )
}