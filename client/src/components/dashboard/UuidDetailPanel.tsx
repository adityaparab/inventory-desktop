import BuildIcon from '@mui/icons-material/Build'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { BuildRecord, BuildStreamEvent } from '../../types'
import BuildLogPanel from './BuildLogPanel'
import BuildRecordsContent from './BuildRecordsContent'

interface UuidDetailPanelProps {
  uuid: string
  records: BuildRecord[]
  streamEvents: BuildStreamEvent[]
  streamUuid: string | null
  activeUuid: string | null
  downloadingUuid: string | null
  deletingId: string | null
  isLoadingRecords: boolean
  onGenerate: (uuid: string) => void
  onDownload: (record: BuildRecord) => void
  onDelete: (record: BuildRecord) => void
}

export default function UuidDetailPanel({
  uuid,
  records,
  streamEvents,
  streamUuid,
  activeUuid,
  downloadingUuid,
  deletingId,
  isLoadingRecords,
  onGenerate,
  onDownload,
  onDelete,
}: UuidDetailPanelProps) {
  const isBuildActive = Boolean(activeUuid)

  return (
    <Stack spacing={2.5}>
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Machine UUID
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                wordBreak: 'break-all',
              }}
            >
              {uuid}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<BuildIcon />}
            onClick={() => onGenerate(uuid)}
            disabled={isBuildActive}
            sx={{ flexShrink: 0 }}
          >
            {isBuildActive ? 'Building…' : 'Trigger Build'}
          </Button>
        </Stack>
      </Paper>

      {streamUuid === uuid && (
        <BuildLogPanel activeUuid={activeUuid} events={streamEvents} />
      )}

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Stack sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6">Build History</Typography>
        </Stack>
        <BuildRecordsContent
          records={records}
          isLoading={isLoadingRecords}
          error={null}
          downloadingUuid={downloadingUuid}
          deletingId={deletingId}
          onDownload={onDownload}
          onDelete={onDelete}
          onRetry={() => {}}
        />
      </Paper>
    </Stack>
  )
}
