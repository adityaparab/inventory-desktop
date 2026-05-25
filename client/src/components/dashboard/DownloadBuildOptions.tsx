import MenuItem from '@mui/material/MenuItem'
import type { BuildRecord } from '../../types'

interface DownloadBuildOptionsProps {
  records: BuildRecord[]
}

export default function DownloadBuildOptions({ records }: DownloadBuildOptionsProps) {
  if (records.length === 0) {
    return <MenuItem value="">No completed artifacts</MenuItem>
  }

  return records.map((record) => (
    <MenuItem key={record.id} value={record.uuid}>
      {record.outputFilename ?? record.uuid}
    </MenuItem>
  ))
}