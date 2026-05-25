import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import AddIcon from '@mui/icons-material/Add'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

const UUID_PATTERN = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/

interface GenerateBuildFormProps {
  isBuildActive: boolean
  onGenerate: (uuid: string) => void
}

export default function GenerateBuildForm({ isBuildActive, onGenerate }: GenerateBuildFormProps) {
  const [uuid, setUuid] = useState('')
  const normalizedUuid = uuid.trim()
  const isUuidValid = useMemo(() => UUID_PATTERN.test(normalizedUuid), [normalizedUuid])
  const hasUuid = normalizedUuid.length > 0

  const handleUuidChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUuid(event.target.value)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isUuidValid && !isBuildActive) {
      onGenerate(normalizedUuid.toUpperCase())
    }
  }

  return (
    <Paper
      component="form"
      elevation={0}
      onSubmit={handleSubmit}
      sx={{
        p: { xs: 2, md: 2.5 },
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack spacing={2}>
        <Typography variant="h6">Generate installer</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
          <TextField
            fullWidth
            required
            id="machine-uuid"
            label="Machine UUID"
            value={uuid}
            onChange={handleUuidChange}
            error={hasUuid && !isUuidValid}
            helperText={hasUuid && !isUuidValid ? 'Use XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.' : ' '}
            slotProps={{ htmlInput: { maxLength: 36 } }}
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            disabled={!isUuidValid || isBuildActive}
            sx={{ minWidth: { xs: '100%', md: 180 }, mt: { md: 0.25 } }}
          >
            {isBuildActive ? 'Building...' : 'Start build'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  )
}