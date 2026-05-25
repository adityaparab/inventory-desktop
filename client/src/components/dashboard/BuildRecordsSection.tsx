import RefreshIcon from '@mui/icons-material/Refresh'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { BuildRecord } from '../../types'
import BuildRecordsContent from './BuildRecordsContent'

interface BuildRecordsSectionProps {
  records: BuildRecord[]
  isLoading: boolean
  error: string | null
  downloadingUuid: string | null
  deletingId: string | null
  onDownload: (record: BuildRecord) => void
  onDelete: (record: BuildRecord) => void
  onRefresh: () => void
}

export default function BuildRecordsSection({
  records,
  isLoading,
  error,
  downloadingUuid,
  deletingId,
  onDownload,
  onDelete,
  onRefresh,
}: BuildRecordsSectionProps) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Typography variant="h6">Submitted UUIDs</Typography>
        <Button startIcon={<RefreshIcon />} onClick={onRefresh} disabled={isLoading}>
          Refresh
        </Button>
      </Stack>
      <BuildRecordsContent
        records={records}
        isLoading={isLoading}
        error={error}
        downloadingUuid={downloadingUuid}
        deletingId={deletingId}
        onDownload={onDownload}
        onDelete={onDelete}
        onRetry={onRefresh}
      />
    </Paper>
  )
}