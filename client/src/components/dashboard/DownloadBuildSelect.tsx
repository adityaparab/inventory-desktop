import { useMemo, useState } from 'react'
import DownloadIcon from '@mui/icons-material/Download'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { BuildRecord } from '../../types'
import DownloadBuildOptions from './DownloadBuildOptions'

interface DownloadBuildSelectProps {
  records: BuildRecord[]
  downloadingUuid: string | null
  onDownload: (record: BuildRecord) => void
}

export default function DownloadBuildSelect({
  records,
  downloadingUuid,
  onDownload,
}: DownloadBuildSelectProps) {
  const completedRecords = useMemo(
    () => records.filter((record) => record.canDownload),
    [records],
  )
  const [preferredUuid, setPreferredUuid] = useState('')
  const selectedUuid = completedRecords.some((record) => record.uuid === preferredUuid)
    ? preferredUuid
    : completedRecords[0]?.uuid ?? ''
  const selectedRecord = completedRecords.find((record) => record.uuid === selectedUuid) ?? null

  const handleDownload = () => {
    if (selectedRecord) {
      onDownload(selectedRecord)
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Typography variant="h6">Download artifact</Typography>
        <TextField
          select
          fullWidth
          disabled={completedRecords.length === 0}
          label="Completed build"
          value={selectedUuid}
          onChange={(event) => setPreferredUuid(event.target.value)}
        >
          <DownloadBuildOptions records={completedRecords} />
        </TextField>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          disabled={!selectedRecord || downloadingUuid === selectedRecord.uuid}
          onClick={handleDownload}
        >
          {downloadingUuid === selectedRecord?.uuid ? 'Preparing...' : 'Download'}
        </Button>
      </Stack>
    </Paper>
  )
}